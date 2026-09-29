/**
 * Explore excerpts for synced recordings: find where a new interview answers each interview-guide
 * question, in the evidence-bank shape Explore renders (types/insights.ts).
 *
 * The hand-reviewed bank (json/insights/kp_evidence_bank.json) is never modified. Generated
 * excerpts go to a separate file next to portal-sync's state (evidence-additions.json) that the
 * frontend merges in at request time (lib/insights/loadEvidenceBank.ts). Recordings already in the
 * reviewed bank are skipped.
 *
 * One LLM pass per theme reads the whole transcript against that theme's questions and quotes the
 * interviewee verbatim; each quote is then placed on the word timings so its clip starts and ends on
 * the quoted words.
 */
import { readFile } from 'node:fs/promises';
import type { EvidenceAdditions, EvidenceBank, EvidenceMatch, EvidenceQuestion } from '@/types/insights';
import { CONFIDENCE_LEVELS } from '@/types/insights';
import type { Llm } from './llm';
import { mapLimit } from './llm';
import { log } from './log';
import { writeFileAtomic } from './state';
import { locateQuote, renderParagraph, transcriptHash } from './transcript';
import type { Paragraph, Word } from './transcript';

const PROMPT_VERSION = 'excerpts-v2';
const CONCURRENCY = 2;
const MAX_PER_QUESTION = 3;
/** Paragraphs after the cited one a quote may run into. */
const SPAN_PARAGRAPHS = 3;

const SYSTEM = `You index oral-history interviews against an interview guide so readers can compare how different people answered the same question.
Quote the interviewee word for word from the transcript: never paraphrase, correct grammar, or merge speakers. Return only JSON.`;

type LlmMatch = {
  question_id?: unknown;
  paragraph?: unknown;
  quote?: unknown;
  confidence?: unknown;
  rationale?: unknown;
};

export async function loadBaseBank(path: string): Promise<EvidenceBank | null> {
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as EvidenceBank;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw new Error(`evidence bank ${path} is unreadable: ${error?.message ?? error}`);
  }
}

export async function loadAdditions(path: string): Promise<EvidenceAdditions> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf-8'));
    if (parsed && typeof parsed.interviews === 'object') return parsed as EvidenceAdditions;
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw new Error(`${path} is unreadable: ${error?.message ?? error}`);
  }
  return { version: 1, interviews: {} };
}

async function saveAdditions(path: string, additions: EvidenceAdditions): Promise<void> {
  await writeFileAtomic(path, `${JSON.stringify(additions, null, 2)}\n`);
}

/** Drop a story's generated excerpts (it was unpublished or removed). No-op if it has none. */
export async function removeExcerpts(path: string, storyId: string): Promise<boolean> {
  const additions = await loadAdditions(path);
  if (!additions.interviews[storyId]) return false;
  delete additions.interviews[storyId];
  await saveAdditions(path, additions);
  return true;
}

function prompt(title: string, category: string, questions: EvidenceQuestion[], transcript: string): string {
  return `Interview: "${title}"

Theme: ${category}
Questions:
${questions.map((q) => `- (${q.question_id}) ${q.question}`).join('\n')}

Transcript. Each paragraph starts with its [number], a timestamp and the speaker:

${transcript}

For each question, find the passages where the interviewee (the person being interviewed, not the interviewer) substantively answers it, whether or not the interviewer asked it in those words. Pick the most direct passages, at most ${MAX_PER_QUESTION} per question (one or two is usual), and none for a question the interview doesn't address. A passage may serve more than one question.

For each match:
- "paragraph": the number of the paragraph the quote starts in.
- "quote": the 1–4 consecutive sentences that carry the answer, copied exactly from the transcript, starting in that paragraph (it may continue into the next ones). You may skip filler or an aside inside the passage with " ... ", but every other word must appear in the transcript as written.
- "confidence": "high" if it directly answers the question, "medium" if it answers part of it or indirectly, "low" if it only touches on it.
- "rationale": one sentence on how the passage answers the question.

Reply with JSON only:
{"matches": [{"question_id": <number>, "paragraph": <number>, "quote": "...", "confidence": "high", "rationale": "..."}]}`;
}

/** Words from the cited paragraph through the next few, where a quote starting there must lie. */
function spanWords(paragraphs: Paragraph[], start: number): Word[] {
  return paragraphs.slice(start, start + 1 + SPAN_PARAGRAPHS).flatMap((p) => p.words);
}

