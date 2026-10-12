/**
 * Verify the extracted claims, word for word:
 *   - every quote is a verbatim substring of its recording near `t` (see quotes.ts)
 *   - `t` and `end` are set from the first and last quoted words' timecodes (no padding)
 *   - claims inside a narrator's excluded segments are removed
 *   - enum values and required fields are valid
 *
 *   yarn tsx scripts/system-map/verify.ts            all narrators
 *   yarn tsx scripts/system-map/verify.ts wilson     one narrator
 *   add --check to report without rewriting files
 *
 * Exits non-zero when any claim fails. Fix failures by re-reading the transcript, never by
 * loosening the check.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadNarrators, loadRecording } from '../lib/narratives/transcripts';
import type { Recording } from '../lib/narratives/transcripts';
import { clipBounds, matchQuote, overlapsExcluded, quoteWordCount } from '../lib/narratives/quotes';
import { DATA_DIR } from './paths';

const MAX_QUOTE_WORDS = 35;
const POLARITY = ['+', '-'];
const EXPLICITNESS = ['explicit', 'implied'];
const PROMPT_TYPES = ['asked_directly', 'narrators_choice', 'follow_up'];

type Claim = Record<string, any>;

export type Problem = { index: number; reason: string; claim: Claim };

export function checkClaimShape(claim: Claim, parts: Set<number>): string | null {
  if (typeof claim.from !== 'string' || !claim.from.trim()) return 'missing "from"';
  if (typeof claim.to !== 'string' || !claim.to.trim()) return 'missing "to"';
  if (claim.from.trim().toLowerCase() === claim.to.trim().toLowerCase()) return '"from" and "to" are the same factor';
  if (!POLARITY.includes(claim.polarity)) return `polarity "${claim.polarity}" is not + or -`;
  if (!EXPLICITNESS.includes(claim.explicitness)) return `explicitness "${claim.explicitness}" is not explicit|implied`;
  if (!parts.has(Number(claim.part))) return `part ${claim.part} is not one of this narrator's recordings`;
  if (!Number.isFinite(Number(claim.t))) return 't is not a number';
  if (typeof claim.quote !== 'string' || !claim.quote.trim()) return 'missing quote';
  if (quoteWordCount(claim.quote) > MAX_QUOTE_WORDS)
    return `quote is ${quoteWordCount(claim.quote)} words (max ${MAX_QUOTE_WORDS})`;
  const prompt = claim.prompt;
  if (!prompt || typeof prompt !== 'object') return 'missing prompt';
  if (typeof prompt.question !== 'string' || !prompt.question.trim()) return 'missing prompt.question';
  if (!PROMPT_TYPES.includes(prompt.type))
    return `prompt.type "${prompt.type}" is not asked_directly|narrators_choice|follow_up`;
  if (prompt.list_number !== null && !/^Q\d+$/.test(String(prompt.list_number)))
    return `prompt.list_number "${prompt.list_number}" is not Q<number> or null`;
  return null;
}

function verifyNarrator(
  slug: string,
  write: boolean,
): { total: number; passed: number; dropped: number; problems: Problem[] } {
  const narrator = loadNarrators().find((n) => n.slug === slug);
  if (!narrator) throw new Error(`no narrator "${slug}" in narrators.json`);
  const file = join(DATA_DIR, 'claims', `${slug}.json`);
  if (!existsSync(file)) throw new Error(`missing ${file}`);
  const data = JSON.parse(readFileSync(file, 'utf-8'));
  const claims: Claim[] = Array.isArray(data.claims) ? data.claims : [];

  const recordings = new Map<number, Recording>(
    narrator.recordings.map((r) => [r.part, loadRecording(slug, r.part, r.story_id)]),
  );
  const parts = new Set(recordings.keys());
  // The registry's spans plus any new cut requests the extraction found (merged into the registry
  // once reviewed).
  const excluded = [...narrator.excluded_segments];
  for (const span of Array.isArray(data.excluded_segments) ? data.excluded_segments : []) {
    const known = excluded.some((e) => e.part === span.part && e.start === span.start && e.end === span.end);
    if (!known && Number.isFinite(span.start) && Number.isFinite(span.end)) excluded.push(span);
  }

  const problems: Problem[] = [];
  const kept: Claim[] = [];
  let dropped = 0;

  claims.forEach((claim, index) => {
    const shape = checkClaimShape(claim, parts);
    if (shape) {
      problems.push({ index, reason: shape, claim });
      kept.push(claim);
      return;
    }
    const recording = recordings.get(Number(claim.part))!;
    const match = matchQuote(recording.paragraphs, claim.quote, Number(claim.t));
    if (!match) {
      problems.push({ index, reason: `quote not found verbatim near t=${claim.t} (part ${claim.part})`, claim });
      kept.push(claim);
      return;
    }
    const spans = excluded.filter((s) => s.part === Number(claim.part));
    if (overlapsExcluded(match.start, match.end, spans)) {
      dropped++;
      return; // the narrator asked for this to be cut
    }
    kept.push({ ...claim, ...clipBounds(match.start, match.end) });
  });

  if (write) {
    data.recordings = narrator.recordings;
    data.excluded_segments = excluded;
    data.claims = kept;
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  }
  return { total: claims.length, passed: claims.length - problems.length - dropped, dropped, problems };
}


function main() {
  const args = process.argv.slice(2);
  const write = !args.includes('--check');
  const only = args.filter((a) => !a.startsWith('--'));
  const slugs = only.length ? only : loadNarrators().map((n) => n.slug);

  let failures = 0;
  let total = 0;
  for (const slug of slugs) {
    const file = join(DATA_DIR, 'claims', `${slug}.json`);
    if (!existsSync(file)) {
      console.log(`${slug}: no claims file yet`);
      failures++;
      continue;
    }
    const result = verifyNarrator(slug, write);
    total += result.total;
    failures += result.problems.length;
    console.log(
      `${slug}: ${result.passed}/${result.total} verified` +
        (result.dropped ? `, ${result.dropped} dropped (excluded segment)` : '') +
        (result.problems.length ? `, ${result.problems.length} FAILED` : ''),
    );
    for (const p of result.problems) {
      console.log(`  #${p.index} ${p.reason}\n     "${String(p.claim.quote ?? '').slice(0, 160)}"`);
    }
  }
  console.log(failures ? `\n${failures} problem(s) across ${total} claim(s)` : `\nAll ${total} claim(s) verified`);
  process.exit(failures ? 1 : 0);
}

if (process.argv[1]?.endsWith('verify.ts')) main();
