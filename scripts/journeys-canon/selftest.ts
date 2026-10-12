/**
 * Unit tests for journeys & canon: yarn journeys:test
 * Quote matching, clip bounds and excluded segments (shared code), field and year checks, year
 * placement and interpolation, event canonicalization, overrides, bands and findings.
 */
import assert from 'node:assert/strict';
import { buildModel, eventResolver, placeYears, proposeBands, spreadSameYear } from '@/lib/journeys-canon/model';
import type { EventDef, NarratorMeta, Overrides, RawMoment, RawNarrator } from '@/lib/journeys-canon/model';
import type { Paragraph } from '../portal-sync/transcript';
import { clipBounds, matchQuote, overlapsExcluded } from '../lib/narratives/quotes';
import { checkEvent, checkMoment, checkQuestion, checkStory, checkYear, yearOrderBreak } from './verify';

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

// ---------------------------------------------------------------- quotes, clips, exclusions

const para = (text: string, start: number): Paragraph => {
  const words = text.split(' ').map((w, i) => ({ text: w, start: start + i, end: start + i + 0.8 }));
  return { index: 0, speaker: 'Narrator', start, end: words[words.length - 1].end, words };
};

test('quotes: verbatim near t; clip from first to last quoted word; excluded spans', () => {
  const P = [para('So in 1994, I became the medical director. It was the best part.', 3150)];
  const m = matchQuote(P, 'in 1994, I became the medical director.', 3150);
  assert.ok(m);
  assert.deepEqual([m.start, m.end], [3151, 3157.8]); // "in" is the 2nd word; "director." the 8th
  assert.equal(matchQuote(P, 'in 1994 I became medical director', 3150), null, 'not verbatim');
  assert.deepEqual(clipBounds(3152.004, 3158.801), { t: 3152, end: 3158.81 });
  assert.equal(overlapsExcluded(4100, 4110, [{ start: 4090, end: 4362 }]), true);
  assert.equal(overlapsExcluded(4400, 4410, [{ start: 4090, end: 4362 }]), false);
});

// ---------------------------------------------------------------- field checks

const moment = (over: Partial<RawMoment> = {}): RawMoment => ({
  t: 10,
  end: 15,
  part: 1,
  year: 1990,
  year_basis: 'stated',
  year_note: '',
  stage: 'threshold',
  label: 'Joins the group',
  fortune: 2,
  fortune_basis: 'I loved it',
  quote: 'I loved it here',
  event_ref: null,
  sensitive: false,
  ...over,
});

test('years: null iff unknown; inferred needs a note; never after the interview', () => {
  assert.equal(checkYear(null, 'unknown', '', 2026), null);
  assert.match(checkYear(1990, 'unknown', '', 2026)!, /must be null/);
  assert.match(checkYear(null, 'stated', '', 2026)!, /integer year/);
  assert.match(checkYear(1990, 'inferred_from_transcript', '', 2026)!, /year_note/);
  assert.equal(checkYear(1990, 'inferred_from_transcript', 'joined 1977, 13 years later', 2026), null);
  assert.match(checkYear(2027, 'stated', '', 2026)!, /after the interview/);
  assert.match(checkYear(1990, 'guess', '', 2026)!, /year_basis/);
});

test('moments, events, stories, questions: enums and lengths', () => {
  assert.equal(checkMoment(moment(), 2026), null);
  assert.match(checkMoment(moment({ stage: 'hero' }), 2026)!, /stage/);
  assert.match(checkMoment(moment({ fortune: 4 }), 2026)!, /fortune/);
  assert.match(checkMoment(moment({ fortune: 1.5 }), 2026)!, /fortune/);
  assert.match(checkMoment(moment({ label: 'one two three four five six seven eight' }), 2026)!, /label/);
  assert.match(checkMoment(moment({ sensitive: 'no' as never }), 2026)!, /sensitive/);
  const ev = {
    name: 'COVID-19 pandemic',
    year_start: 2020,
    year_end: null,
    year_basis: 'stated',
    view: 'v',
    quote: 'q',
    prompt: { question: 'q', list_number: null, type: 'asked_directly' },
    sensitive: false,
  };
  assert.equal(checkEvent(ev, 2026), null);
  assert.match(checkEvent({ ...ev, prompt: { ...ev.prompt, type: 'asked' } }, 2026)!, /prompt.type/);
  assert.match(checkEvent({ ...ev, year_end: 2019 }, 2026)!, /before year_start/);
  assert.match(
    checkStory({ title: 'a b c d e f g h i', summary: 's', quote: 'q', why: 'w', sensitive: false })!,
    /title/,
  );
  assert.match(
    checkQuestion({ question: 'q', source: 'list', list_number: null, why: 'w', sensitive: false })!,
    /source/,
  );
});

