/**
 * Verbatim quote matching for the Memory Map pipelines. A quote is a run of a recording's words exactly as
 * transcribed — same case, same punctuation — joined by single spaces. "..." (or "…") may join two
 * verbatim segments in order. The only leniency: a segment may stop before trailing punctuation
 * attached to its last word ("experience" for "experience.").
 *
 * Pure functions; the verifier and the unit tests both use them.
 */
import type { Paragraph, Word } from '../../portal-sync/transcript';

export type WordRef = { paragraph: number; index: number; word: Word };

export type QuoteMatch = { start: number; end: number; paragraph: number; firstWord: WordRef; lastWord: WordRef };

export const ELLIPSIS = /\s*(?:\.\.\.|…)\s*/;

export const quoteSegments = (quote: string): string[] =>
  quote
    .split(ELLIPSIS)
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter(Boolean);

export const quoteWordCount = (quote: string): number =>
  quoteSegments(quote).reduce((n, s) => n + s.split(' ').length, 0);

/** Trailing characters a segment may stop before. */
const TRAILING_PUNCT = /^[.,;:!?"'”’)\]-]*$/;

/**
 * Every occurrence of `segment` within one paragraph, aligned to word boundaries, as
 * [firstWordIndex, lastWordIndex] pairs.
 */
export function findInParagraph(paragraph: Paragraph, segment: string): Array<[number, number]> {
  const words = paragraph.words.map((w) => w.text);
  const text = words.join(' ');
  // Char offset where each word starts.
  const starts: number[] = [];
  let offset = 0;
  for (const w of words) {
    starts.push(offset);
    offset += w.length + 1;
  }
  const hits: Array<[number, number]> = [];
  let from = 0;
  while (from <= text.length) {
    const at = text.indexOf(segment, from);
    if (at < 0) break;
    from = at + 1;
    const first = starts.indexOf(at);
    if (first < 0) continue; // starts mid-word
    const endChar = at + segment.length; // exclusive
    // The word containing the last char of the segment.
    let last = first;
    while (last + 1 < starts.length && starts[last + 1] < endChar) last++;
    const wordEnd = starts[last] + words[last].length;
    if (!TRAILING_PUNCT.test(text.slice(endChar, wordEnd))) continue; // stops mid-word
    hits.push([first, last]);
  }
  return hits;
}

/** Index of the paragraph that contains time t (the last one starting at or before it). */
export function paragraphAt(paragraphs: Paragraph[], t: number): number {
  let index = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].start <= t + 0.001) index = i;
    else break;
  }
  return index;
}

/** How far after the claimed time a quote may start (same paragraph is always allowed). */
export const WINDOW_AFTER_S = 180;
/** How many paragraphs later the segments after "..." may continue. */
const CONTINUATION_PARAGRAPHS = 2;
/** Max silence skipped by one "..." join: it may drop an aside, not stitch distant passages. */
export const MAX_JOIN_GAP_S = 60;

/**
 * Place a quote near `t`: its first segment must start in the paragraph containing `t` or within
 * WINDOW_AFTER_S seconds after `t`; later segments must follow in order within the next couple of
 * paragraphs. Returns the clip bounds from word timecodes, or null when it can't be placed.
 */
export function matchQuote(paragraphs: Paragraph[], quote: string, t: number): QuoteMatch | null {
  const segments = quoteSegments(quote);
  if (segments.length === 0 || paragraphs.length === 0) return null;
  const home = paragraphAt(paragraphs, t);
  const windowStart = paragraphs[home].start;
  const windowEnd = t + WINDOW_AFTER_S;

  for (let p = home; p < paragraphs.length && paragraphs[p].start <= windowEnd; p++) {
    for (const [first, last] of findInParagraph(paragraphs[p], segments[0])) {
      const startTime = paragraphs[p].words[first].start;
      if (startTime < windowStart - 0.001 || startTime > windowEnd) continue;
      const tail = continueSegments(paragraphs, segments.slice(1), { paragraph: p, index: last });
      if (!tail) continue;
      const firstWord = { paragraph: p, index: first, word: paragraphs[p].words[first] };
      const lastWord: WordRef = 'word' in tail ? tail : { paragraph: p, index: last, word: paragraphs[p].words[last] };
      return { start: firstWord.word.start, end: lastWord.word.end, paragraph: p, firstWord, lastWord };
    }
  }
  return null;
}

/** Match the remaining segments in order after `after`; returns the last matched word. */
function continueSegments(
  paragraphs: Paragraph[],
  segments: string[],
  after: { paragraph: number; index: number },
): WordRef | { paragraph: -1 } | null {
  if (segments.length === 0) return { paragraph: -1 };
  const [segment, ...rest] = segments;
  for (let p = after.paragraph; p <= Math.min(paragraphs.length - 1, after.paragraph + CONTINUATION_PARAGRAPHS); p++) {
    for (const [first, last] of findInParagraph(paragraphs[p], segment)) {
      if (p === after.paragraph && first <= after.index) continue;
      const previousEnd = paragraphs[after.paragraph].words[after.index].end;
      if (paragraphs[p].words[first].start - previousEnd > MAX_JOIN_GAP_S) continue;
      const tail = continueSegments(paragraphs, rest, { paragraph: p, index: last });
      if (!tail) continue;
      return 'word' in tail ? tail : { paragraph: p, index: last, word: paragraphs[p].words[last] };
    }
  }
  return null;
}

/** True when [start, end] overlaps an excluded span. */
export const overlapsExcluded = (start: number, end: number, spans: { start: number; end: number }[]): boolean =>
  spans.some((s) => start < s.end && end > s.start);

/**
 * Clip bounds at centisecond precision, never cutting a quoted word: the start is floored and the
 * end ceiled (rounding put 7192.07644 at 7192.08, after the first word had begun).
 */
export const clipBounds = (start: number, end: number) => ({
  t: Math.floor(start * 100 + 1e-6) / 100,
  end: Math.ceil(end * 100 - 1e-6) / 100,
});
