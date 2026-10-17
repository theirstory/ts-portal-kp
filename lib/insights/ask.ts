/**
 * Server-side: "Ask the collection" on the home page. A visitor's free-text question is matched to
 * the curated interview-guide questions Explore is built on, and each match comes back with the
 * excerpts that speak to it most closely. Nothing is generated for the visitor to read: the model
 * only picks which curated questions fit, and every excerpt is one from the evidence bank.
 *
 * - Questions: Claude ranks the guide's questions against the visitor's (falls back to the
 *   transcript search below when no Anthropic key is configured or the call fails).
 * - Excerpts: a semantic search over the transcript chunks scores each bank excerpt by the
 *   best-ranked chunk it overlaps; word overlap breaks ties and stands in when Weaviate is down.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getDataVersion } from '@/lib/data-version';
import { retrieveChunksForChat } from '@/lib/weaviate/chatRetrieval';
import type { Citation } from '@/types/chat';
import type { EvidenceClip, EvidenceQuestion } from '@/types/insights';
import { questionClipCount, respondentCount } from './evidenceBank';
import { categorySlug } from './format';
import { loadEvidenceIndex } from './loadEvidenceBank';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_QUESTIONS = 5;
const PREVIEWS = 3;
const CHUNKS = 60;

export interface AskMatch {
  question_id: number;
  question: string;
  category: string;
  categorySlug: string;
  narratorCount: number;
  clipCount: number;
  previews: EvidenceClip[];
}

export interface AskResponse {
  query: string;
  matches: AskMatch[];
}

const STOPWORDS = new Set(
  'a an and are as at be but by can did do does for from had has have how i if in into is it its me my of on or our so than that the their them then there these they this to us was we were what when where which who why will with would you your about'.split(
    ' ',
  ),
);

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

const overlap = (queryWords: Set<string>, text: string): number => {
  let n = 0;
  for (const w of new Set(words(text))) if (queryWords.has(w)) n++;
  return n;
};

/** Claude's ranking of the guide questions for this query: ids, best first. null when unavailable. */
async function rankQuestionsWithModel(query: string, questions: EvidenceQuestion[]): Promise<number[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const list = questions.map((q) => `${q.question_id} | ${q.category} | ${q.question}`).join('\n');
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 100,
      system:
        'You match a visitor\'s question to the interview questions of an oral-history collection: interviews with Kaiser Permanente physician leaders. ' +
        `Reply with only a JSON array of the ids of the interview questions whose answers would best help the visitor, best first, at most ${MAX_QUESTIONS}. ` +
        'Include a question only if its answers would genuinely speak to what the visitor asked. Reply [] if none do.',
      messages: [{ role: 'user', content: `Interview questions (id | theme | question):\n${list}\n\nVisitor's question: ${query}` }],
    });
    const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
    const array = text.match(/\[[\d,\s]*\]/);
    if (!array) return null;
    const known = new Set(questions.map((q) => q.question_id));
    const ids = (JSON.parse(array[0]) as number[]).filter((id) => known.has(id));
    return [...new Set(ids)].slice(0, MAX_QUESTIONS);
  } catch (err) {
    console.error('[ask] question ranking failed', err instanceof Error ? err.message : err);
    return null;
  }
}

async function semanticChunks(query: string): Promise<Citation[]> {
  try {
    return await retrieveChunksForChat(query, CHUNKS);
  } catch (err) {
    console.error('[ask] transcript search failed', err instanceof Error ? err.message : err);
    return [];
  }
}

const cache = new Map<string, AskResponse>();
const CACHE_LIMIT = 200;

export async function askCollection(rawQuery: string): Promise<AskResponse> {
  const query = rawQuery.trim().replace(/\s+/g, ' ').slice(0, 500);
  const key = `${getDataVersion()}|${query.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const index = loadEvidenceIndex();
  const questions = index.evidenceQuestions;
  const [ranked, chunks] = await Promise.all([rankQuestionsWithModel(query, questions), semanticChunks(query)]);

  // Rank of the best transcript chunk each excerpt overlaps (higher is better), by interview.
  const chunksByInterview = new Map<string, { start: number; end: number; weight: number }[]>();
  chunks.forEach((chunk, rank) => {
    const list = chunksByInterview.get(chunk.interviewTitle) ?? [];
    list.push({ start: chunk.startTime, end: chunk.endTime, weight: CHUNKS - rank });
    chunksByInterview.set(chunk.interviewTitle, list);
  });
  const queryWords = new Set(words(query));
  const semantic = (clip: EvidenceClip): number =>
    Math.max(
      0,
      ...(chunksByInterview.get(clip.interview_title) ?? [])
        .filter((c) => clip.start < c.end && clip.end > c.start)
        .map((c) => c.weight),
    );
  const scoreClip = (clip: EvidenceClip): number =>
    semantic(clip) * 10 + overlap(queryWords, clip.quote) * 3 + (clip.confidence === 'high' ? 1 : 0);

  let chosen: EvidenceQuestion[];
  if (ranked) {
    chosen = ranked.map((id) => index.getQuestion(id)).filter((q): q is EvidenceQuestion => !!q);
  } else {
    // No model: the questions whose excerpts the transcript search (and the query's words) land on.
    chosen = questions
      .map((q) => {
        const clipScores = index
          .allClipsFor(q)
          .map((clip) => semantic(clip) * 10 + overlap(queryWords, clip.quote))
          .sort((a, b) => b - a);
        const score = clipScores.slice(0, 5).reduce((s, n) => s + n, 0) + overlap(queryWords, q.question) * 40;
        return { q, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_QUESTIONS)
      .map((x) => x.q);
  }

  const matches: AskMatch[] = chosen.map((question) => {
    const scored = index
      .allClipsFor(question)
      .map((clip) => ({ clip, score: scoreClip(clip) }))
      .sort((a, b) => b.score - a.score);
    // Best excerpts, one per narrator where possible, so the preview shows a range of voices.
    const previews: EvidenceClip[] = [];
    const seen = new Set<string>();
    for (const { clip } of scored) {
      if (previews.length >= PREVIEWS) break;
      if (seen.has(clip.interview_title)) continue;
      seen.add(clip.interview_title);
      previews.push(clip);
    }
    return {
      question_id: question.question_id,
      question: question.question,
      category: question.category,
      categorySlug: categorySlug(question.category),
      narratorCount: respondentCount(question),
      clipCount: questionClipCount(question),
      previews,
    };
  });

  const result = { query, matches: matches.filter((m) => m.clipCount > 0) };
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, result);
  return result;
}
