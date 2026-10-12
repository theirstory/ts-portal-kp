/**
 * Everything the /system page derives from the built model: which claims are in view under the
 * current filters, the edges and contradictions they form, a stable column layout, curved edge
 * geometry and the computed findings. Pure, so the unit tests exercise it directly.
 */
import { buildEdges, edgeId, findContradictions } from './model';
import type { Claim, Column, Contradiction, Edge, FactorDef, NarratorInfo } from './model';

export type MapNarrator = NarratorInfo & {
  joined: number | null;
  recordings: { part: number; storyId: string; storyUuid: string; title: string }[];
};

export type MapFactor = Pick<FactorDef, 'name' | 'column' | 'definition' | 'valence'> & { claimCount: number };

/** The slice of model.json the page ships to the browser. */
export type MapModel = {
  columns: Column[];
  narrators: MapNarrator[];
  factors: MapFactor[];
  claims: Claim[];
};

export type Filters = {
  narrators: string[];
  includeAskedDirectly: boolean;
};

export const COLUMN_LABELS: Record<Column, string> = {
  pressure: 'Pressures',
  structure: 'Structure',
  people: 'People & culture',
  outcome: 'Outcomes',
};

/** Claims shown under the filters: selected narrators, not hidden, asked-directly optional. */
export function visibleClaims(claims: Claim[], filters: Filters): Claim[] {
  const narrators = new Set(filters.narrators);
  return claims.filter(
    (c) =>
      c.review_status !== 'hidden' &&
      narrators.has(c.narrator) &&
      (filters.includeAskedDirectly || c.prompt.type !== 'asked_directly'),
  );
}

export type ViewEdge = Edge & {
  /** Every claim behind it answered a question that named the topic. */
  askedDirectlyOnly: boolean;
};

export function edgesFor(claims: Claim[], narrators: MapNarrator[]): ViewEdge[] {
  const byId = new Map(claims.map((c) => [c.id, c]));
  return buildEdges(claims, new Map(narrators.map((n) => [n.slug, n]))).map((e) => ({
    ...e,
    askedDirectlyOnly: e.claims.every((id) => byId.get(id)?.prompt.type === 'asked_directly'),
  }));
}

export function contradictionsFor(edges: Edge[], factors: MapFactor[]): Contradiction[] {
  return findContradictions(
    edges,
    factors.map((f) => ({ ...f, aliases: [] })),
  );
}

/**
 * Edges to highlight as disagreements: both sides of each opposite pair. Mixed-effect factors are
 * listed and selectable but not haloed: they span most of a factor's arrows and would flood the map.
 */
export function contradictionEdgeIds(contradictions: Contradiction[]): Set<string> {
  const ids = new Set<string>();
  for (const c of contradictions) {
    if (c.type !== 'opposite') continue;
    ids.add(c.strengthens);
    ids.add(c.undermines);
  }
  return ids;
}

/** Arrow stroke width: 1.3px plus 1.9px per narrator beyond the first. */
export const edgeWidth = (narrators: number) => 1.3 + 1.9 * Math.max(0, narrators - 1);

// ---------------------------------------------------------------- layout

export const PILL_HEIGHT = 30;
const PILL_PAD_X = 13;
const COLUMN_GAP = 104;
const ROW_SPACING = 52;
const TOP = 56;
const SIDE = 24;
/** Room below the last row for arrows that curve back underneath. */
const BOTTOM = 70;

export type PillBox = { name: string; column: Column; x: number; y: number; w: number; h: number };

export type Layout = {
  width: number;
  height: number;
  pills: Map<string, PillBox>;
  columns: { column: Column; x: number; width: number }[];
};

/**
 * Four columns, factors evenly spaced in each. Order within a column comes from a few barycentric
 * sweeps over `edges`, which cuts crossings; the result depends only on the factor set and edges
 * passed in, so filtering narrators (which only restyles edges) never moves a pill.
 */
