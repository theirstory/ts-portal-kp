/**
 * Align evidence-bank excerpt timestamps to the exact words of the quote.
 *
 * The analysis pass recorded each excerpt's `start`/`end` as the bounds of the
 * transcript *chunk* it came from, not of the quote itself — so a clip could
 * open half a minute early, on a different speaker. This re-derives both from
 * the interview's word-level timings in json/interviews/, matching the quote's
 * tokens against the word stream.
 *
 *   yarn tsx scripts/align-evidence-timestamps.ts [--dry] [--verbose]
 *
 * Meant to run over a bank whose bounds are still chunk-level; a quote it
 * cannot place confidently keeps its original bounds rather than being moved
 * to a guess. Re-running is safe — every start is stable — though a couple of
 * ends can extend slightly as the search window tightens.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

type Word = { start: number; end: number; text: string };

type Match = {
  quote: string;
  speaker: string;
  chunk_id: number;
  start: number;
  end: number;
  confidence: string;
  rationale: string;
};

type Bank = {
  interviews: { interview_title: string; interview_id: string; source_file: string }[];
  questions: { question_id: number; category: string; question: string; by_interview: Record<string, Match[]> }[];
};

const BANK_PATH = path.join(process.cwd(), 'json/insights/kp_evidence_bank.json');
const INTERVIEWS_DIR = path.join(process.cwd(), 'json/interviews/oral-histories');

/** How far outside the recorded chunk bounds a match may sit before we distrust it. */
const WINDOW_PAD_SECONDS = 20;
/** Fraction of the quote's tokens that must appear, in order, to accept a
 *  match inside the recorded chunk. */
const MIN_RATIO = 0.8;
/**
 * Some excerpts are filed against the wrong chunk, so the quote genuinely sits
 * outside the recorded bounds. A match out there is only trusted when it is
 * near-verbatim AND no rival comes close — a unique exact hit in a two-hour
 * transcript is not a coincidence.
 */
const STRONG_RATIO = 0.95;
/** A rival within this much of the best score makes the match ambiguous. */
const AMBIGUITY_MARGIN = 0.03;
/** Words of the quote's head/tail to fall back on when the full span won't match. */
const PREFIX_FALLBACK_TOKENS = 12;

const dryRun = process.argv.includes('--dry');
const verbose = process.argv.includes('--verbose');

/** Lowercase, drop punctuation, split — so "It's," and "its" compare equal. */
const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/'/g, '')
    .split(/\s+/)
    .filter(Boolean);

/** A quote may elide material with an ellipsis; each side is matched separately. */
const splitSegments = (quote: string): string[] =>
  quote
    .split(/…|\.\.\./)
    .map((segment) => segment.trim())
    .filter((segment) => tokenize(segment).length >= 3);

/** Length of the longest common subsequence of two token lists. */
const lcsLength = (a: string[], b: string[]): number => {
  let prev = new Array<number>(b.length + 1).fill(0);
  let curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return prev[b.length];
};

type Alignment = { startIndex: number; endIndex: number; ratio: number };

/**
 * Best position of `needle` within `tokens`, preferring candidates inside
 * [lowIndex, highIndex] — the recorded chunk, which is a strong prior in a
 * two-hour interview where a phrase may recur.
 */
