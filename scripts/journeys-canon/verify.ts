/**
 * Verify one or all narrators' journeys & canon extraction, word for word:
 *   - every quote, fortune_basis and opening question is a verbatim substring near `t` (shared
 *     matcher in scripts/lib/narratives/quotes.ts), and `t`/`end` are reset from word timecodes
 *   - anything inside an excluded segment is removed
 *   - enums, counts, lengths and years are valid; years never pass the interview date
 *   - the journey is in non-decreasing year order wherever years are known
 *
 *   yarn journeys:verify              all narrators
 *   yarn journeys:verify wilson       one narrator
 *   add --check to report without rewriting files
 *
 * Exits non-zero on any failure. Fix failures by re-reading the transcript, never by loosening a check.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clipBounds, matchQuote, overlapsExcluded, quoteWordCount } from '../lib/narratives/quotes';
import { loadNarrators, loadRecording } from '../lib/narratives/transcripts';
import type { ExcludedSegment, Recording } from '../lib/narratives/transcripts';
import { DATA_DIR } from './paths';

export const STAGES = [
  'ordinary_world',
  'call',
  'refusal',
  'mentor',
  'threshold',
  'trials',
  'ordeal',
  'reward',
  'transformation',
  'return',
] as const;
export const YEAR_BASIS = ['stated', 'inferred_from_transcript', 'unknown'] as const;
export const PROMPT_TYPES = ['asked_directly', 'narrators_choice', 'follow_up'] as const;
export const QUESTION_SOURCES = ['question_list', 'written_for_narrator', 'improvised'] as const;

type Item = Record<string, any>;
export type Problem = { where: string; reason: string; text: string };

const words = (s: unknown) => (typeof s === 'string' ? s.trim().split(/\s+/).filter(Boolean).length : 0);
const isInt = (n: unknown) => typeof n === 'number' && Number.isInteger(n);

/** Year fields shared by journey moments and events. Returns a reason or null. */
export function checkYear(
  year: unknown,
  basis: unknown,
  note: unknown,
  maxYear: number | null,
  field = 'year',
): string | null {
  if (!YEAR_BASIS.includes(basis as any)) return `year_basis "${basis}" is not stated|inferred_from_transcript|unknown`;
  if (basis === 'unknown') return year === null ? null : `${field} must be null when year_basis is unknown`;
  if (!isInt(year)) return `${field} must be an integer year when year_basis is ${basis}`;
  if ((year as number) < 1900) return `${field} ${year} is implausible`;
  if (maxYear !== null && (year as number) > maxYear) return `${field} ${year} is after the interview (${maxYear})`;
  if (basis === 'inferred_from_transcript' && (typeof note !== 'string' || !note.trim()))
    return 'year_note must explain an inferred year';
  return null;
}

export function checkMoment(m: Item, maxYear: number | null): string | null {
  const year = checkYear(m.year, m.year_basis, m.year_note, maxYear);
  if (year) return year;
  if (!STAGES.includes(m.stage)) return `stage "${m.stage}" is not one of ${STAGES.join('|')}`;
  if (!isInt(m.fortune) || m.fortune < -3 || m.fortune > 3) return `fortune ${m.fortune} is not an integer -3..3`;
  if (!m.label || words(m.label) > 7) return `label must be 1-7 words (${words(m.label)})`;
  if (!m.fortune_basis || quoteWordCount(m.fortune_basis) > 15) return `fortune_basis must be 1-15 words`;
  if (!m.quote || quoteWordCount(m.quote) > 35) return `quote must be 1-35 words (${quoteWordCount(m.quote ?? '')})`;
  if (m.event_ref !== null && typeof m.event_ref !== 'string') return 'event_ref must be a string or null';
  if (typeof m.sensitive !== 'boolean') return 'sensitive must be true or false';
  return null;
}

