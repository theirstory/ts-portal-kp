/**
 * Unit tests for the system map: yarn system-map:test
 * Quote matching, clip boundaries, excluded segments, claim validation, canonicalization,
 * overrides, edges, contradictions, filtering and layout. No transcripts or network needed.
 */
import assert from 'node:assert/strict';
import type { Paragraph } from '../portal-sync/transcript';
import { clipBounds, findInParagraph, matchQuote, overlapsExcluded, quoteWordCount } from '../lib/narratives/quotes';
import { buildClaims, buildEdges, factorResolver, findContradictions, resolveFactors } from '@/lib/system-map/model';
import type { FactorDef, NarratorInfo, Overrides, RawClaim } from '@/lib/system-map/model';
import { edgeShape, edgesFor, edgeWidth, findings, layoutMap, visibleClaims } from '@/lib/system-map/view';
import type { MapFactor, MapNarrator } from '@/lib/system-map/view';
import { checkClaimShape } from './verify';

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

/** Paragraphs from [speaker, text, startSeconds]; words one second apart. */
function paragraphs(spec: [string, string, number][]): Paragraph[] {
  return spec.map(([speaker, text, start], index) => {
    const words = text.split(' ').map((w, i) => ({ text: w, start: start + i, end: start + i + 0.8 }));
    return { index, speaker, start, end: words[words.length - 1].end, words };
  });
}

const P = paragraphs([
  ['Interviewer', 'How does integrated care help patients?', 0],
  ['Narrator', 'I think, um, integrated care is what drives our quality. It really does.', 100],
  ['Narrator', 'And the financial crisis eroded trust between the plan and the groups.', 140],
  ['Narrator', 'Much later, culture came up again.', 600],
]);

// ---------------------------------------------------------------- quotes

test('quotes: exact substring matches; clip bounds come from the first and last quoted words', () => {
  const m = matchQuote(P, 'integrated care is what drives our quality.', 100);
  assert.ok(m);
  assert.equal(m.start, 103); // "integrated" is the 4th word of the paragraph at 100
  assert.equal(m.end, 109.8); // "quality." ends at 109 + 0.8
});

test('quotes: case, punctuation and paraphrase must match exactly', () => {
  assert.equal(matchQuote(P, 'Integrated care is what drives our quality.', 100), null);
  assert.equal(matchQuote(P, 'I think integrated care is what drives our quality.', 100), null, 'filler dropped');
  assert.equal(matchQuote(P, 'integrated care drives our quality.', 100), null, 'paraphrase');
  assert.ok(matchQuote(P, 'I think, um, integrated care', 100), 'disfluencies kept verbatim pass');
});

test('quotes: word boundaries — may stop before trailing punctuation, never mid-word', () => {
  assert.ok(matchQuote(P, 'drives our quality', 100), 'trailing "." may be left off');
  assert.equal(matchQuote(P, 'ntegrated care', 100), null, 'starts mid-word');
  assert.equal(matchQuote(P, 'drives our qual', 100), null, 'ends mid-word');
  assert.deepEqual(findInParagraph(P[1], 'quality.'), [[9, 9]]);
});

test('quotes: "..." joins verbatim segments in order, across paragraphs', () => {
  const m = matchQuote(P, 'integrated care is what drives our quality. ... the financial crisis eroded trust', 100);
  assert.ok(m);
  assert.equal(m.start, 103);
  assert.equal(m.end, 145.8); // "trust" in the paragraph at 140, 30 s after "quality."
  assert.equal(matchQuote(P, 'the financial crisis eroded trust ... integrated care', 100), null, 'out of order');
  assert.equal(matchQuote(P, 'integrated care ... culture came up again.', 100), null, 'too far apart');
  assert.equal(quoteWordCount('a b ... c d e'), 5);
});

test('quotes: must start in the paragraph containing t or within 180 s after it', () => {
  assert.ok(matchQuote(P, 'the financial crisis eroded trust', 110), 'next paragraph, 30 s later');
  assert.ok(matchQuote(P, 'I think, um,', 105), 't inside the paragraph, quote at its start');
  assert.equal(matchQuote(P, 'culture came up again.', 100), null, '500 s after t');
  assert.equal(matchQuote(P, 'How does integrated care', 100), null, 'before t');
});

