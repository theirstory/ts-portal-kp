/**
 * Pure model building for the system map: canonical factor names, overrides, edges and the
 * contradictions worth showing. build.ts feeds it files; the unit tests feed it fixtures.
 */

export type Column = 'pressure' | 'structure' | 'people' | 'outcome';
export type Polarity = '+' | '-';
export type PromptType = 'asked_directly' | 'narrators_choice' | 'follow_up';
export type ReviewStatus = 'draft' | 'reviewed' | 'hidden';

export type FactorDef = { name: string; column: Column; definition: string; valence: number; aliases: string[] };

export type RawClaim = {
  from: string;
  to: string;
  polarity: Polarity;
  t: number;
  end: number;
  part: number;
  quote: string;
  explicitness: 'explicit' | 'implied';
  prompt: { question: string; list_number: string | null; type: PromptType };
};

export type ClaimOverride = Partial<Pick<RawClaim, 'from' | 'to' | 'polarity'>> & {
  review_status?: ReviewStatus;
  note?: string;
};

export type Overrides = {
  renameFactors?: Record<string, string>;
  mergeFactors?: Record<string, string>;
  moveFactors?: Record<string, Column>;
  claims?: Record<string, ClaimOverride>;
};

export type NarratorInfo = {
  slug: string;
  name: string;
  regions: string[];
  cohort: string;
  recordings: { part: number; storyUuid: string }[];
};

export type Claim = {
  id: string;
  narrator: string;
  part: number;
  storyUuid: string;
  t: number;
  end: number;
  quote: string;
  from: string;
  to: string;
  polarity: Polarity;
  explicitness: 'explicit' | 'implied';
  prompt: RawClaim['prompt'];
  review_status: ReviewStatus;
  /** The factor names as extracted, before canonicalization and overrides. */
  raw: { from: string; to: string; polarity: Polarity };
  note?: string;
};

export type Edge = {
  id: string;
  from: string;
  to: string;
  polarity: Polarity;
  narrators: string[];
  claims: string[];
  claimCount: number;
  /** Claims that were not answers to a question naming the topic. */
  notAskedDirectly: number;
  regions: string[];
  cohorts: string[];
};

export type Contradiction =
  // `narrators` is the smaller side's narrator count: how well-supported the disagreement is.
  | { type: 'opposite'; from: string; to: string; strengthens: string; undermines: string; narrators: number }
  | { type: 'mixed'; factor: string; good: string[]; bad: string[]; narrators: number };

/** Narrators needed on each side before a factor's effects are flagged as mixed. */
export const MIXED_MIN_NARRATORS = 2;

export const claimId = (slug: string, part: number, t: number) => `${slug}-${part}-${Math.round(t)}`;

export const edgeId = (from: string, to: string, polarity: Polarity) => `${from}|${polarity}|${to}`;

/** alias or canonical name -> canonical name, after overrides' renames and merges. */
export function factorResolver(factors: FactorDef[], overrides: Overrides) {
  const map = new Map<string, string>();
  for (const f of factors) {
    map.set(norm(f.name), f.name);
    for (const a of f.aliases) map.set(norm(a), f.name);
  }
  const follow = (name: string): string => {
    let current = name;
    const seen = new Set<string>();
    while (!seen.has(current)) {
      seen.add(current);
      const next = overrides.mergeFactors?.[current] ?? overrides.renameFactors?.[current];
      if (!next) break;
      current = next;
    }
    return current;
  };
  return (name: string): string => follow(map.get(norm(name)) ?? name.trim().toLowerCase());
}

const norm = (s: string) => s.trim().toLowerCase();

/** Canonical factor list after renames, merges and column moves. */
export function resolveFactors(factors: FactorDef[], overrides: Overrides): FactorDef[] {
  const resolve = factorResolver(factors, overrides);
  const out = new Map<string, FactorDef>();
  for (const f of factors) {
    const name = resolve(f.name);
    const existing = out.get(name);
    if (existing) {
      existing.aliases.push(f.name, ...f.aliases);
      continue;
    }
    // A rename keeps the definition; a merge target keeps its own (it is processed under its own name).
    const target = factors.find((x) => x.name === name);
    const base = target ?? f;
    out.set(name, { ...base, name, aliases: name === f.name ? [...f.aliases] : [f.name, ...f.aliases] });
  }
  for (const [name, column] of Object.entries(overrides.moveFactors ?? {})) {
    const f = out.get(resolve(name));
    if (f) f.column = column;
  }
  return [...out.values()];
}