export function checkEvent(e: Item, maxYear: number | null): string | null {
  if (!e.name || typeof e.name !== 'string') return 'missing name';
  const start = checkYear(e.year_start, e.year_basis, e.year_note, maxYear, 'year_start');
  if (start) return start;
  if (e.year_end !== null && e.year_end !== undefined) {
    if (!isInt(e.year_end)) return 'year_end must be an integer or null';
    if (e.year_start !== null && e.year_end < e.year_start) return 'year_end is before year_start';
    if (maxYear !== null && e.year_end > maxYear) return `year_end ${e.year_end} is after the interview (${maxYear})`;
  }
  if (!e.view || typeof e.view !== 'string') return 'missing view';
  if (!e.quote || quoteWordCount(e.quote) > 30) return `quote must be 1-30 words (${quoteWordCount(e.quote ?? '')})`;
  const p = e.prompt;
  if (!p || typeof p.question !== 'string' || !p.question.trim()) return 'missing prompt.question';
  if (!PROMPT_TYPES.includes(p.type)) return `prompt.type "${p.type}" is not ${PROMPT_TYPES.join('|')}`;
  if (p.list_number !== null && !/^Q\d+$/.test(String(p.list_number)))
    return `prompt.list_number "${p.list_number}" is not Q<number> or null`;
  if (typeof e.sensitive !== 'boolean') return 'sensitive must be true or false';
  return null;
}

export function checkStory(s: Item): string | null {
  if (!s.title || words(s.title) > 8) return `title must be 1-8 words (${words(s.title)})`;
  if (!s.summary || typeof s.summary !== 'string') return 'missing summary';
  if (!s.quote || quoteWordCount(s.quote) > 40) return `quote must be 1-40 words (${quoteWordCount(s.quote ?? '')})`;
  if (!s.why || words(s.why) > 15) return `why must be 1-15 words (${words(s.why)})`;
  if (typeof s.sensitive !== 'boolean') return 'sensitive must be true or false';
  return null;
}

export function checkQuestion(q: Item): string | null {
  if (!q.question || quoteWordCount(q.question) > 40)
    return `question must be 1-40 words (${quoteWordCount(q.question ?? '')})`;
  if (!QUESTION_SOURCES.includes(q.source)) return `source "${q.source}" is not ${QUESTION_SOURCES.join('|')}`;
  if (q.list_number !== null && !/^Q\d+$/.test(String(q.list_number)))
    return `list_number "${q.list_number}" is not Q<number> or null`;
  if (!q.why || words(q.why) > 20) return `why must be 1-20 words (${words(q.why)})`;
  if (typeof q.sensitive !== 'boolean') return 'sensitive must be true or false';
  return null;
}

/** Index of the first moment whose known year is earlier than an earlier moment's known year. */
export function yearOrderBreak(journey: { year: number | null }[]): number {
  let latest = -Infinity;
  for (let i = 0; i < journey.length; i++) {
    const y = journey[i].year;
    if (y === null || y === undefined) continue;
    if (y < latest) return i;
    latest = y;
  }
  return -1;
}

const COUNTS = { journey: [8, 16], retellable: [2, 4], questions_that_opened_things_up: [1, 3] } as const;