test('journey order: known years must not go backwards (unknowns are skipped)', () => {
  assert.equal(yearOrderBreak([{ year: 1970 }, { year: null }, { year: 1980 }, { year: 1980 }]), -1);
  assert.equal(yearOrderBreak([{ year: 1990 }, { year: null }, { year: 1985 }]), 2);
});

// ---------------------------------------------------------------- placement

test('placement: dated at their year; between neighbours interpolated; 5 back before, 3 forward after', () => {
  const ms = [null, null, 1980, null, 2000, null, null].map((year) => ({ year, part: 1 }));
  const placed = placeYears(ms, () => 2026);
  assert.deepEqual(
    placed.map((p) => p.year),
    [1970, 1975, 1980, 1990, 2000, 2003, 2006],
  );
  assert.deepEqual(
    placed.map((p) => p.placement),
    ['interpolated', 'interpolated', 'stated', 'interpolated', 'stated', 'interpolated', 'interpolated'],
  );
});

test('placement: never past the interview year; no anchor counts back from the recording', () => {
  const capped = placeYears(
    [
      { year: 2020, part: 1 },
      { year: null, part: 1 },
      { year: null, part: 1 },
    ],
    () => 2021,
  );
  assert.deepEqual(
    capped.map((p) => p.year),
    [2020, 2021, 2021],
  );
  const none = placeYears(
    [
      { year: null, part: 1 },
      { year: null, part: 1 },
    ],
    () => 2026,
  );
  assert.deepEqual(
    none.map((p) => p.year),
    [2021, 2026],
  );
});

test('placement: moments sharing a year get small, symmetric offsets', () => {
  const xs = spreadSameYear([2020, 2020, 2020, 1990]);
  assert.equal(xs[3], 1990);
  assert.ok(xs[0] < xs[1] && xs[1] < xs[2]);
  assert.ok(Math.abs(xs[0] - 2020 + (xs[2] - 2020)) < 1e-9, 'centred on the year');
  assert.ok(Math.max(...xs.slice(0, 3)) - 2020 < 0.5, 'stays within the year');
});

// ---------------------------------------------------------------- events, overrides, model

const DEFS: EventDef[] = [
  { id: 'covid-19', name: 'COVID-19 pandemic', aliases: ['covid-19 pandemic'] },
  {
    id: 'ehr',
    name: 'Electronic health record rollout',
    aliases: ['electronic health record rollout', 'kp healthconnect (epic ehr) rollout'],
    on_question_list: true,
  },
  { id: 'crisis-1990s', name: '1990s KP financial crisis', aliases: ['1990s financial crisis'] },
  { id: 'crisis-2008', name: '2008 financial crisis', aliases: ['lehman brothers collapse'] },
];

test('events: synonyms merge case-insensitively; different events stay apart; unknown names get their own id', () => {
  const resolve = eventResolver(DEFS, {});
  assert.equal(resolve('KP HealthConnect (Epic EHR) rollout'), 'ehr');
  assert.equal(resolve('1990s financial crisis'), 'crisis-1990s');
  assert.equal(resolve('Lehman Brothers collapse'), 'crisis-2008');
  assert.equal(resolve('Fremont Hospital opens'), 'fremont-hospital-opens');
  assert.equal(
    eventResolver(DEFS, { events: { 'crisis-2008': { mergeInto: 'crisis-1990s' } } })('lehman brothers collapse'),
    'crisis-1990s',
  );
});

const meta = (slug: string): NarratorMeta => ({
  slug,
  name: slug,
  regions: [],
  cohort: '1980s',
  recordings: [{ part: 1, storyUuid: `uuid-${slug}`, recordYear: 2026 }],
});

const narrator = (slug: string, journey: RawMoment[], events: RawNarrator['events'] = []): RawNarrator => ({
  slug,
  narrator: slug,
  one_line: 'x',
  top_role: 'y',
  region: null,
  journey,
  events,
  retellable: [{ title: 't', summary: 's', t: 1, end: 2, part: 1, quote: 'q', why: 'w', sensitive: true }],
  questions_that_opened_things_up: [],
});

const covid = (t: number, type: 'asked_directly' | 'narrators_choice') => ({
  name: 'COVID-19 pandemic',
  year_start: 2020,
  year_end: null,
  year_basis: 'stated' as const,
  view: 'v',
  t,
  end: t + 5,
  part: 1,
  quote: 'q',
  prompt: { question: 'q', list_number: null, type },
  sensitive: false,
});

