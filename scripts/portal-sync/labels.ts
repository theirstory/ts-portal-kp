/**
 * At-a-glance labels for Explore excerpts, so a reader can tell one answer from the next without
 * reading every quote, and filter excerpts by what they're about:
 * - `tag`: a few words (AI wording) for what this excerpt says that the others on the question don't.
 * - `keywords`: 1–4 keywords from the collection's shared vocabulary
 *   (json/insights/keyword_vocabulary.json), so the same idea is the same keyword everywhere.
 *
 * Labels are written per question so the model sees every answer to it at once and keeps tags
 * distinct. An excerpt that already has a tag keeps it; only what's missing is filled in.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { EvidenceMatch, EvidenceQuestion } from '@/types/insights';
import type { Llm } from './llm';

export type LabelTarget = { speaker: string; match: EvidenceMatch };

export const MAX_KEYWORDS = 4;

export const vocabularyFile = (): string =>
  resolve(process.env.PORTAL_SYNC_KEYWORD_VOCABULARY_FILE || './json/insights/keyword_vocabulary.json');

/** The shared keyword vocabulary, or [] when there is none yet (excerpts then get tags only). */
export async function loadVocabulary(path = vocabularyFile()): Promise<string[]> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf-8'));
    return Array.isArray(parsed?.keywords) ? parsed.keywords.filter((k: unknown) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

/** Whether an excerpt is missing any label it can have. */
export const needsLabel = (match: EvidenceMatch, vocabulary: string[]): boolean =>
  !match.tag || (vocabulary.length > 0 && !match.keywords?.length);

const system = (
  vocabulary: string[],
) => `You label excerpts from oral-history interviews with Kaiser Permanente physician leaders, so a reader scanning the answers to one interview question can tell at a glance what each excerpt is about, how it differs from the others, and filter them by topic.

For each excerpt give:
- "tag": 2 to 5 words naming the specific point this excerpt makes, phrased so it stands apart from the other excerpts' tags on this question. Concrete and specific ("Salaried, not fee-for-service", "Joined for a lifetime"), never generic ("Organizational culture", "Leadership insights"), and never a restatement of the question. Sentence case, no ending punctuation, no speaker names. If an excerpt already has a tag, return it unchanged.${
  vocabulary.length
    ? `
- "keywords": 1 to ${MAX_KEYWORDS} keywords for what the excerpt is substantively about, chosen ONLY from this list and spelled exactly as written: ${vocabulary.join(' | ')}. Pick the most specific ones that genuinely apply; fewer is better than loosely related.`
    : ''
}

Reply with only JSON: {"labels":[{"n":1,"tag":"..."${vocabulary.length ? ',"keywords":["..."]' : ''}}, ...]} with one entry per excerpt.`;

/** Tags and keywords for the given answers to one question, set on the matches in place. */
export async function labelQuestion(
  llm: Llm,
  question: EvidenceQuestion,
  targets: LabelTarget[],
  vocabulary: string[],
  /** Tags other answers to this question already have, to stay distinct from. */
  existingTags: string[] = [],
): Promise<number> {
  if (targets.length === 0) return 0;
  const list = targets
    .map((t, i) => `[${i + 1}] ${t.speaker}${t.match.tag ? ` (tag: ${t.match.tag})` : ''}: "${t.match.quote}"`)
    .join('\n\n');
  const taken = existingTags.length
    ? `\n\nOther answers to this question are already tagged: ${existingTags.map((t) => `"${t}"`).join(', ')}. Keep new tags distinct from these too.`
    : '';
  const reply = await llm.json<{ labels?: { n?: number; tag?: string; keywords?: unknown }[] }>({
    system: system(vocabulary),
    prompt: `Interview question: ${question.question}\n\nExcerpts:\n\n${list}${taken}`,
    maxTokens: 8000,
    label: `labels q${question.question_id}`,
  });
  if (!Array.isArray(reply?.labels))
    throw new Error(`labels for q${question.question_id}: reply had no "labels" array`);

  const byLower = new Map(vocabulary.map((k) => [k.toLowerCase(), k]));
  let labeled = 0;
  for (const label of reply.labels) {
    const target = targets[Number(label.n) - 1];
    if (!target) continue;
    const tag = typeof label.tag === 'string' ? label.tag.trim().replace(/[.。]+$/, '') : '';
    if (!target.match.tag && tag) target.match.tag = tag;
    // Only vocabulary keywords are kept, so the same idea is the same filter everywhere.
    const keywords = Array.isArray(label.keywords)
      ? [
          ...new Set(
            label.keywords.flatMap((k) => (typeof k === 'string' ? [byLower.get(k.trim().toLowerCase())] : [])),
          ),
        ].filter((k): k is string => !!k)
      : [];
    if (keywords.length) target.match.keywords = keywords.slice(0, MAX_KEYWORDS);
    delete target.match.key_phrase;
    if (target.match.tag) labeled++;
  }
  return labeled;
}