function verifyNarrator(slug: string, write: boolean) {
  const narrator = loadNarrators().find((n) => n.slug === slug);
  if (!narrator) throw new Error(`no narrator "${slug}" in data/narrators.json`);
  const file = join(DATA_DIR, 'extracted', `${slug}.json`);
  const data = JSON.parse(readFileSync(file, 'utf-8'));
  const recordings = new Map<number, Recording>(
    narrator.recordings.map((r) => [r.part, loadRecording(slug, r.part, r.story_id)]),
  );
  const maxYearFor = (part: number) => {
    const d = recordings.get(part)?.recordDate;
    return d ? Number(d.slice(0, 4)) : null;
  };
  const latestYear = Math.max(...[...recordings.keys()].map((p) => maxYearFor(p) ?? 0)) || null;

  const excluded: ExcludedSegment[] = [...narrator.excluded_segments];
  for (const span of Array.isArray(data.excluded_segments) ? data.excluded_segments : []) {
    if (!excluded.some((e) => e.part === span.part && e.start === span.start && e.end === span.end))
      excluded.push(span);
  }

  const problems: Problem[] = [];
  let total = 0;
  let itemFailures = 0;
  let dropped = 0;

  /** Place `text` near the item's t; returns clip bounds or null. */
  const place = (item: Item, text: string) => {
    const rec = recordings.get(Number(item.part));
    if (!rec || !Number.isFinite(Number(item.t))) return null;
    return matchQuote(rec.paragraphs, text, Number(item.t));
  };

  const run = (
    section: string,
    list: Item[],
    check: (item: Item) => string | null,
    textField: string,
    alsoVerbatim: string[] = [],
  ): Item[] => {
    const kept: Item[] = [];
    list.forEach((item, i) => {
      total++;
      const where = `${section}[${i}]`;
      const fail = (reason: string) => {
        itemFailures++;
        problems.push({ where, reason, text: String(item[textField] ?? '').slice(0, 140) });
        kept.push(item);
      };
      if (!recordings.has(Number(item.part))) return fail(`part ${item.part} is not one of this narrator's recordings`);
      const shape = check(item);
      if (shape) return fail(shape);
      const match = place(item, item[textField]);
      if (!match) return fail(`${textField} not found verbatim near t=${item.t} (part ${item.part})`);
      for (const f of alsoVerbatim) {
        if (!place(item, item[f])) return fail(`${f} not found verbatim near t=${item.t} (part ${item.part})`);
      }
      const spans = excluded.filter((s) => s.part === Number(item.part));
      if (overlapsExcluded(match.start, match.end, spans)) {
        dropped++;
        return; // the narrator asked for this to be cut
      }
      kept.push({ ...item, ...clipBounds(match.start, match.end) });
    });
    return kept;
  };

  if (!data.one_line || words(data.one_line) > 20)
    problems.push({ where: 'one_line', reason: 'must be 1-20 words', text: String(data.one_line ?? '') });
  if (!data.top_role) problems.push({ where: 'top_role', reason: 'missing', text: '' });

  const journey = run(
    'journey',
    data.journey ?? [],
    (m) => checkMoment(m, maxYearFor(Number(m.part)) ?? latestYear),
    'quote',
    ['fortune_basis'],
  );
  const events = run(
    'events',
    data.events ?? [],
    (e) => checkEvent(e, maxYearFor(Number(e.part)) ?? latestYear),
    'quote',
  );
  const retellable = run('retellable', data.retellable ?? [], checkStory, 'quote');
  const questions = run(
    'questions_that_opened_things_up',
    data.questions_that_opened_things_up ?? [],
    checkQuestion,
    'question',
  );

  const order = yearOrderBreak(journey as { year: number | null }[]);
  if (order >= 0)
    problems.push({
      where: `journey[${order}]`,
      reason: 'journey years go backwards (moments must be in life order)',
      text: String(journey[order].label),
    });
  for (const [key, [min, max]] of Object.entries(COUNTS)) {
    const n = (data[key] ?? []).length;
    if (n < min || n > max) problems.push({ where: key, reason: `has ${n} items; expected ${min}-${max}`, text: '' });
  }

  if (write) {
    Object.assign(data, {
      recordings: narrator.recordings,
      excluded_segments: excluded,
      journey,
      events,
      retellable,
      questions_that_opened_things_up: questions,
    });
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  }
  return { total, dropped, problems, itemFailures };
}

function main() {
  const args = process.argv.slice(2);
  const write = !args.includes('--check');
  const only = args.filter((a) => !a.startsWith('--'));
  const slugs = only.length ? only : loadNarrators().map((n) => n.slug);
  let failures = 0;
  let total = 0;
  for (const slug of slugs) {
    if (!existsSync(join(DATA_DIR, 'extracted', `${slug}.json`))) {
      console.log(`${slug}: no extracted file yet`);
      failures++;
      continue;
    }
    const r = verifyNarrator(slug, write);
    total += r.total;
    failures += r.problems.length;
    console.log(
      `${slug}: ${r.total - r.dropped - r.itemFailures}/${r.total} items verified` +
        (r.dropped ? `, ${r.dropped} dropped (excluded segment)` : '') +
        (r.problems.length ? `, ${r.problems.length} problem(s)` : ''),
    );
    for (const p of r.problems) console.log(`  ${p.where}: ${p.reason}${p.text ? `\n     "${p.text}"` : ''}`);
  }
  console.log(failures ? `\n${failures} problem(s) across ${total} item(s)` : `\nAll ${total} item(s) verified`);
  process.exit(failures ? 1 : 0);
}

if (process.argv[1]?.endsWith('verify.ts')) main();
