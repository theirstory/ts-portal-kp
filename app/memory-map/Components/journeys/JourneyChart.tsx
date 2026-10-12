'use client';

import React from 'react';
import { Box } from '@mui/material';
import type { Moment } from '@/lib/journeys-canon/model';
import { mono, monoPlain, t } from '@/app/explore/tokens';
import { fortuneLabel, STAGE_LABELS } from '../shared';

export type Band = { event: string; name: string; yearStart: number; yearEnd: number };

type Props = {
  /** Every narrator's moments, each narrator's in life order. */
  lines: { slug: string; name: string; moments: Moment[]; lowConfidence: boolean }[];
  yearRange: [number, number];
  bands: Band[];
  selected: Set<string>;
  allSelected: boolean;
  colorFor: (slug: string) => string;
  selectedMoment: string | null;
  onSelect: (moment: Moment) => void;
  /** Pixels per year; small multiples pass a smaller value. */
  pxPerYear?: number;
  plotHeight?: number;
  compact?: boolean;
  label: string;
};

const FORTUNES = [3, 2, 1, 0, -1, -2, -3];

/** Year shown for a moment: "≈" whenever the year is estimated (inferred or interpolated). */
export const yearText = (m: Moment) => `${m.placement === 'stated' ? '' : '≈'}${m.placedYear}`;

export const momentAria = (m: Moment, name: string) =>
  `${name}, ${yearText(m)}${m.placement === 'interpolated' ? ' (estimated position)' : ''}: ${m.label}. ` +
  `Fortune ${fortuneLabel(m.fortune)}, ${STAGE_LABELS[m.stage] ?? m.stage}.`;

/**
 * Careers as lines over time: x is years, y is fortune (−3..3, in the narrator's own telling).
 * Straight segments in life order, never smoothed. Filled points have a stated or inferred year;
 * hollow points were placed by interpolation. Low-confidence lines (mostly interpolated) are dashed.
 */