function align(
  tokens: string[],
  positions: Map<string, number[]>,
  needle: string[],
  lowIndex: number,
  highIndex: number,
): Alignment | null {
  if (needle.length < 3) return null;

  // Seed candidates from the rarest of the leading tokens, so a quote starting
  // on "the" doesn't produce thousands of candidates.
  const anchorRange = Math.min(6, needle.length);
  let anchorIndex = 0;
  let anchorCount = Infinity;
  for (let i = 0; i < anchorRange; i += 1) {
    const count = positions.get(needle[i])?.length ?? 0;
    if (count > 0 && count < anchorCount) {
      anchorCount = count;
      anchorIndex = i;
    }
  }

  const anchorPositions = positions.get(needle[anchorIndex]) ?? [];
  const slack = Math.max(4, Math.ceil(needle.length * 0.3));

  const candidates: number[] = [];
  for (const position of anchorPositions) {
    const start = position - anchorIndex;
    if (start < 0 || start >= tokens.length) continue;
    candidates.push(start);
  }
  if (candidates.length === 0) return null;

  const scored: Alignment[] = [];

  for (const start of candidates) {
    const window = tokens.slice(start, Math.min(tokens.length, start + needle.length + slack));
    if (window.length < needle.length * 0.6) continue;

    // Coverage of the quote's tokens, not of the padded window: dividing by the
    // window length would cap a perfect short match below 0.9 and make the
    // near-verbatim threshold unreachable.
    const ratio = lcsLength(needle, window) / needle.length;

    // Trim the window back to the last token that matches the quote's ending.
    const lastToken = needle[needle.length - 1];
    let endIndex = start + needle.length - 1;
    for (let i = Math.min(tokens.length - 1, start + needle.length + slack); i >= start; i -= 1) {
      if (tokens[i] === lastToken) {
        endIndex = i;
        break;
      }
    }

    scored.push({ startIndex: start, endIndex: Math.min(endIndex, tokens.length - 1), ratio });
  }

  if (scored.length === 0) return null;

  const inWindow = scored.filter((c) => c.startIndex >= lowIndex && c.startIndex <= highIndex);
  const pick = (list: Alignment[]) => list.reduce((a, b) => (b.ratio > a.ratio ? b : a));

  const bestInWindow = inWindow.length > 0 ? pick(inWindow) : null;
  const bestOverall = pick(scored);

  let best: Alignment | null = null;

  // A near-verbatim match with no rival anywhere in the transcript is the
  // strongest evidence available — stronger than the recorded chunk, which is
  // itself wrong for a handful of excerpts. Only when no such match exists do
  // we fall back to the best candidate inside the chunk.
  const unrivalled =
    bestOverall.ratio >= STRONG_RATIO &&
    scored.every((c) => c === bestOverall || c.ratio < bestOverall.ratio - AMBIGUITY_MARGIN);

  if (unrivalled) best = bestOverall;
  else if (bestInWindow && bestInWindow.ratio >= MIN_RATIO) best = bestInWindow;

  if (!best) return null;

  // The window score can favour a start a few filler words early. Snap to the
  // nearest position where the quote's opening words match exactly.
  const prefix = Math.min(5, needle.length);
  for (let delta = 0; delta <= slack; delta += 1) {
    for (const candidate of [best.startIndex + delta, best.startIndex - delta]) {
      if (candidate < 0 || candidate + prefix > tokens.length) continue;
      let exact = true;
      for (let i = 0; i < prefix; i += 1) {
        if (tokens[candidate + i] !== needle[i]) {
          exact = false;
          break;
        }
      }
      if (exact) return { ...best, startIndex: candidate };
    }
  }

  return best;
}

/** interview_id -> the flat word stream for that interview. */
function loadWordStreams(): Map<string, Word[]> {
  const streams = new Map<string, Word[]>();

  for (const file of readdirSync(INTERVIEWS_DIR)) {
    if (!file.endsWith('.json')) continue;
    const id = file.replace(/\.json$/, '').split('-').pop();
    if (!id) continue;

    const raw = JSON.parse(readFileSync(path.join(INTERVIEWS_DIR, file), 'utf-8'));
    const words: Word[] = raw?.transcript?.words ?? [];
    if (words.length > 0) streams.set(id, words);
  }

  return streams;
}