test('clip bounds: start floored and end ceiled to the centisecond, never cutting a word', () => {
  assert.deepEqual(clipBounds(7192.07644, 7201.756), { t: 7192.07, end: 7201.76 });
  assert.deepEqual(clipBounds(10, 12.5), { t: 10, end: 12.5 });
});

test('excluded segments: any overlap counts', () => {
  const spans = [{ start: 4090, end: 4362 }];
  assert.equal(overlapsExcluded(4100, 4110, spans), true);
  assert.equal(overlapsExcluded(4080, 4095, spans), true, 'starts before, runs in');
  assert.equal(overlapsExcluded(4362, 4370, spans), false, 'touching the end is outside');
  assert.equal(overlapsExcluded(1000, 1010, spans), false);
});

test('claim validation: enums, parts, word limit, prompt', () => {
  const ok = {
    from: 'integrated care',
    to: 'quality',
    polarity: '+',
    explicitness: 'explicit',
    part: 1,
    t: 100,
    quote: 'drives our quality',
    prompt: { question: 'q', list_number: 'Q24', type: 'asked_directly' },
  };
  const parts = new Set([1]);
  assert.equal(checkClaimShape(ok, parts), null);
  assert.match(checkClaimShape({ ...ok, polarity: 'x' }, parts)!, /polarity/);
  assert.match(checkClaimShape({ ...ok, explicitness: 'maybe' }, parts)!, /explicitness/);
  assert.match(checkClaimShape({ ...ok, part: 2 }, parts)!, /part 2/);
  assert.match(checkClaimShape({ ...ok, from: 'Quality', to: 'quality' }, parts)!, /same factor/);
  assert.match(checkClaimShape({ ...ok, prompt: { ...ok.prompt, list_number: '17' } }, parts)!, /list_number/);
  assert.match(checkClaimShape({ ...ok, prompt: { ...ok.prompt, type: 'asked' } }, parts)!, /prompt.type/);
  assert.match(checkClaimShape({ ...ok, quote: Array(36).fill('w').join(' ') }, parts)!, /36 words/);
});

// ---------------------------------------------------------------- model

const FACTORS: FactorDef[] = [
  { name: 'integrated care', column: 'structure', definition: 'd', valence: 0, aliases: ['care coordination'] },
  { name: 'quality', column: 'outcome', definition: 'd', valence: 0, aliases: [] },
  { name: 'culture', column: 'people', definition: 'd', valence: 0, aliases: ['mission', 'collegiality'] },
  { name: 'burnout', column: 'people', definition: 'd', valence: -1, aliases: ['administrative burden'] },
  { name: 'data & technology', column: 'pressure', definition: 'd', valence: 0, aliases: [] },
  { name: 'trust', column: 'people', definition: 'd', valence: 0, aliases: [] },
];

const narrator = (slug: string, cohort = '1980s'): NarratorInfo => ({
  slug,
  name: slug,
  regions: [slug === 'a' ? 'Colorado' : 'Georgia'],
  cohort,
  recordings: [{ part: 1, storyUuid: `uuid-${slug}` }],
});

const raw = (
  from: string,
  to: string,
  polarity: '+' | '-',
  t: number,
  type: RawClaim['prompt']['type'] = 'narrators_choice',
): RawClaim => ({
  from,
  to,
  polarity,
  t,
  end: t + 5,
  part: 1,
  quote: 'q',
  explicitness: 'explicit',
  prompt: { question: 'q', list_number: null, type },
});

test('canonicalization: aliases resolve case-insensitively; unknown names pass through lowercased', () => {
  const resolve = factorResolver(FACTORS, {});
  assert.equal(resolve('Care Coordination'), 'integrated care');
  assert.equal(resolve('mission'), 'culture');
  assert.equal(resolve('Something New'), 'something new');
});

test('overrides: renames and merge chains apply after aliases; moves change the column', () => {
  const overrides: Overrides = {
    renameFactors: { culture: 'organizational culture' },
    mergeFactors: { 'organizational culture': 'trust' },
    moveFactors: { burnout: 'pressure' },
  };
  const resolve = factorResolver(FACTORS, overrides);
  assert.equal(resolve('collegiality'), 'trust', 'alias -> culture -> renamed -> merged');
  const factors = resolveFactors(FACTORS, overrides);
  assert.equal(factors.find((f) => f.name === 'burnout')?.column, 'pressure');
  assert.equal(
    factors.some((f) => f.name === 'culture'),
    false,
  );
  assert.ok(factors.find((f) => f.name === 'trust')?.aliases.includes('culture'));
});

