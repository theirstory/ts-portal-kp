/**
 * At-a-glance labels for Explore excerpts, so a reader can tell one answer from the next without
 * reading every quote:
 * - `tag`: a few words (AI wording) for what this excerpt says that the others on the question don't.
 * - `key_phrase`: the most telling words of the quote, verbatim; kept only if it appears in the quote.
 *
 * Labels are written per question so the model sees every answer to it at once and keeps tags
 * distinct. Matches that already have a tag are left alone.
 */
import type { EvidenceMatch, EvidenceQuestion } from '@/types/insights';
import type { Llm } from './llm';

export type LabelTarget = { speaker: string; match: EvidenceMatch };

const SYSTEM = `You label excerpts from oral-history interviews with Kaiser Permanente physician leaders, so a reader scanning the answers to one interview question can tell at a glance what each excerpt is about and how it differs from the others.

For each excerpt give:
- "tag": 2 to 5 words naming the specific point this excerpt makes, phrased so it stands apart from the other excerpts' tags on this question. Concrete and specific ("Salaried, not fee-for-service", "Joined for a lifetime"), never generic ("Organizational culture", "Leadership insights"), and never a restatement of the question. Sentence case, no ending punctuation, no speaker names.
- "key_phrase": the 3 to 10 most telling consecutive words of the excerpt, copied exactly as they appear in it (same words, same order, no ellipses, no added or changed words).

Reply with only JSON: {"labels":[{"n":1,"tag":"...","key_phrase":"..."}, ...]} with one entry per excerpt.`;

const normalize = (text: string) =>
  text.toLowerCase().replace(/[“”"]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

/** The phrase as it is written in the quote, or null when it isn't a verbatim part of it. */
export function verbatimPhrase(quote: string, phrase: string): string | null {
  const wanted = normalize(phrase).replace(/^[.,;:!?…\s]+|[.,;:!?…\s]+$/g, '');
  if (wanted.split(' ').length < 2) return null;
  // Map normalized offsets back onto the original quote.
  const chars: { c: string; i: number }[] = [];
  let lastSpace = false;
  [...quote].forEach((ch, i) => {
    const c = normalize(ch) || ' ';
    if (c === ' ') {
      if (!lastSpace && chars.length) chars.push({ c: ' ', i });
      lastSpace = true;
    } else {
      chars.push({ c, i });
      lastSpace = false;
    }
  });
  const flat = chars.map((x) => x.c).join('');
  const at = flat.indexOf(wanted);
  if (at < 0) return null;
  const from = chars[at].i;
  const to = chars[at + wanted.length - 1].i + 1;
  return quote.slice(from, to);
}

/** Tags and key phrases for the given answers to one question, set on the matches in place. */
export async function labelQuestion(
  llm: Llm,
  question: EvidenceQuestion,
  targets: LabelTarget[],
  /** Tags other answers to this question already have, to stay distinct from. */
  existingTags: string[] = [],
): Promise<number> {
  if (targets.length === 0) return 0;
  const list = targets.map((t, i) => `[${i + 1}] ${t.speaker}: "${t.match.quote}"`).join('\n\n');
  const taken = existingTags.length
    ? `\n\nOther answers to this question are already tagged: ${existingTags.map((t) => `"${t}"`).join(', ')}. Keep the new tags distinct from these too.`
    : '';
  const reply = await llm.json<{ labels?: { n?: number; tag?: string; key_phrase?: string }[] }>({
    system: SYSTEM,
    prompt: `Interview question: ${question.question}\n\nExcerpts:\n\n${list}${taken}`,
    maxTokens: 8000,
    label: `labels q${question.question_id}`,
  });
  if (!Array.isArray(reply?.labels))
    throw new Error(`labels for q${question.question_id}: reply had no "labels" array`);

  let labeled = 0;
  for (const label of reply.labels) {
    const target = targets[Number(label.n) - 1];
    const tag = typeof label.tag === 'string' ? label.tag.trim().replace(/[.。]+$/, '') : '';
    if (!target || !tag) continue;
    target.match.tag = tag;
    const phrase = typeof label.key_phrase === 'string' ? verbatimPhrase(target.match.quote, label.key_phrase) : null;
    if (phrase) target.match.key_phrase = phrase;
    else delete target.match.key_phrase;
    labeled++;
  }
  return labeled;
}