function place(paragraphs: Paragraph[], match: LlmMatch, questionIds: Set<number>): EvidenceMatch | null {
  const questionId = Number(match.question_id);
  const paragraphIndex = Number(match.paragraph);
  const quote = typeof match.quote === 'string' ? match.quote.trim() : '';
  if (!questionIds.has(questionId) || !quote) return null;

  const cited = Number.isInteger(paragraphIndex) && paragraphIndex >= 0 && paragraphIndex < paragraphs.length;
  let at = cited ? locateQuote(spanWords(paragraphs, paragraphIndex), quote) : null;
  // Wrong paragraph number: accept the quote only if it can be placed somewhere in the transcript.
  for (let i = 0; i < paragraphs.length && !at; i++) at = locateQuote(spanWords(paragraphs, i), quote);
  if (!at) return null;

  // The paragraph the placed quote actually starts in, which may be after the cited one.
  const home = paragraphs.find((p) => p.words.some((w) => w.start === at!.start)) ?? paragraphs[0];
  const speaker = home.speaker;
  const startParagraph = home.index;
  const confidence = CONFIDENCE_LEVELS.find((c) => c === match.confidence) ?? 'medium';
  return {
    quote,
    speaker,
    chunk_id: startParagraph,
    start: at.start,
    end: at.end,
    confidence,
    rationale: typeof match.rationale === 'string' ? match.rationale.trim() : '',
  };
}

export type ExcerptOutcome = 'skipped-reviewed' | 'cached' | 'generated';

/**
 * Generate (or reuse) Explore excerpts for one story and store them in the additions file.
 * Throws on LLM failure so the item is retried.
 */
export async function extractExcerpts(opts: {
  llm: Llm;
  storyId: string;
  title: string;
  paragraphs: Paragraph[];
  bank: EvidenceBank;
  additionsFile: string;
}): Promise<ExcerptOutcome> {
  const { llm, storyId, title, paragraphs, bank, additionsFile } = opts;
  if (bank.interviews.some((i) => i.interview_id === storyId)) {
    log.info(`${storyId}: already in the reviewed evidence bank; skipping excerpt extraction`);
    return 'skipped-reviewed';
  }

  const questionKey = bank.questions.map((q) => `${q.question_id}:${q.question}`).join('\n');
  const key = transcriptHash(paragraphs, `${PROMPT_VERSION}|${llm.id}|${questionKey}`);
  const existing = (await loadAdditions(additionsFile)).interviews[storyId];
  if (existing?.key === key) {
    if (existing.interview_title !== title) {
      const additions = await loadAdditions(additionsFile);
      additions.interviews[storyId] = { ...existing, interview_title: title };
      await saveAdditions(additionsFile, additions);
    }
    log.info(`${storyId}: Explore excerpts unchanged (cached)`);
    return 'cached';
  }

  const categories = [...new Set(bank.questions.map((q) => q.category))];
  const transcript = paragraphs.map(renderParagraph).join('\n\n');
  log.info(`${storyId}: finding Explore excerpts with ${llm.id} across ${categories.length} theme(s)`);

  let dropped = 0;
  const perCategory = await mapLimit(categories, CONCURRENCY, async (category) => {
    const questions = bank.questions.filter((q) => q.category === category);
    const reply = await llm.json<{ matches?: LlmMatch[] }>({
      system: SYSTEM,
      prompt: prompt(title, category, questions, transcript),
      maxTokens: 16000,
      label: `${storyId} excerpts "${category}"`,
    });
    if (!Array.isArray(reply?.matches)) throw new Error(`excerpts for "${category}": reply had no "matches" array`);
    const ids = new Set(questions.map((q) => q.question_id));
    return reply.matches.flatMap((m) => {
      const placed = place(paragraphs, m, ids);
      if (!placed) dropped++;
      return placed ? [{ questionId: Number(m.question_id), match: placed }] : [];
    });
  });

  const byQuestion: Record<string, EvidenceMatch[]> = {};
  for (const q of bank.questions) byQuestion[q.question_id] = [];
  for (const { questionId, match } of perCategory.flat()) {
    const list = byQuestion[questionId];
    if (list.length >= MAX_PER_QUESTION || list.some((m) => Math.abs(m.start - match.start) < 1)) continue;
    list.push(match);
  }
  for (const list of Object.values(byQuestion)) list.sort((a, b) => a.start - b.start);

  const total = Object.values(byQuestion).reduce((n, l) => n + l.length, 0);
  const answered = Object.values(byQuestion).filter((l) => l.length > 0).length;
  log.info(
    `${storyId}: ${total} excerpt(s) across ${answered}/${bank.questions.length} question(s)` +
      (dropped ? `; ${dropped} quote(s) dropped because they weren't found verbatim in the transcript` : ''),
  );

  // Re-read right before writing: the file is only written by this service, one story at a time,
  // but never clobber an entry some other story wrote since we loaded it.
  const additions = await loadAdditions(additionsFile);
  additions.interviews[storyId] = {
    interview_title: title,
    interview_id: storyId,
    model: llm.id,
    key,
    generated_at: new Date().toISOString(),
    by_question: byQuestion,
  };
  await saveAdditions(additionsFile, additions);
  return 'generated';
}