function main() {
  const bank: Bank = JSON.parse(readFileSync(BANK_PATH, 'utf-8'));
  const streams = loadWordStreams();

  const idByTitle = new Map(bank.interviews.map((i) => [i.interview_title, i.interview_id]));

  // Per-interview token stream + inverted index, built once.
  const prepared = new Map<string, { words: Word[]; tokens: string[]; positions: Map<string, number[]> }>();
  for (const [id, words] of streams) {
    const tokens: string[] = [];
    const wordIndexTokenIndex: number[] = [];
    words.forEach((word, wordIndex) => {
      for (const token of tokenize(word.text)) {
        tokens.push(token);
        wordIndexTokenIndex.push(wordIndex);
      }
    });

    const positions = new Map<string, number[]>();
    tokens.forEach((token, index) => {
      const list = positions.get(token);
      if (list) list.push(index);
      else positions.set(token, [index]);
    });

    prepared.set(id, { words, tokens, positions });
    // Token index -> word index, stashed on the same object.
    (prepared.get(id) as unknown as { map: number[] }).map = wordIndexTokenIndex;
  }

  let total = 0;
  let aligned = 0;
  let unchanged = 0;
  const failures: { title: string; quote: string }[] = [];
  const shifts: number[] = [];

  for (const question of bank.questions) {
    for (const [title, matches] of Object.entries(question.by_interview)) {
      const id = idByTitle.get(title);
      const entry = id ? prepared.get(id) : undefined;
      if (!entry) continue;

      const { words, tokens, positions } = entry;
      const tokenToWord = (entry as unknown as { map: number[] }).map;

      for (const match of matches) {
        total += 1;

        // Token indices bounding the recorded chunk, used as the search prior.
        let lowIndex = 0;
        let highIndex = tokens.length - 1;
        for (let i = 0; i < tokens.length; i += 1) {
          const word = words[tokenToWord[i]];
          if (word.start >= match.start - WINDOW_PAD_SECONDS) {
            lowIndex = i;
            break;
          }
        }
        for (let i = tokens.length - 1; i >= 0; i -= 1) {
          const word = words[tokenToWord[i]];
          if (word.end <= match.end + WINDOW_PAD_SECONDS) {
            highIndex = i;
            break;
          }
        }

        const segments = splitSegments(match.quote);
        if (segments.length === 0) {
          failures.push({ title, quote: match.quote });
          continue;
        }

        const headTokens = tokenize(segments[0]);
        const tailTokens = tokenize(segments[segments.length - 1]);

        // A long quote can drift from the transcript in its tail; the opening
        // rarely does, so fall back to matching just the first few words.
        const first =
          align(tokens, positions, headTokens, lowIndex, highIndex) ??
          align(tokens, positions, headTokens.slice(0, PREFIX_FALLBACK_TOKENS), lowIndex, highIndex);

        if (!first) {
          failures.push({ title, quote: match.quote });
          continue;
        }

        // Search for the tail forward of the head rather than inside the
        // recorded chunk: when the chunk was mis-filed the head can land past
        // the old end, leaving an empty range and a truncated highlight.
        const quoteLength = tokenize(match.quote).length;
        const tailHigh = Math.min(tokens.length - 1, first.startIndex + quoteLength * 3 + 200);

        const last =
          (segments.length === 1 && headTokens.length <= PREFIX_FALLBACK_TOKENS
            ? first
            : align(tokens, positions, tailTokens, first.startIndex, tailHigh) ??
              align(tokens, positions, tailTokens.slice(-PREFIX_FALLBACK_TOKENS), first.startIndex, tailHigh)) ??
          first;

        const startWord = words[tokenToWord[first.startIndex]];
        const endWord = words[tokenToWord[Math.max(last.endIndex, first.endIndex)]];
        const newStart = Number(startWord.start.toFixed(2));
        const newEnd = Number(Math.max(endWord.end, startWord.end).toFixed(2));

        if (newEnd <= newStart) {
          failures.push({ title, quote: match.quote });
          continue;
        }

        if (newStart === match.start && newEnd === match.end) unchanged += 1;
        else shifts.push(newStart - match.start);

        aligned += 1;
        match.start = newStart;
        match.end = newEnd;
      }
    }
  }

  const sortedShifts = [...shifts].sort((a, b) => a - b);
  const at = (q: number) => sortedShifts[Math.min(sortedShifts.length - 1, Math.floor(sortedShifts.length * q))] ?? 0;

  console.log(`excerpts:        ${total}`);
  console.log(`aligned:         ${aligned}`);
  console.log(`already exact:   ${unchanged}`);
  console.log(`unmatched:       ${failures.length} (left at their chunk bounds)`);
  if (sortedShifts.length > 0) {
    console.log(`shift p50:       ${at(0.5).toFixed(1)}s`);
    console.log(`shift p95:       ${at(0.95).toFixed(1)}s`);
    console.log(`shift range:     ${sortedShifts[0].toFixed(1)}s .. ${sortedShifts[sortedShifts.length - 1].toFixed(1)}s`);
  }

  if (verbose) {
    for (const failure of failures.slice(0, 25)) {
      console.log(`  UNMATCHED [${failure.title}] ${failure.quote.slice(0, 90)}…`);
    }
  }

  if (dryRun) {
    console.log('\n--dry: bank not written');
    return;
  }

  writeFileSync(BANK_PATH, `${JSON.stringify(bank, null, 1)}\n`);
  console.log(`\nwrote ${BANK_PATH}`);
}

main();