export function layoutMap(
  columns: Column[],
  factors: MapFactor[],
  edges: { from: string; to: string; narrators: string[] }[],
  measure: (text: string) => number,
): Layout {
  const byColumn = new Map<Column, MapFactor[]>(columns.map((c) => [c, []]));
  for (const f of factors) byColumn.get(f.column)?.push(f);
  for (const list of byColumn.values())
    list.sort((a, b) => b.claimCount - a.claimCount || a.name.localeCompare(b.name));

  const order = new Map<string, number>();
  const reindex = () => {
    for (const list of byColumn.values()) list.forEach((f, i) => order.set(f.name, (i + 0.5) / list.length));
  };
  reindex();
  const neighbours = new Map<string, { other: string; weight: number }[]>();
  for (const e of edges) {
    const w = e.narrators.length;
    neighbours.set(e.from, [...(neighbours.get(e.from) ?? []), { other: e.to, weight: w }]);
    neighbours.set(e.to, [...(neighbours.get(e.to) ?? []), { other: e.from, weight: w }]);
  }
  for (let sweep = 0; sweep < 6; sweep++) {
    for (const list of byColumn.values()) {
      const score = new Map<string, number>();
      for (const f of list) {
        const ns = (neighbours.get(f.name) ?? []).filter((n) => order.has(n.other));
        const total = ns.reduce((s, n) => s + n.weight, 0);
        score.set(
          f.name,
          total ? ns.reduce((s, n) => s + order.get(n.other)! * n.weight, 0) / total : order.get(f.name)!,
        );
      }
      list.sort((a, b) => score.get(a.name)! - score.get(b.name)! || a.name.localeCompare(b.name));
    }
    reindex();
  }

  const rows = Math.max(1, ...[...byColumn.values()].map((l) => l.length));
  const bandHeight = rows * ROW_SPACING;
  const pills = new Map<string, PillBox>();
  const columnBoxes: Layout['columns'] = [];
  let x = SIDE;
  for (const column of columns) {
    const list = byColumn.get(column) ?? [];
    const widths = list.map((f) => Math.ceil(measure(f.name)) + PILL_PAD_X * 2);
    const width = Math.max(120, ...widths);
    list.forEach((f, i) => {
      const y = TOP + ((i + 0.5) * bandHeight) / list.length;
      pills.set(f.name, { name: f.name, column, x, y, w: widths[i], h: PILL_HEIGHT });
    });
    columnBoxes.push({ column, x, width });
    x += width + COLUMN_GAP;
  }
  return { width: x - COLUMN_GAP + SIDE + 40, height: TOP + bandHeight + BOTTOM, pills, columns: columnBoxes };
}

// ---------------------------------------------------------------- edge geometry

export type EdgeShape = {
  d: string;
  /** Arrowhead polygon points. */
  head: string;
  /** Midpoint, for the asked-directly marker. */
  mid: { x: number; y: number };
};

type Pt = { x: number; y: number };

const cubicAt = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  const a = u * u * u,
    b = 3 * u * u * t,
    c = 3 * u * t * t,
    d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
};

/**
 * A curved path from one pill to another, ending in an arrowhead sized to the stroke:
 *  - forward (to a column further right): right edge to left edge
 *  - same column: loops out to the right, or to the left for the rightmost column
 *  - backward (to a column further left): bottom to bottom, curving below
 * `lane` (0, 1, -1, ...) separates edges that share endpoints, e.g. a pair with opposite polarity.
 */
export function edgeShape(from: PillBox, to: PillBox, columns: Column[], width: number, lane = 0): EdgeShape {
  const ci = columns.indexOf(from.column);
  const cj = columns.indexOf(to.column);
  const headLen = 7 + width * 1.1;
  const offset = lane * 7;
  let p0: Pt, p1: Pt, p2: Pt, p3: Pt;

  if (cj > ci) {
    p0 = { x: from.x + from.w, y: from.y + offset };
    p3 = { x: to.x, y: to.y + offset };
    const dx = Math.max(40, (p3.x - p0.x) * 0.5);
    p1 = { x: p0.x + dx, y: p0.y };
    p2 = { x: p3.x - dx, y: p3.y };
  } else if (cj === ci) {
    const left = ci === columns.length - 1;
    const bulge = 46 + Math.abs(to.y - from.y) * 0.22 + Math.abs(offset);
    if (left) {
      p0 = { x: from.x, y: from.y + offset };
      p3 = { x: to.x, y: to.y + offset };
      const edge = Math.min(p0.x, p3.x);
      p1 = { x: edge - bulge, y: p0.y };
      p2 = { x: edge - bulge, y: p3.y };
    } else {
      p0 = { x: from.x + from.w, y: from.y + offset };
      p3 = { x: to.x + to.w, y: to.y + offset };
      const edge = Math.max(p0.x, p3.x);
      p1 = { x: edge + bulge, y: p0.y };
      p2 = { x: edge + bulge, y: p3.y };
    }
  } else {
    p0 = { x: from.x + from.w / 2 + offset, y: from.y + from.h / 2 };
    p3 = { x: to.x + to.w / 2 + offset, y: to.y + to.h / 2 };
    const dip = Math.max(p0.y, p3.y) + 40 + Math.abs(p0.x - p3.x) * 0.12;
    p1 = { x: p0.x, y: dip };
    p2 = { x: p3.x, y: dip };
  }

  // Stop the line at the arrowhead's base so the tip lands exactly on the pill edge.
  const tangent = { x: p3.x - p2.x, y: p3.y - p2.y };
  const len = Math.hypot(tangent.x, tangent.y) || 1;
  const ux = tangent.x / len,
    uy = tangent.y / len;
  const base = { x: p3.x - ux * headLen, y: p3.y - uy * headLen };
  const half = headLen * 0.55;
  const head = [
    `${p3.x.toFixed(1)},${p3.y.toFixed(1)}`,
    `${(base.x - uy * half).toFixed(1)},${(base.y + ux * half).toFixed(1)}`,
    `${(base.x + uy * half).toFixed(1)},${(base.y - ux * half).toFixed(1)}`,
  ].join(' ');
  const c2 = { x: p2.x - ux * headLen * 0.5, y: p2.y - uy * headLen * 0.5 };
  const f = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  return {
    d: `M ${f(p0)} C ${f(p1)}, ${f(c2)}, ${f(base)}`,
    head,
    mid: cubicAt(p0, p1, p2, p3, 0.5),
  };
}

