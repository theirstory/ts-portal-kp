/**
 * The transcript of a Portal Publisher payload as paragraphs of timed words, plus the matching the
 * LLM steps need: finding a span of text an LLM quoted back in the word stream, to recover its timing.
 */
import { createHash } from 'node:crypto';

export type Word = { start: number; end: number; text: string };

export type Paragraph = {
  index: number;
  speaker: string;
  start: number;
  end: number;
  words: Word[];
};

/** Lowercased alphanumerics only, so "Arkansas," matches "arkansas" and "Kaiser's" matches "kaisers". */
export const normToken = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');

export const tokenize = (text: string): string[] => text.split(/\s+/).map(normToken).filter(Boolean);

export const paragraphText = (paragraph: Paragraph): string => paragraph.words.map((w) => w.text).join(' ');

/** Words assigned to the paragraph whose time range contains them, as the NLP processor does. */
export function paragraphsFromPayload(payload: any): Paragraph[] {
  const words: Word[] = (payload?.transcript?.words ?? [])
    .filter((w: any) => typeof w?.text === 'string' && Number.isFinite(w?.start) && Number.isFinite(w?.end))
    .map((w: any) => ({ start: Number(w.start), end: Number(w.end), text: String(w.text) }))
    .sort((a: Word, b: Word) => a.start - b.start);
  const rawParagraphs: any[] = (payload?.transcript?.paragraphs ?? [])
    .filter((p: any) => Number.isFinite(p?.start) && Number.isFinite(p?.end))
    .sort((a: any, b: any) => a.start - b.start);

  if (rawParagraphs.length === 0) {
    return words.length
      ? [{ index: 0, speaker: '', start: words[0].start, end: words[words.length - 1].end, words }]
      : [];
  }

  const paragraphs: Paragraph[] = rawParagraphs.map((p, index) => ({
    index,
    speaker: String(p.speaker ?? '').trim(),
    start: Number(p.start),
    end: Number(p.end),
    words: [],
  }));
  let current = 0;
  for (const word of words) {
    // Advance to the last paragraph that starts at or before this word.
    while (current + 1 < paragraphs.length && paragraphs[current + 1].start <= word.start + 0.001) current++;
    paragraphs[current].words.push(word);
  }
  return paragraphs.filter((p) => p.words.length > 0).map((p, index) => ({ ...p, index }));
}

/** Stable fingerprint of the transcript text and timing, for caching LLM results per transcript. */
export function transcriptHash(paragraphs: Paragraph[], salt: string): string {
  const hash = createHash('sha256').update(salt);
  for (const p of paragraphs) {
    hash.update(`\n${p.speaker}\n`);
    for (const w of p.words) hash.update(`${w.text}|${w.start}|${w.end} `);
  }
  return hash.digest('hex').slice(0, 32);
}

/**
 * Every place `needle` (already tokenized) occurs as a contiguous run in `words`.
 * Returns [firstWordIndex, lastWordIndex] pairs.
 */
export function findAll(words: Word[], needle: string[]): Array<[number, number]> {
  if (needle.length === 0) return [];
  const tokens = words.map((w) => normToken(w.text));
  const hits: Array<[number, number]> = [];
  for (let i = 0; i < tokens.length; i++) {
    let j = 0;
    let k = i;
    // Words that normalize to nothing (a lone "—") are skipped on the transcript side.
    while (j < needle.length && k < tokens.length) {
      if (tokens[k] === '') {
        k++;
        continue;
      }
      if (tokens[k] !== needle[j]) break;
      j++;
      k++;
    }
    if (j === needle.length && tokens[i] !== '') hits.push([i, k - 1]);
  }
  return hits;
}

/**
 * Locate a quote in a run of words. Quotes may elide with "..." — the start comes from the first
 * segment and the end from the last. Short segment prefixes/suffixes are tried when the exact
 * segment isn't found, since LLMs drop fillers ("uh") mid-quote. null when it can't be placed.
 */
export function locateQuote(words: Word[], quote: string): { start: number; end: number } | null {
  const segments = quote
    .split(/\.{3}|…/)
    .map(tokenize)
    .filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const startIdx = findAnchor(words, first, 'head', 0);
  if (startIdx === null) return null;
  const endIdx = findAnchor(words, last, 'tail', startIdx);
  if (endIdx === null || endIdx < startIdx) return null;
  return { start: words[startIdx].start, end: words[endIdx].end };
}

/** Index of the first word (head) or last word (tail) of the segment, searching from `from`. */
function findAnchor(words: Word[], segment: string[], side: 'head' | 'tail', from: number): number | null {
  const tail = words.slice(from);
  for (const size of [segment.length, 8, 5]) {
    if (size > segment.length) continue;
    const probe = side === 'head' ? segment.slice(0, size) : segment.slice(-size);
    const hits = findAll(tail, probe);
    if (hits.length > 0) return from + (side === 'head' ? hits[0][0] : hits[0][1]);
  }
  return null;
}

/** "[12] 0:14:05 Calvin Wheeler: text…" — the form both LLM passes read the transcript in. */
export function renderParagraph(paragraph: Paragraph): string {
  const t = Math.floor(paragraph.start);
  const stamp = `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  return `[${paragraph.index}] ${stamp} ${paragraph.speaker || 'Unknown'}: ${paragraphText(paragraph)}`;
}
