/**
 * Backfill at-a-glance labels (tag + vocabulary keywords, see scripts/portal-sync/labels.ts) on
 * Explore excerpts that are missing them. portal-sync labels the excerpts it generates; this covers
 * the reviewed bank that ships with the app and generated excerpts from before labels existed.
 *
 *   yarn insights:label --vocabulary    # (re)build the shared keyword list from every excerpt's tag
 *   yarn insights:label                 # label the reviewed bank, then the portal-sync additions
 *   yarn insights:label --bank-only
 *   yarn insights:label --additions-only
 *
 * Re-runnable: only excerpts missing a tag or keywords are sent to the model.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { displayName } from '@/lib/insights/format';
import type { EvidenceBank } from '@/types/insights';
import { labelInterviewExcerpts, loadAdditions, saveAdditions } from '../portal-sync/excerpts';
import { labelQuestion, loadVocabulary, needsLabel, vocabularyFile } from '../portal-sync/labels';
import { createLlm, mapLimit } from '../portal-sync/llm';
import type { Llm } from '../portal-sync/llm';

const BANK = resolve(process.env.PORTAL_SYNC_EVIDENCE_BANK_FILE || './json/insights/kp_evidence_bank.json');
const ADDITIONS = resolve(
  process.env.PORTAL_SYNC_EVIDENCE_ADDITIONS_FILE || './json/.portal-sync/evidence-additions.json',
);

/** A shared keyword list for the collection, drawn from every excerpt's tag. */
async function buildVocabulary(llm: Llm, bank: EvidenceBank) {
  const additions = await loadAdditions(ADDITIONS);
  const tags = [
    ...bank.questions.flatMap((q) => Object.values(q.by_interview).flat()),
    ...Object.values(additions.interviews).flatMap((i) => Object.values(i.by_question).flat()),
  ].flatMap((m) => (m.tag ? [m.tag] : []));
  if (tags.length === 0) throw new Error('No tagged excerpts yet: run the labeling first.');

  const reply = await llm.json<{ keywords?: unknown }>({
    system: `You design the keyword filter for an archive of oral-history interviews with Kaiser Permanente physician leaders. Readers will filter excerpts by these keywords, so each must be a topic a reader would actually look for, distinct from the others, and broad enough to apply across several interviews, yet specific enough to be useful (e.g. "Mentorship", "Fee-for-service", "COVID-19", "Electronic health record", "Health equity", "Physician burnout"). Avoid near-duplicates, vague words ("Leadership", "Culture" alone are too broad unless qualified), people's names and place names unless central. Title case for the first word only, except proper nouns and acronyms. Reply with only JSON: {"keywords":["...", ...]}.`,
    prompt: `Here are the short tags of all ${tags.length} excerpts in the archive, one per line. Propose 60 to 90 keywords that together cover them.\n\n${tags.join('\n')}`,
    maxTokens: 4000,
    label: 'keyword vocabulary',
  });
  const keywords = Array.isArray(reply?.keywords)
    ? [...new Set(reply.keywords.filter((k): k is string => typeof k === 'string').map((k) => k.trim()))].filter(
        Boolean,
      )
    : [];
  if (keywords.length < 20) throw new Error(`Vocabulary too small (${keywords.length}); not written.`);
  keywords.sort((a, b) => a.localeCompare(b));
  const groups = await groupKeywords(llm, keywords);
  writeFileSync(
    vocabularyFile(),
    `${JSON.stringify({ _comment: 'Shared keywords for Explore excerpts; built by yarn insights:label --vocabulary.', model: llm.id, keywords, groups }, null, 1)}\n`,
  );
  console.log(`Vocabulary: ${keywords.length} keywords in ${vocabularyFile()}`);
}

/** Topic families for the keywords, which the site colors them by (lib/insights/keywordColors.ts). */
async function groupKeywords(llm: Llm, keywords: string[]): Promise<{ name: string; keywords: string[] }[]> {
  const reply = await llm.json<{ groups?: { name?: unknown; keywords?: unknown }[] }>({
    system:
      'You organize the keyword filter of an oral-history archive of Kaiser Permanente physician leaders. Reply with only JSON.',
    prompt: `Sort every one of these keywords into exactly 7 topic families a reader would recognize at a glance (short names, 1-3 words, e.g. "Patient care & quality", "Careers & mentorship"). Every keyword goes in exactly one family, spelled exactly as given.\n\nReply as {"groups":[{"name":"...","keywords":["..."]}]}\n\nKeywords:\n${keywords.join('\n')}`,
    maxTokens: 4000,
    label: 'keyword groups',
  });
  const seen = new Set<string>();
  const groups = (reply.groups ?? []).flatMap((g) =>
    typeof g.name === 'string' && Array.isArray(g.keywords)
      ? [
          {
            name: g.name,
            keywords: g.keywords.filter(
              (k): k is string => typeof k === 'string' && keywords.includes(k) && !seen.has(k) && !!seen.add(k),
            ),
          },
        ]
      : [],
  );
  const missing = keywords.filter((k) => !seen.has(k));
  if (groups.length === 0) return [{ name: 'Other', keywords }];
  groups[groups.length - 1].keywords.push(...missing);
  return groups;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const llm = createLlm();
  console.log(`Labeling with ${llm.id}`);
  const bank = JSON.parse(readFileSync(BANK, 'utf-8')) as EvidenceBank;

  if (args.has('--vocabulary')) {
    await buildVocabulary(llm, bank);
    return;
  }
  const vocabulary = await loadVocabulary();
  if (vocabulary.length === 0) console.warn('No keyword vocabulary yet: excerpts get tags only.');

  if (!args.has('--additions-only')) {
    // Every answer to a question in one request, so the tags are written to differ from each other.
    const counts = await mapLimit(bank.questions, 3, async (question) => {
      const targets = Object.entries(question.by_interview).flatMap(([title, matches]) =>
        matches.filter((m) => needsLabel(m, vocabulary)).map((match) => ({ speaker: displayName(title), match })),
      );
      if (targets.length === 0) return 0;
      const existing = Object.values(question.by_interview)
        .flat()
        .filter((m) => !targets.some((t) => t.match === m))
        .flatMap((m) => (m.tag ? [m.tag] : []));
      const n = await labelQuestion(llm, question, targets, vocabulary, existing);
      console.log(`  q${question.question_id}: ${n}/${targets.length}`);
      return n;
    });
    writeFileSync(BANK, `${JSON.stringify(bank, null, 1)}\n`);
    console.log(`Reviewed bank: labeled ${counts.reduce((a, b) => a + b, 0)} excerpt(s) in ${BANK}`);
  }

  if (!args.has('--bank-only')) {
    const additions = await loadAdditions(ADDITIONS);
    let total = 0;
    for (const [storyId, interview] of Object.entries(additions.interviews)) {
      const n = await labelInterviewExcerpts(llm, bank, interview.interview_title, interview.by_question);
      // Re-read so a concurrent portal-sync write to another story isn't lost.
      const latest = await loadAdditions(ADDITIONS);
      if (latest.interviews[storyId]?.key === interview.key) {
        latest.interviews[storyId] = interview;
        await saveAdditions(ADDITIONS, latest);
      }
      console.log(`  ${interview.interview_title}: ${n}`);
      total += n;
    }
    console.log(`Generated excerpts: labeled ${total} in ${ADDITIONS}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