export const JourneyChart = ({
  lines,
  yearRange,
  bands,
  selected,
  allSelected,
  colorFor,
  selectedMoment,
  onSelect,
  pxPerYear = 15,
  plotHeight = 300,
  compact = false,
  label,
}: Props) => {
  const [y0, y1] = yearRange;
  const left = compact ? 22 : 44;
  const right = compact ? 8 : 24;
  const top = compact ? 10 : bands.length ? 46 : 18;
  const bottom = compact ? 18 : 30;
  const width = left + right + (y1 - y0) * pxPerYear;
  const height = top + plotHeight + bottom;
  const X = (year: number) => left + (year - y0) * pxPerYear;
  const Y = (fortune: number) => top + ((3 - fortune) / 6) * plotHeight;

  const years: number[] = [];
  for (let y = Math.ceil(y0); y <= y1; y++) years.push(y);

  const keySelect = (event: React.KeyboardEvent, m: Moment) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(m);
    }
  };

  // Draw unselected lines first so the selection sits on top.
  const ordered = [...lines].sort((a, b) => Number(selected.has(a.slug)) - Number(selected.has(b.slug)));

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label={label}
      sx={{
        display: 'block',
        // Scales to its card; below ~80% of natural size it stops shrinking and the card scrolls sideways.
        width: '100%',
        minWidth: compact ? 0 : Math.round(width * 0.8),
        height: 'auto',
        fontFamily: 'var(--explore-sans), system-ui, sans-serif',
        '& .pt': { cursor: 'pointer', outline: 'none' },
        '& .pt:focus-visible circle.ring': { stroke: t.accent, strokeWidth: 2.5, opacity: 1 },
      }}>
      {/* Year grid: faint every year, stronger every 5 and 10 */}
      {years.map((y) => {
        const strong = y % 10 === 0 ? 2 : y % 5 === 0 ? 1 : 0;
        if (compact && !strong) return null;
        return (
          <g key={y} aria-hidden="true">
            <line
              x1={X(y)}
              x2={X(y)}
              y1={top}
              y2={top + plotHeight}
              stroke={strong === 2 ? '#d4d4d4' : strong === 1 ? '#e2e2e2' : '#efefef'}
              strokeWidth={strong === 2 ? 1 : 0.8}
            />
            {strong === 2 && (
              <text
                x={X(y)}
                y={top + plotHeight + (compact ? 13 : 18)}
                textAnchor="middle"
                fill={t.muted3}
                style={monoPlain(compact ? 9 : 10.5)}>
                {y}
              </text>
            )}
          </g>
        );
      })}

      {/* Fortune scale and the zero line */}
      {FORTUNES.map((f) => (
        <g key={f} aria-hidden="true">
          <line
            x1={left}
            x2={width - right}
            y1={Y(f)}
            y2={Y(f)}
            stroke={f === 0 ? '#9e9e9e' : '#efefef'}
            strokeWidth={f === 0 ? 1.2 : 0.8}
          />
          {(!compact || f % 3 === 0) && (
            <text x={left - 8} y={Y(f) + 3.5} textAnchor="end" fill={t.muted3} style={monoPlain(compact ? 9 : 10.5)}>
              {fortuneLabel(f)}
            </text>
          )}
        </g>
      ))}

      {/* Shared-event bands */}
      {bands.map((b, i) => {
        const single = b.yearEnd === b.yearStart;
        const x = X(b.yearStart - (single ? 0 : 0.5));
        const w = single ? 0 : X(b.yearEnd + 0.5) - x;
        return (
          <g key={b.event} aria-hidden="true">
            {single ? (
              <line
                x1={x}
                x2={x}
                y1={top - 4}
                y2={top + plotHeight}
                stroke={t.rail}
                strokeWidth={1.2}
                strokeDasharray="4 3"
                opacity={0.7}
              />
            ) : (
              <rect x={x} y={top - 4} width={w} height={plotHeight + 4} fill="rgba(0, 120, 179, 0.07)" />
            )}
            {!compact && (
              // Alternate rows so neighbouring bands' labels don't collide; near the right edge the
              // label ends at the band instead of running off the chart.
              <text
                x={x + (single ? 0 : w / 2) > width - right - 140 ? x + w : x + (single ? 0 : w / 2)}
                y={top - 10 - (i % 2) * 13}
                textAnchor={x + (single ? 0 : w / 2) > width - right - 140 ? 'end' : 'middle'}
                fill={t.accent}
                style={mono(9.5, 0.06)}>
                {b.name.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}

      {/* Lines and points */}
      {ordered.map((line) => {
        const on = selected.has(line.slug);
        const faded = !on;
        const color = colorFor(line.slug);
        const strokeWidth = allSelected ? 1.5 : on ? 2.6 : 1;
        const opacity = allSelected ? 0.72 : on ? 1 : 0.08;
        const pts = line.moments.map((m) => `${X(m.x).toFixed(1)},${Y(m.fortune).toFixed(1)}`).join(' ');
        return (
          <g
            key={line.slug}
            opacity={opacity}
            style={faded ? { pointerEvents: 'none' } : undefined}
            aria-hidden={faded ? 'true' : undefined}>
            <polyline
              points={pts}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeDasharray={line.lowConfidence ? '5 4' : undefined}
            />
            {line.moments.map((m) => {
              const isSel = selectedMoment === m.id;
              const r = compact ? 2.8 : allSelected ? 3.2 : 4.2;
              const hollow = m.placement === 'interpolated';
              return (
                <g
                  key={m.id}
                  className="pt"
                  tabIndex={faded ? -1 : 0}
                  role="button"
                  aria-pressed={isSel}
                  aria-label={momentAria(m, line.name)}
                  onClick={() => onSelect(m)}
                  onKeyDown={(ev) => keySelect(ev, m)}>
                  <title>{`${line.name} · ${yearText(m)} · ${m.label} (${fortuneLabel(m.fortune)})`}</title>
                  <circle
                    className="ring"
                    cx={X(m.x)}
                    cy={Y(m.fortune)}
                    r={r + 4}
                    fill="none"
                    stroke={t.accent}
                    strokeWidth={2}
                    opacity={isSel ? 1 : 0}
                  />
                  <circle
                    cx={X(m.x)}
                    cy={Y(m.fortune)}
                    r={r}
                    fill={hollow ? '#fff' : color}
                    stroke={color}
                    strokeWidth={hollow ? 1.6 : 1}
                  />
                  {/* Larger invisible target */}
                  <circle cx={X(m.x)} cy={Y(m.fortune)} r={Math.max(r + 5, 9)} fill="transparent" />
                </g>
              );
            })}
          </g>
        );
      })}
    </Box>
  );
};