test('model: shared events, asked-directly counts, opposite feelings from tied moments, low-confidence lines', () => {
  const a = narrator(
    'a',
    [moment({ t: 1, year: 2010 }), moment({ t: 2, year: 2020, fortune: 3, event_ref: 'covid-19 pandemic' })],
    [covid(2, 'asked_directly')],
  );
  const b = narrator(
    'b',
    [
      moment({ t: 1, year: null, year_basis: 'unknown' }),
      moment({ t: 2, year: null, year_basis: 'unknown' }),
      moment({ t: 3, year: 2020, fortune: -2, event_ref: 'COVID-19 pandemic' }),
    ],
    [covid(3, 'narrators_choice')],
  );
  const model = buildModel([meta('a'), meta('b')], [a, b], DEFS, {}, null);
  const ev = model.events.find((e) => e.id === 'covid-19')!;
  assert.deepEqual(ev.narrators.sort(), ['a', 'b']);
  assert.equal(ev.askedDirectly, 1);
  assert.equal(ev.raisedByNarrator, 1);
  assert.equal(model.findings.oppositeFeelings[0]?.event, 'covid-19');
  assert.equal(model.findings.oppositeFeelings[0]?.spread, 5);
  assert.equal(model.narrators.find((n) => n.slug === 'b')!.lowConfidence, true, '2 of 3 points interpolated');
  assert.equal(model.narrators.find((n) => n.slug === 'a')!.lowConfidence, false);
  assert.equal(model.stories.length, 2, 'sensitive items are shown (internal recordings)');
  assert.ok(model.moments.every((m) => m.storyUuid.startsWith('uuid-')));
});

test('overrides: label, year, fortune, hiding, moving a mention, bands; applied last', () => {
  const a = narrator(
    'a',
    [moment({ t: 1, year: null, year_basis: 'unknown' }), moment({ t: 2, year: 2020 })],
    [covid(2, 'asked_directly')],
  );
  const overrides: Overrides = {
    moments: {
      'a-m-1-1': { year: 2001, label: 'Edited', fortune: -1 },
      'a-m-1-2': { review_status: 'hidden' },
    },
    eventMentions: { 'a-e-1-2': { event: 'Electronic health record rollout' } },
    stories: { 'a-s-1-1': { review_status: 'hidden' } },
    bands: ['ehr'],
  };
  const model = buildModel([meta('a')], [a], DEFS, overrides, null);
  assert.equal(model.moments.length, 1, 'hidden moment removed');
  const m = model.moments[0];
  assert.deepEqual([m.label, m.year, m.fortune, m.placement], ['Edited', 2001, -1, 'stated']);
  assert.equal(model.mentions[0].event, 'ehr');
  assert.equal(model.stories.length, 0);
  assert.deepEqual(
    model.bands.map((b) => b.event),
    ['ehr'],
  );
});

test('bands: most narrators first, a year range of 10 years or less, no overlaps, in time order', () => {
  const ev = (id: string, n: number, s: number | null, e: number | null) => ({
    id,
    name: id,
    yearStart: s,
    yearEnd: e,
    narrators: Array.from({ length: n }, (_, i) => `n${i}`),
    mentions: [],
    askedDirectly: 0,
    raisedByNarrator: 0,
    onQuestionList: false,
    feltAtTime: [],
  });
  const picked = proposeBands([
    ev('ehr', 12, 1995, 2006),
    ev('covid', 9, 2019, 2021),
    ev('crisis', 8, 1995, 1998),
    ev('fed', 6, 1996, 1998),
    ev('tahoe', 7, 1955, 1955),
    ev('hiv', 2, null, null),
  ]);
  assert.deepEqual(
    picked.map((e) => e.id),
    ['tahoe', 'crisis', 'covid'],
  );
});

test('findings: a shared low needs 3 narrators at −2 or lower within 4 years', () => {
  const low = (slug: string, year: number) => narrator(slug, [moment({ t: 1, year, fortune: -2 })]);
  const three = buildModel(['a', 'b', 'c'].map(meta), [low('a', 1995), low('b', 1997), low('c', 1998)], DEFS, {}, null);
  assert.equal(three.findings.sharedLows.length, 1);
  assert.deepEqual(three.findings.sharedLows[0].narrators.sort(), ['a', 'b', 'c']);
  const spread = buildModel(
    ['a', 'b', 'c'].map(meta),
    [low('a', 1990), low('b', 1995), low('c', 2000)],
    DEFS,
    {},
    null,
  );
  assert.equal(spread.findings.sharedLows.length, 0);
  assert.equal(three.findings.personalLows.length, 3, 'lows not tied to a shared event are personal');
});

// ----------------------------------------------------------------

let failures = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures++;
    console.log(`FAIL ${name}`);
    console.log(error);
  }
}
console.log(`\n${tests.length - failures}/${tests.length} passed`);
process.exit(failures ? 1 : 0);