test('overrides: per-claim direction, polarity and hiding; review_status defaults to draft', () => {
  const overrides: Overrides = {
    claims: {
      'a-1-10': { polarity: '-', review_status: 'reviewed' },
      'a-1-20': { from: 'quality', to: 'integrated care' },
      'a-1-30': { review_status: 'hidden' },
    },
  };
  const claims = buildClaims(
    narrator('a'),
    [
      raw('integrated care', 'quality', '+', 10),
      raw('care coordination', 'quality', '+', 20),
      raw('mission', 'trust', '+', 30),
      raw('culture', 'trust', '+', 40),
    ],
    factorResolver(FACTORS, overrides),
    overrides,
  );
  assert.equal(claims[0].polarity, '-');
  assert.equal(claims[0].review_status, 'reviewed');
  assert.deepEqual([claims[1].from, claims[1].to], ['quality', 'integrated care']);
  assert.equal(claims[1].raw.from, 'care coordination', 'original kept for review');
  assert.equal(claims[2].review_status, 'hidden');
  assert.equal(claims[3].review_status, 'draft');
  assert.equal(claims[0].storyUuid, 'uuid-a');
  const edges = buildEdges(claims, new Map([['a', narrator('a')]]));
  assert.equal(
    edges.some((e) => e.claims.includes('a-1-30')),
    false,
    'hidden claims make no edge',
  );
});

test('edges: grouped by (from, to, polarity); narrators distinct; asked-directly counted; self-loops dropped', () => {
  const resolve = factorResolver(FACTORS, {});
  const claims = [
    ...buildClaims(
      narrator('a'),
      [raw('integrated care', 'quality', '+', 1, 'asked_directly'), raw('integrated care', 'quality', '+', 2)],
      resolve,
      {},
    ),
    ...buildClaims(
      narrator('b', 'before 1980'),
      [raw('care coordination', 'quality', '+', 3, 'asked_directly'), raw('mission', 'culture', '+', 4)],
      resolve,
      {},
    ),
  ];
  const edges = buildEdges(
    claims,
    new Map([
      ['a', narrator('a')],
      ['b', narrator('b', 'before 1980')],
    ]),
  );
  assert.equal(edges.length, 1, 'mission -> culture became a self-loop and is dropped');
  const [e] = edges;
  assert.deepEqual(e.narrators, ['a', 'b']);
  assert.equal(e.claimCount, 3);
  assert.equal(e.notAskedDirectly, 1);
  assert.deepEqual(e.regions.sort(), ['Colorado', 'Georgia']);
  assert.deepEqual(e.cohorts.sort(), ['1980s', 'before 1980']);
  assert.equal(edgeWidth(1), 1.3);
  assert.equal(edgeWidth(3), 1.3 + 3.8);
});

test('contradictions: opposite polarity on one link; mixed effects need 2 narrators a side', () => {
  const resolve = factorResolver(FACTORS, {});
  const make = (slug: string, claims: RawClaim[]) => buildClaims(narrator(slug), claims, resolve, {});
  const claims = [
    ...make('a', [raw('data & technology', 'burnout', '+', 1), raw('data & technology', 'quality', '+', 2)]),
    ...make('b', [raw('data & technology', 'burnout', '+', 1), raw('data & technology', 'quality', '+', 2)]),
    ...make('c', [raw('data & technology', 'burnout', '-', 1)]),
  ];
  const narrators = new Map(['a', 'b', 'c'].map((s) => [s, narrator(s)]));
  const found = findContradictions(buildEdges(claims, narrators), FACTORS);
  const opposite = found.find((c) => c.type === 'opposite');
  assert.ok(
    opposite && opposite.type === 'opposite' && opposite.from === 'data & technology' && opposite.to === 'burnout',
  );
  const mixed = found.find((c) => c.type === 'mixed');
  // good: +quality (a, b) and -burnout (c); bad: +burnout (a, b)
  assert.ok(mixed && mixed.type === 'mixed' && mixed.factor === 'data & technology');

  const one = findContradictions(
    buildEdges(
      make('a', [raw('data & technology', 'burnout', '+', 1), raw('data & technology', 'quality', '+', 2)]),
      narrators,
    ),
    FACTORS,
  );
  assert.equal(one.length, 0, 'one narrator on each side is not flagged as mixed');
});