/** Canonicalize one narrator's claims and apply claim overrides. Hidden claims are kept, marked. */
export function buildClaims(
  narrator: NarratorInfo,
  raw: RawClaim[],
  resolve: (name: string) => string,
  overrides: Overrides,
): Claim[] {
  return raw.map((c) => {
    const id = claimId(narrator.slug, c.part, c.t);
    const o = overrides.claims?.[id] ?? {};
    const storyUuid = narrator.recordings.find((r) => r.part === c.part)?.storyUuid ?? '';
    return {
      id,
      narrator: narrator.slug,
      part: c.part,
      storyUuid,
      t: c.t,
      end: c.end,
      quote: c.quote,
      from: resolve(o.from ?? c.from),
      to: resolve(o.to ?? c.to),
      polarity: o.polarity ?? c.polarity,
      explicitness: c.explicitness,
      prompt: c.prompt,
      review_status: o.review_status ?? 'draft',
      raw: { from: c.from, to: c.to, polarity: c.polarity },
      ...(o.note ? { note: o.note } : {}),
    };
  });
}

/** Group visible claims by (from, to, polarity). Self-loops created by merges are dropped. */
export function buildEdges(claims: Claim[], narrators: Map<string, NarratorInfo>): Edge[] {
  const edges = new Map<string, Edge>();
  for (const c of claims) {
    if (c.review_status === 'hidden' || c.from === c.to) continue;
    const id = edgeId(c.from, c.to, c.polarity);
    let e = edges.get(id);
    if (!e) {
      e = {
        id,
        from: c.from,
        to: c.to,
        polarity: c.polarity,
        narrators: [],
        claims: [],
        claimCount: 0,
        notAskedDirectly: 0,
        regions: [],
        cohorts: [],
      };
      edges.set(id, e);
    }
    e.claims.push(c.id);
    e.claimCount++;
    if (c.prompt.type !== 'asked_directly') e.notAskedDirectly++;
    if (!e.narrators.includes(c.narrator)) {
      e.narrators.push(c.narrator);
      const n = narrators.get(c.narrator);
      for (const r of n?.regions ?? []) if (!e.regions.includes(r)) e.regions.push(r);
      if (n && !e.cohorts.includes(n.cohort)) e.cohorts.push(n.cohort);
    }
  }
  return [...edges.values()].sort((a, b) => b.narrators.length - a.narrators.length || b.claimCount - a.claimCount);
}

/**
 * Tensions to show, not errors:
 *  - opposite: the same cause and effect, said to strengthen by some and undermine by others.
 *  - mixed: a factor said to push outcomes both ways — strengthening something good (or weakening
 *    something bad) and strengthening something bad (or weakening something good). Good/bad comes
 *    from factor valence; factors with valence 0 count as good.
 */
export function findContradictions(edges: Edge[], factors: FactorDef[]): Contradiction[] {
  const byId = new Map(edges.map((e) => [e.id, e]));
  const out: Contradiction[] = [];
  for (const e of edges) {
    if (e.polarity !== '+') continue;
    const other = byId.get(edgeId(e.from, e.to, '-'));
    if (other) {
      out.push({
        type: 'opposite',
        from: e.from,
        to: e.to,
        strengthens: e.id,
        undermines: other.id,
        narrators: Math.min(e.narrators.length, other.narrators.length),
      });
    }
  }
  const valence = new Map(factors.map((f) => [f.name, f.valence]));
  const bySource = new Map<string, Edge[]>();
  for (const e of edges) bySource.set(e.from, [...(bySource.get(e.from) ?? []), e]);
  for (const [factor, list] of bySource) {
    // Effect on "good": + to a good factor or - to a bad one is good; the reverse is bad.
    const good: Edge[] = [];
    const bad: Edge[] = [];
    for (const e of list) {
      const targetBad = (valence.get(e.to) ?? 0) < 0;
      const helps = (e.polarity === '+') !== targetBad;
      (helps ? good : bad).push(e);
    }
    // Both sides must rest on at least MIXED_MIN_NARRATORS narrators, so one stray claim
    // doesn't make a factor "mixed".
    const goodNarrators = new Set(good.flatMap((e) => e.narrators));
    const badNarrators = new Set(bad.flatMap((e) => e.narrators));
    if (goodNarrators.size >= MIXED_MIN_NARRATORS && badNarrators.size >= MIXED_MIN_NARRATORS) {
      out.push({
        type: 'mixed',
        factor,
        good: good.map((e) => e.id),
        bad: bad.map((e) => e.id),
        narrators: Math.min(goodNarrators.size, badNarrators.size),
      });
    }
  }
  return out.sort((a, b) => b.narrators - a.narrators);
}
