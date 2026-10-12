/**
 * Journeys & canon model: placing each narrator's journey moments in time, canonicalizing events
 * across narrators, shared events, event bands and computed findings. Pure, so the build script,
 * the page and the unit tests share it.
 */

export type YearBasis = 'stated' | 'inferred_from_transcript' | 'unknown';
export type Placement = 'stated' | 'inferred' | 'interpolated';
export type PromptType = 'asked_directly' | 'narrators_choice' | 'follow_up';
export type ReviewStatus = 'draft' | 'reviewed' | 'hidden';

export type Clip = { part: number; t: number; end: number; storyUuid: string };

export type RawMoment = {
  t: number;
  end: number;
  part: number;
  year: number | null;
  year_basis: YearBasis;
  year_note?: string;
  stage: string;
  label: string;
  fortune: number;
  fortune_basis: string;
  quote: string;
  event_ref: string | null;
  sensitive: boolean;
};

export type RawEvent = {
  name: string;
  year_start: number | null;
  year_end: number | null;
  year_basis: YearBasis;
  year_note?: string;
  view: string;
  t: number;
  end: number;
  part: number;
  quote: string;
  prompt: { question: string; list_number: string | null; type: PromptType };
  sensitive: boolean;
};

export type RawStory = {
  title: string;
  summary: string;
  t: number;
  end: number;
  part: number;
  quote: string;
  why: string;
  sensitive: boolean;
};
export type RawQuestion = {
  t: number;
  end: number;
  part: number;
  question: string;
  source: string;
  list_number: string | null;
  why: string;
  sensitive: boolean;
};

export type RawNarrator = {
  slug: string;
  narrator: string;
  one_line: string;
  top_role: string;
  region: string | null;
  journey: RawMoment[];
  events: RawEvent[];
  retellable: RawStory[];
  questions_that_opened_things_up: RawQuestion[];
};

export type NarratorMeta = {
  slug: string;
  name: string;
  regions: string[];
  cohort: string;
  recordings: { part: number; storyUuid: string; recordYear: number | null }[];
};

export type EventDef = { id: string; name: string; aliases: string[]; on_question_list?: boolean };

export type Overrides = {
  moments?: Record<
    string,
    { label?: string; year?: number | null; stage?: string; fortune?: number; review_status?: ReviewStatus }
  >;
  eventMentions?: Record<string, { event?: string; review_status?: ReviewStatus }>;
  events?: Record<string, { name?: string; mergeInto?: string }>;
  stories?: Record<string, { review_status?: ReviewStatus }>;
  questions?: Record<string, { review_status?: ReviewStatus }>;
  bands?: string[] | null;
  featuredStories?: string[];
};

export type Moment = Omit<RawMoment, 'event_ref'> & {
  id: string;
  narrator: string;
  storyUuid: string;
  /** Position on the time axis: the year plus a small offset when several share a year. */
  x: number;
  /** The year shown (stated, inferred or interpolated). */
  placedYear: number;
  placement: Placement;
  event: string | null;
  review_status: ReviewStatus;
};

export type EventMention = Omit<RawEvent, 'name'> & {
  id: string;
  narrator: string;
  storyUuid: string;
  rawName: string;
  event: string;
  review_status: ReviewStatus;
};

export type CanonEvent = {
  id: string;
  name: string;
  yearStart: number | null;
  yearEnd: number | null;
  narrators: string[];
  mentions: string[];
  askedDirectly: number;
  raisedByNarrator: number;
  onQuestionList: boolean;
  /** Each narrator's moments at the time: tied to the event, or placed within its years. */
  feltAtTime: { narrator: string; moments: string[] }[];
};

/** Events at most this many years long count as "a moment in time" for nearby journey points. */
export const NEAR_MAX_SPAN = 3;

export const momentId = (slug: string, part: number, t: number) => `${slug}-m-${part}-${Math.round(t)}`;
export const itemId = (slug: string, kind: 'e' | 's' | 'q', part: number, t: number) =>
  `${slug}-${kind}-${part}-${Math.round(t)}`;

// ---------------------------------------------------------------- time placement

