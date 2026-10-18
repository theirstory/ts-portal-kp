/**
 * Backfill at-a-glance labels (tag + verbatim key phrase, see scripts/portal-sync/labels.ts) on
 * Explore excerpts that have none. portal-sync labels the excerpts it generates; this covers the
 * reviewed bank that ships with the app and generated excerpts from before labels existed.
 *
 *   yarn insights:label                 # the reviewed bank, then the portal-sync additions
 *   yarn insights:label --bank-only
 *   yarn insights:label --additions-only
 *
 * Re-runnable: only excerpts without a tag are sent to the model.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { displayName } from '@/lib/insights/format';
import type { EvidenceBank } from '@/types/insights';
import { labelInterviewExcerpts, loadAdditions, saveAdditions } from '../portal-sync/excerpts';
import { labelQuestion } from '../portal-sync/labels';
import { createLlm, mapLimit } from '../portal-sync/llm';

const BANK = resolve(process.env.PORTAL_SYNC_EVIDENCE_BANK_FILE || './json/insights/kp_evidence_bank.json');
const ADDITIONS = resolve(
  process.env.PORTAL_SYNC_EVIDENCE_ADDITIONS_FILE || './json/.portal-sync/evidence-additions.json',
);

async function main() {
  const args = new Set(process.argv.slice(2));
  const llm = createLlm();
  console.log(`Labeling with ${llm.id}`);
  const bank = JSON.parse(readFileSync(BANK, 'utf-8')) as EvidenceBank;

  if (!args.has('--additions-only')) {
    // Every answer to a question in one request, so the tags are written to differ from each other.
    const counts = await mapLimit(bank.questions, 3, async (question) => {
      const targets = Object.entries(question.by_interview).flatMap(([title, matches]) =>
        matches.filter((m) => !m.tag).map((match) => ({ speaker: displayName(title), match })),
      );
      if (targets.length === 0) return 0;
      const existing = Object.values(question.by_interview)
        .flat()
        .flatMap((m) => (m.tag ? [m.tag] : []));
      const n = await labelQuestion(llm, question, targets, existing);
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