// ---------------------------------------------------------------- view

const MAP_NARRATORS: MapNarrator[] = ['a', 'b'].map((s) => ({
  ...narrator(s),
  joined: 1985,
  recordings: [{ part: 1, storyId: s, storyUuid: `uuid-${s}`, title: s }],
}));

test('filters: narrators, hidden claims and asked-directly toggle', () => {
  const resolve = factorResolver(FACTORS, {});
  const claims = [
    ...buildClaims(
      narrator('a'),
      [raw('integrated care', 'quality', '+', 1, 'asked_directly'), raw('culture', 'quality', '+', 2)],
      resolve,
      {},
    ),
    ...buildClaims(narrator('b'), [raw('integrated care', 'quality', '+', 3)], resolve, {
      claims: { 'b-1-3': { review_status: 'hidden' } },
    }),
  ];
  assert.equal(visibleClaims(claims, { narrators: ['a', 'b'], includeAskedDirectly: true }).length, 2);
  assert.equal(visibleClaims(claims, { narrators: ['a', 'b'], includeAskedDirectly: false }).length, 1);
  assert.equal(visibleClaims(claims, { narrators: ['b'], includeAskedDirectly: true }).length, 0);
  const edges = edgesFor(visibleClaims(claims, { narrators: ['a'], includeAskedDirectly: true }), MAP_NARRATORS);
  assert.equal(edges.find((e) => e.from === 'integrated care')?.askedDirectlyOnly, true);
  assert.equal(edges.find((e) => e.from === 'culture')?.askedDirectlyOnly, false);
  assert.ok(findings(edges, [], claims).length >= 2);
});

test('layout: four columns left to right, pills evenly spaced, independent of narrator filters', () => {
  const factors: MapFactor[] = FACTORS.map((f) => ({ ...f, claimCount: 1 }));
  const edges = [{ from: 'integrated care', to: 'quality', narrators: ['a'] }];
  const measure = (s: string) => s.length * 7;
  const columns = ['pressure', 'structure', 'people', 'outcome'] as const;
  const a = layoutMap([...columns], factors, edges, measure);
  const b = layoutMap([...columns], factors, edges, measure);
  assert.deepEqual([...a.pills.entries()], [...b.pills.entries()], 'deterministic');
  const xs = columns.map((c) => a.columns.find((x) => x.column === c)!.x);
  assert.deepEqual(
    [...xs].sort((p, q) => p - q),
    xs,
    'columns ordered left to right',
  );
  const people = [...a.pills.values()]
    .filter((p) => p.column === 'people')
    .map((p) => p.y)
    .sort((p, q) => p - q);
  assert.equal(people.length, 3);
  assert.ok(Math.abs(people[1] - people[0] - (people[2] - people[1])) < 0.01, 'evenly spaced');
  for (const p of a.pills.values()) assert.ok(p.w >= measure(p.name), 'text fits its pill');
});

test('edge shapes: forward right-to-left edge, same-column loops, backward curves below', () => {
  const col = ['pressure', 'structure', 'people', 'outcome'] as const;
  const box = (column: (typeof col)[number], x: number, y: number) => ({ name: '', column, x, y, w: 100, h: 30 });
  const fwd = edgeShape(box('structure', 300, 100), box('outcome', 700, 200), [...col], 2);
  assert.match(fwd.d, /^M 400\.0 100\.0 C/, 'starts at the right edge of the source');
  assert.ok(fwd.head.startsWith('700.0,200.0'), 'arrow tip on the left edge of the target');
  const outcomeLoop = edgeShape(box('outcome', 700, 100), box('outcome', 700, 300), [...col], 2);
  const loopX = Number(outcomeLoop.d.split(' ')[4]);
  assert.ok(loopX < 700, 'rightmost column loops out to the left');
  const back = edgeShape(box('outcome', 700, 100), box('pressure', 20, 100), [...col], 2);
  const controlY = Number(back.d.split(' ')[5].replace(',', ''));
  assert.ok(controlY > 115, 'backward arrows curve below');
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