/** Years stepped back per moment before a narrator's first dated moment, and forward after the last. */
export const STEP_BEFORE = 5;
export const STEP_AFTER = 3;

/**
 * Place a journey (in life order) on the time axis. Dated moments sit at their year. Undated ones are
 * interpolated between their dated neighbours; before the first dated moment they step back
 * STEP_BEFORE years each, after the last forward STEP_AFTER each, never past the recording's year.
 */
export function placeYears(
  moments: { year: number | null; part: number }[],
  capFor: (part: number) => number | null,
): { year: number; placement: Placement }[] {
  const dated = moments.map((m, i) => (m.year !== null ? i : -1)).filter((i) => i >= 0);
  const out = moments.map((m) => ({
    year: m.year ?? NaN,
    placement: (m.year !== null ? 'stated' : 'interpolated') as Placement,
  }));
  const cap = (i: number, y: number) => {
    const c = capFor(moments[i].part);
    return c === null ? y : Math.min(c, y);
  };

  if (dated.length === 0) {
    // No anchor at all: count back from the recording year.
    const last = moments.length - 1;
    const end = capFor(moments[last]?.part ?? 1) ?? new Date().getFullYear();
    moments.forEach((_, i) => (out[i].year = end - STEP_BEFORE * (last - i)));
    return out;
  }
  const first = dated[0];
  const lastDated = dated[dated.length - 1];
  for (let i = 0; i < first; i++) out[i].year = moments[first].year! - STEP_BEFORE * (first - i);
  for (let i = lastDated + 1; i < moments.length; i++)
    out[i].year = cap(i, moments[lastDated].year! + STEP_AFTER * (i - lastDated));
  for (let k = 0; k < dated.length - 1; k++) {
    const a = dated[k];
    const b = dated[k + 1];
    const ya = moments[a].year!;
    const yb = moments[b].year!;
    for (let i = a + 1; i < b; i++) out[i].year = ya + ((yb - ya) * (i - a)) / (b - a);
  }
  return out.map((o) => ({ ...o, year: Math.round(o.year * 10) / 10 }));
}