/** Lane per edge so edges sharing the same two factors don't sit on top of each other. */
export function lanes(edges: { id: string; from: string; to: string }[]): Map<string, number> {
  const groups = new Map<string, string[]>();
  for (const e of edges) {
    const key = [e.from, e.to].sort().join('|');
    groups.set(key, [...(groups.get(key) ?? []), e.id]);
  }
  const out = new Map<string, number>();
  for (const ids of groups.values()) {
    ids.forEach((id, i) => out.set(id, ids.length === 1 ? 0 : i - (ids.length - 1) / 2));
  }
  return out;
}

// ---------------------------------------------------------------- findings

export type Selection = { type: 'factor'; name: string } | { type: 'edges'; ids: string[]; label: string };

export type Finding = { text: string; selection: Selection };

const verb = (polarity: '+' | '-') => (polarity === '+' ? 'strengthens' : 'undermines');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const edgeLabel = (e: { from: string; to: string; polarity: '+' | '-' }) =>
  `${e.from} ${verb(e.polarity)} ${e.to}`;

/** Two or three findings computed from the edges and claims in view. */
export function findings(edges: ViewEdge[], contradictions: Contradiction[], claims: Claim[]): Finding[] {
  const out: Finding[] = [];
  const top = edges[0];
  if (top) {
    const asked = top.claimCount - top.notAskedDirectly;
    out.push({
      text:
        `Most widely shared: ${edgeLabel(top)}, said by ${n(top.narrators.length, 'narrator')}` +
        (asked ? ` (${asked} of ${n(top.claimCount, 'claim')} answered a question that named the topic).` : '.'),
      selection: { type: 'edges', ids: [top.id], label: cap(edgeLabel(top)) },
    });
  }
  const byId = new Map(edges.map((e) => [e.id, e]));
  const opposite = contradictions.find((c) => c.type === 'opposite');
  const mixed = contradictions.find((c) => c.type === 'mixed');
  if (opposite && opposite.type === 'opposite') {
    const plus = byId.get(opposite.strengthens)!;
    const minus = byId.get(opposite.undermines)!;
    out.push({
      text:
        `Narrators disagree on ${opposite.from} → ${opposite.to}: ${plus.narrators.length} ` +
        `${plus.narrators.length === 1 ? 'says' : 'say'} it strengthens it, ${minus.narrators.length} that it undermines it.`,
      selection: {
        type: 'edges',
        ids: [plus.id, minus.id],
        label: `${cap(opposite.from)} → ${opposite.to}, both ways`,
      },
    });
  } else if (mixed && mixed.type === 'mixed') {
    out.push({
      text: `${cap(mixed.factor)} cuts both ways: narrators credit it with good effects and blame it for bad ones.`,
      selection: { type: 'factor', name: mixed.factor },
    });
  }
  const touching = new Map<string, number>();
  for (const c of claims) {
    touching.set(c.from, (touching.get(c.from) ?? 0) + 1);
    touching.set(c.to, (touching.get(c.to) ?? 0) + 1);
  }
  const [factor, count] = [...touching.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (factor) {
    out.push({
      text: `${cap(factor)} comes up most: ${n(count!, 'claim')} name it as a cause or an effect.`,
      selection: { type: 'factor', name: factor },
    });
  }
  return out;
}

export { edgeId };
