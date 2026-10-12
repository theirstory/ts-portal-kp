'use client';

import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import type { Column } from '@/lib/system-map/model';
import { COLUMN_LABELS, edgeLabel, edgeShape, edgeWidth, lanes, PILL_HEIGHT } from '@/lib/system-map/view';
import type { Layout, MapFactor, Selection, ViewEdge } from '@/lib/system-map/view';
import { loop, mono, t } from '@/app/explore/tokens';

type Props = {
  columns: Column[];
  layout: Layout;
  factors: MapFactor[];
  /** Arrows the selected narrators made, at or above the minimum. */
  activeEdges: ViewEdge[];
  /** Arrows across all narrators at the minimum that the selection didn't make: drawn faint gray. */
  ghostEdges: ViewEdge[];
  /** Factors at least one selected narrator named (on an active arrow). */
  activeFactors: Set<string>;
  selection: Selection | null;
  contradictionIds: Set<string> | null;
  showAskedMarker: boolean;
  onSelect: (selection: Selection) => void;
};

const FADED = 0.16;

export const LoopMap = ({
  columns,
  layout,
  factors,
  activeEdges,
  ghostEdges,
  activeFactors,
  selection,
  contradictionIds,
  showAskedMarker,
  onSelect,
}: Props) => {
  const laneOf = useMemo(() => lanes([...ghostEdges, ...activeEdges]), [ghostEdges, activeEdges]);

  const isEdgeSelected = (e: ViewEdge): boolean | null => {
    if (!selection) return null;
    if (selection.type === 'factor') return e.from === selection.name || e.to === selection.name;
    return selection.ids.includes(e.id);
  };
  const selectedFactors = useMemo(() => {
    const names = new Set<string>();
    if (selection?.type === 'factor') names.add(selection.name);
    if (selection?.type === 'edges')
      for (const e of activeEdges) if (selection.ids.includes(e.id)) names.add(e.from).add(e.to);
    return names;
  }, [selection, activeEdges]);
  const touchesSelection = useMemo(() => {
    const names = new Set<string>();
    for (const e of activeEdges) if (isEdgeSelected(e)) names.add(e.from).add(e.to);
    return names;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEdges, selection]);

  // Draw selected arrows last so they sit on top.
  const ordered = [...activeEdges].sort((a, b) => Number(isEdgeSelected(a)) - Number(isEdgeSelected(b)));

  const shape = (e: ViewEdge) => {
    const from = layout.pills.get(e.from);
    const to = layout.pills.get(e.to);
    if (!from || !to) return null;
    return edgeShape(from, to, columns, edgeWidth(e.narrators.length), laneOf.get(e.id) ?? 0);
  };

  const keySelect = (event: React.KeyboardEvent, next: Selection) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(next);
    }
  };

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="group"
      aria-label="Map of cause-and-effect claims. Factors are buttons; arrows are buttons."
      sx={{
        display: 'block',
        width: '100%',
        // Below this the text gets too small: the container scrolls sideways instead.
        minWidth: Math.round(layout.width * 0.78),
        height: 'auto',
        fontFamily: 'var(--explore-sans), system-ui, sans-serif',
        '& .hit': { cursor: 'pointer', outline: 'none' },
        '& .hit:focus-visible': { stroke: 'rgba(0, 110, 165, 0.35)' },
        '& .pill': { cursor: 'pointer', outline: 'none' },
        '& .pill:focus-visible rect': { stroke: t.accent, strokeWidth: 2.5 },
      }}>
      {/* Column labels */}
      {layout.columns.map((c) => (
        <text key={c.column} x={c.x} y={24} fill={t.muted3} style={{ ...mono(11, 0.14) }}>
          {COLUMN_LABELS[c.column].toUpperCase()}
        </text>
      ))}

      {/* Faint gray: arrows other narrators made */}
      {ghostEdges.map((e) => {
        const s = shape(e);
        if (!s) return null;
        return (
          <g key={`ghost-${e.id}`} aria-hidden="true" opacity={selection ? 0.5 : 1}>
            <path
              d={s.d}
              fill="none"
              stroke={loop.ghost}
              strokeWidth={1}
              strokeDasharray={e.polarity === '-' ? '4 4' : undefined}
            />
          </g>
        );
      })}

      {/* Contradiction halos */}
      {contradictionIds &&
        activeEdges
          .filter((e) => contradictionIds.has(e.id))
          .map((e) => {
            const s = shape(e);
            return s ? (
              <path
                key={`halo-${e.id}`}
                d={s.d}
                fill="none"
                stroke={loop.contradiction}
                strokeWidth={edgeWidth(e.narrators.length) + 9}
                strokeLinecap="round"
                aria-hidden="true"
              />
            ) : null;
          })}

      {/* Arrows the selected narrators made */}
      {ordered.map((e) => {
        const s = shape(e);
        if (!s) return null;
        const selected = isEdgeSelected(e);
        const color = e.polarity === '+' ? loop.strengthens : loop.undermines;
        const width = edgeWidth(e.narrators.length);
        return (
          <g key={e.id} opacity={selected === false ? FADED : 1} aria-hidden="true">
            <path
              d={s.d}
              fill="none"
              stroke={color}
              strokeWidth={width}
              strokeDasharray={e.polarity === '-' ? `${5 + width} ${4 + width * 0.6}` : undefined}
              strokeLinecap="round"
            />
            <polygon points={s.head} fill={color} />
            {showAskedMarker && e.askedDirectlyOnly && (
              <circle cx={s.mid.x} cy={s.mid.y} r={4.5} fill={t.surface} stroke={color} strokeWidth={1.6} />
            )}
          </g>
        );
      })}

      {/* Factors, in reading order (column by column, top to bottom) for Tab */}
      {[...factors]
        .sort((a, b) => {
          const pa = layout.pills.get(a.name);
          const pb = layout.pills.get(b.name);
          return columns.indexOf(a.column) - columns.indexOf(b.column) || (pa?.y ?? 0) - (pb?.y ?? 0);
        })
        .map((f) => {
          const box = layout.pills.get(f.name);
          if (!box) return null;
          const active = activeFactors.has(f.name);
          const selected = selectedFactors.has(f.name);
          const dim = !active || (selection !== null && !touchesSelection.has(f.name) && !selected);
          return (
            <g
              key={f.name}
              className="pill"
              tabIndex={0}
              role="button"
              aria-pressed={selection?.type === 'factor' && selection.name === f.name}
              aria-label={`${f.name}: ${f.definition}`}
              onClick={() => onSelect({ type: 'factor', name: f.name })}
              onKeyDown={(ev) => keySelect(ev, { type: 'factor', name: f.name })}>
              <title>{f.definition}</title>
              <rect
                x={box.x}
                y={box.y - PILL_HEIGHT / 2}
                width={box.w}
                height={PILL_HEIGHT}
                rx={PILL_HEIGHT / 2}
                fill={selected ? loop.pillSelected : t.surface}
                // Faded through colour, not opacity: the fill stays opaque so arrows never show through labels.
                stroke={selected ? t.accent : active && !dim ? loop.pillBorder : loop.ghost}
                strokeWidth={selected ? 2 : 1}
              />
              <text
                x={box.x + box.w / 2}
                y={box.y + 4.5}
                textAnchor="middle"
                fontSize={13}
                fontWeight={selected || touchesSelection.has(f.name) ? 600 : 400}
                fill={dim ? loop.dimText : t.ink}>
                {f.name}
              </text>
            </g>
          );
        })}

      {/* Click and focus targets for arrows: after the pills so Tab visits factors first, then arrows
          from most to fewest narrators. Invisible; the drawn arrows are above. */}
      {activeEdges.map((e) => {
        const s = shape(e);
        if (!s) return null;
        const selected = isEdgeSelected(e);
        const width = edgeWidth(e.narrators.length);
        const label =
          `${edgeLabel(e)}. ${e.narrators.length} narrator${e.narrators.length === 1 ? '' : 's'}, ` +
          `${e.claimCount} claim${e.claimCount === 1 ? '' : 's'}` +
          (e.askedDirectlyOnly ? ', all in answer to a question that named the topic' : '');
        return (
          <path
            key={`hit-${e.id}`}
            className="hit"
            d={s.d}
            fill="none"
            stroke="transparent"
            pointerEvents="stroke"
            strokeWidth={Math.max(12, width + 8)}
            tabIndex={0}
            role="button"
            aria-label={label}
            aria-pressed={selected === true}
            onClick={() => onSelect({ type: 'edges', ids: [e.id], label: edgeLabel(e) })}
            onKeyDown={(ev) => keySelect(ev, { type: 'edges', ids: [e.id], label: edgeLabel(e) })}>
            <title>{label}</title>
          </path>
        );
      })}
    </Box>
  );
};