/** Spread moments that share a (rounded) year so their points don't overlap. */
export function spreadSameYear(years: number[], width = 0.36): number[] {
  const groups = new Map<number, number[]>();
  years.forEach((y, i) => {
    const key = Math.round(y);
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  const xs = [...years];
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    idx.forEach((i, k) => (xs[i] = years[i] + (k - (idx.length - 1) / 2) * (width / Math.max(1, idx.length - 1)) * 2));
  }
  return xs;
}

// ---------------------------------------------------------------- events

/** name or alias -> canonical id, after overrides' event merges. Unknown names get their own id. */
export function eventResolver(defs: EventDef[], overrides: Overrides) {
  const map = new Map<string, string>();
  for (const d of defs) {
    map.set(norm(d.name), d.id);
    map.set(d.id, d.id);
    for (const a of d.aliases) map.set(norm(a), d.id);
  }
  const follow = (id: string) => {
    let current = id;
    const seen = new Set<string>();
    while (!seen.has(current) && overrides.events?.[current]?.mergeInto) {
      seen.add(current);
      current = overrides.events[current].mergeInto!;
    }
    return current;
  };
  return (name: string) => follow(map.get(norm(name)) ?? slugify(name));
}

const norm = (s: string) => s.trim().toLowerCase();
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ---------------------------------------------------------------- build

export type Model = {
  narrators: (NarratorMeta & {
    one_line: string;
    top_role: string;
    lowConfidence: boolean;
    interpolated: number;
    points: number;
  })[];
  moments: Moment[];
  mentions: EventMention[];
  events: CanonEvent[];
  stories: (RawStory & {
    id: string;
    narrator: string;
    storyUuid: string;
    review_status: ReviewStatus;
    featured: boolean;
  })[];
  questions: (RawQuestion & { id: string; narrator: string; storyUuid: string; review_status: ReviewStatus })[];
  bands: { event: string; name: string; yearStart: number; yearEnd: number }[];
  findings: Findings;
  yearRange: [number, number];
};

export function buildModel(
  metas: NarratorMeta[],
  raw: RawNarrator[],
  defs: EventDef[],
  overrides: Overrides,
  bandIds: string[] | null,
): Model {
  const resolve = eventResolver(defs, overrides);
  const defById = new Map(defs.map((d) => [d.id, d]));
  const uuidFor = (meta: NarratorMeta, part: number) => meta.recordings.find((r) => r.part === part)?.storyUuid ?? '';
  const status = (s?: ReviewStatus): ReviewStatus => s ?? 'draft';

  const moments: Moment[] = [];
  const mentions: EventMention[] = [];
  const stories: Model['stories'] = [];
  const questions: Model['questions'] = [];
  const narrators: Model['narrators'] = [];

  for (const meta of metas) {
    const data = raw.find((r) => r.slug === meta.slug);
    if (!data) continue;
    const capFor = (part: number) => meta.recordings.find((r) => r.part === part)?.recordYear ?? null;

    // Overrides first: an edited year or visibility changes placement.
    const journey = data.journey
      .map((m) => {
        const id = momentId(meta.slug, m.part, m.t);
        const o = overrides.moments?.[id] ?? {};
        const year = o.year !== undefined ? o.year : m.year;
        return {
          raw: m,
          id,
          o,
          year,
          basis: (o.year !== undefined ? (o.year === null ? 'unknown' : 'stated') : m.year_basis) as YearBasis,
        };
      })
      .filter((m) => status(m.o.review_status) !== 'hidden');
    const placed = placeYears(
      journey.map((m) => ({ year: m.year, part: m.raw.part })),
      capFor,
    );
    const xs = spreadSameYear(placed.map((p) => p.year));
    let interpolated = 0;
    journey.forEach((m, i) => {
      const placement: Placement =
        m.year === null ? 'interpolated' : m.basis === 'inferred_from_transcript' ? 'inferred' : 'stated';
      if (placement === 'interpolated') interpolated++;
      const { event_ref, ...rest } = m.raw;
      moments.push({
        ...rest,
        year: m.year,
        year_basis: m.basis,
        label: m.o.label ?? m.raw.label,
        stage: m.o.stage ?? m.raw.stage,
        fortune: m.o.fortune ?? m.raw.fortune,
        id: m.id,
        narrator: meta.slug,
        storyUuid: uuidFor(meta, m.raw.part),
        x: Math.round(xs[i] * 100) / 100,
        placedYear: Math.round(placed[i].year),
        placement,
        event: event_ref ? resolve(event_ref) : null,
        review_status: status(m.o.review_status),
      });
    });
    narrators.push({
      ...meta,
      one_line: data.one_line,
      top_role: data.top_role,
      points: journey.length,
      interpolated,
      lowConfidence: interpolated > journey.length / 2,
    });

    for (const e of data.events) {
      const id = itemId(meta.slug, 'e', e.part, e.t);
      const o = overrides.eventMentions?.[id] ?? {};
      if (status(o.review_status) === 'hidden') continue;
      const { name, ...rest } = e;
      mentions.push({
        ...rest,
        id,
        narrator: meta.slug,
        storyUuid: uuidFor(meta, e.part),
        rawName: name,
        event: o.event ? resolve(o.event) : resolve(name),
        review_status: status(o.review_status),
      });
    }
    const featured = new Set(overrides.featuredStories ?? []);
    for (const s of data.retellable) {
      const id = itemId(meta.slug, 's', s.part, s.t);
      const st = status(overrides.stories?.[id]?.review_status);
      if (st === 'hidden') continue;
      stories.push({
        ...s,
        id,
        narrator: meta.slug,
        storyUuid: uuidFor(meta, s.part),
        review_status: st,
        featured: featured.has(id),
      });
    }
    for (const q of data.questions_that_opened_things_up) {
      const id = itemId(meta.slug, 'q', q.part, q.t);
      const st = status(overrides.questions?.[id]?.review_status);
      if (st === 'hidden') continue;
      questions.push({ ...q, id, narrator: meta.slug, storyUuid: uuidFor(meta, q.part), review_status: st });
    }
  }

  // Canonical events from mentions, plus journey moments tied to them.
  const byEvent = new Map<string, EventMention[]>();
  for (const m of mentions) byEvent.set(m.event, [...(byEvent.get(m.event) ?? []), m]);
  for (const mo of moments) if (mo.event && !byEvent.has(mo.event)) byEvent.set(mo.event, []);

  const events: CanonEvent[] = [...byEvent.entries()].map(([id, ms]) => {
    const tied = moments.filter((m) => m.event === id);
    const narratorSet = new Set([...ms.map((m) => m.narrator), ...tied.map((m) => m.narrator)]);
    const starts = [...ms.map((m) => m.year_start), ...tied.map((m) => m.year)].filter((y): y is number => y !== null);
    const ends = [...ms.map((m) => m.year_end ?? m.year_start), ...tied.map((m) => m.year)].filter(
      (y): y is number => y !== null,
    );
    const yearStart = starts.length ? Math.min(...starts) : null;
    const yearEnd = ends.length ? Math.max(...ends) : null;
    const name = overrides.events?.[id]?.name ?? defById.get(id)?.name ?? ms[0]?.rawName ?? id;
    // "At the time": moments tied to the event, plus moments placed inside it when the event is short
    // enough to be a moment in time (a decade-long rollout would sweep in unrelated moments).
    const short = yearStart !== null && (yearEnd ?? yearStart) - yearStart <= NEAR_MAX_SPAN;
    const feltAtTime = [...narratorSet].map((narrator) => ({
      narrator,
      moments: moments
        .filter(
          (m) =>
            m.narrator === narrator &&
            (m.event === id || (short && m.x >= yearStart! - 0.5 && m.x <= (yearEnd ?? yearStart!) + 0.5)),
        )
        .map((m) => m.id),
    }));
    return {
      id,
      name,
      yearStart,
      yearEnd,
      narrators: [...narratorSet],
      mentions: ms.map((m) => m.id),
      askedDirectly: ms.filter((m) => m.prompt.type === 'asked_directly').length,
      raisedByNarrator: ms.filter((m) => m.prompt.type !== 'asked_directly').length,
      onQuestionList: Boolean(defById.get(id)?.on_question_list),
      feltAtTime,
    };
  });
  events.sort(
    (a, b) =>
      b.narrators.length - a.narrators.length || b.mentions.length - a.mentions.length || a.name.localeCompare(b.name),
  );

  const shared = events.filter((e) => e.narrators.length >= 2);
  const bandList = (overrides.bands ?? bandIds ?? proposeBands(shared).map((e) => e.id))
    .map((id) => events.find((e) => e.id === id))
    .filter((e): e is CanonEvent => !!e && e.yearStart !== null)
    .map((e) => ({ event: e.id, name: e.name, yearStart: e.yearStart!, yearEnd: e.yearEnd ?? e.yearStart! }));

  const xs = moments.map((m) => m.x);
  const recordYears = metas.flatMap((m) => m.recordings.map((r) => r.recordYear ?? 0)).filter(Boolean);
  const yearRange: [number, number] = [
    Math.floor(Math.min(...xs, ...bandList.map((b) => b.yearStart))),
    Math.max(...recordYears, ...xs.map(Math.ceil)),
  ];

  const model: Model = {
    narrators,
    moments,
    mentions,
    events,
    stories,
    questions,
    bands: bandList,
    findings: emptyFindings(),
    yearRange,
  };
  model.findings = computeFindings(model);
  return model;
}

/** Up to four shared events with a year range, most narrators first, not overlapping each other. */
export function proposeBands(shared: CanonEvent[], max = 4): CanonEvent[] {
  const picked: CanonEvent[] = [];
  for (const e of [...shared].sort((a, b) => b.narrators.length - a.narrators.length)) {
    if (e.yearStart === null || picked.length >= max) continue;
    const end = e.yearEnd ?? e.yearStart;
    // A band spanning more than a decade isn't a moment in time.
    if (end - e.yearStart > 10) continue;
    if (picked.some((p) => e.yearStart! <= (p.yearEnd ?? p.yearStart!) && end >= p.yearStart!)) continue;
    picked.push(e);
  }
  return picked.sort((a, b) => a.yearStart! - b.yearStart!);
}

// ---------------------------------------------------------------- findings

export type Findings = {
  sharedLows: { from: number; to: number; narrators: string[]; moments: string[] }[];
  oppositeFeelings: { event: string; spread: number; high: string; low: string }[];
  personalLows: { narrator: string; moment: string }[];
  promptedEvents: { event: string; mentions: number; askedDirectly: number }[];
};

const emptyFindings = (): Findings => ({ sharedLows: [], oppositeFeelings: [], personalLows: [], promptedEvents: [] });

export const LOW = -2;
export const LOW_WINDOW = 4;

export function computeFindings(model: Pick<Model, 'moments' | 'events' | 'narrators'>): Findings {
  const visible = model.moments.filter((m) => m.review_status !== 'hidden');
  const lows = visible.filter((m) => m.fortune <= LOW);

  // Shared lows: 4-year windows with lows from 3+ narrators; overlapping windows merge.
  const windows: Findings['sharedLows'] = [];
  const years = [...new Set(lows.map((m) => Math.floor(m.x)))].sort((a, b) => a - b);
  for (const start of years) {
    const inWindow = lows.filter((m) => m.x >= start && m.x < start + LOW_WINDOW);
    const narrators = [...new Set(inWindow.map((m) => m.narrator))];
    if (narrators.length < 3) continue;
    const last = windows[windows.length - 1];
    if (last && start <= last.to) {
      last.to = Math.max(last.to, start + LOW_WINDOW - 1);
      for (const n of narrators) if (!last.narrators.includes(n)) last.narrators.push(n);
      for (const m of inWindow) if (!last.moments.includes(m.id)) last.moments.push(m.id);
    } else {
      windows.push({ from: start, to: start + LOW_WINDOW - 1, narrators, moments: inWindow.map((m) => m.id) });
    }
  }

  // Same event, opposite feeling: shared events where narrators' scores near it differ by 4+.
  const byId = new Map(visible.map((m) => [m.id, m]));
  const oppositeFeelings: Findings['oppositeFeelings'] = [];
  for (const e of model.events.filter((ev) => ev.narrators.length >= 2)) {
    const perNarrator = e.feltAtTime
      .map((f) => {
        // Only moments the narrator ties to the event themselves: a moment that merely falls in its
        // years may be about something else entirely.
        const pick = f.moments.map((id) => byId.get(id)).find((m): m is Moment => !!m && m.event === e.id);
        return pick ? { narrator: f.narrator, moment: pick } : null;
      })
      .filter((x): x is { narrator: string; moment: Moment } => !!x);
    if (perNarrator.length < 2) continue;
    const high = perNarrator.reduce((a, b) => (b.moment.fortune > a.moment.fortune ? b : a));
    const low = perNarrator.reduce((a, b) => (b.moment.fortune < a.moment.fortune ? b : a));
    const spread = high.moment.fortune - low.moment.fortune;
    if (spread >= 4) oppositeFeelings.push({ event: e.id, spread, high: high.moment.id, low: low.moment.id });
  }
  oppositeFeelings.sort((a, b) => b.spread - a.spread);

  // Personal lows: a narrator's lowest point that isn't tied to a shared event.
  const sharedIds = new Set(model.events.filter((e) => e.narrators.length >= 2).map((e) => e.id));
  const personalLows: Findings['personalLows'] = [];
  for (const n of model.narrators) {
    const own = visible.filter((m) => m.narrator === n.slug);
    if (!own.length) continue;
    const lowest = own.reduce((a, b) => (b.fortune < a.fortune ? b : a));
    if (lowest.fortune < 0 && !(lowest.event && sharedIds.has(lowest.event)))
      personalLows.push({ narrator: n.slug, moment: lowest.id });
  }

  const promptedEvents = model.events
    .filter((e) => e.narrators.length >= 2)
    .slice(0, 5)
    .map((e) => ({ event: e.id, mentions: e.mentions.length, askedDirectly: e.askedDirectly }));

  return { sharedLows: windows, oppositeFeelings, personalLows, promptedEvents };
}
