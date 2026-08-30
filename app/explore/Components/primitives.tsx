'use client';

import React from 'react';
import Link from 'next/link';
import { Box, type SxProps, type Theme } from '@mui/material';
import { CONFIDENCE, mono, monoPlain, t } from '../tokens';
import { stamp } from '@/lib/insights/format';
import type { Confidence } from '@/types/insights';

/** Mono uppercase eyebrow — the design's recurring small label. */
export const Eyebrow = ({
  children,
  color = t.muted3,
  size = 11,
  tracking = 0.14,
  sx,
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
  tracking?: number;
  sx?: SxProps<Theme>;
}) => <Box sx={{ ...mono(size, tracking), color, ...sx }}>{children}</Box>;

/** How well the excerpt answers the question: Direct / Partial / Tangential. */
export const ConfidenceChip = ({ confidence, size = 10 }: { confidence: Confidence; size?: number }) => {
  const c = CONFIDENCE[confidence] ?? CONFIDENCE.low;
  return (
    <Box
      component="span"
      sx={{
        ...mono(size, 0.1),
        display: 'inline-block',
        padding: size >= 10 ? '3px 7px' : '2px 6px',
        borderRadius: '2px',
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        whiteSpace: 'nowrap',
      }}>
      {c.label}
    </Box>
  );
};

/** The `▶ 35:39` pill that cues the drawer. */
export const TimestampPill = ({
  seconds,
  onClick,
  variant = 'button',
}: {
  seconds: number;
  onClick?: (event: React.MouseEvent) => void;
  variant?: 'button' | 'static';
}) => (
  <Box
    component={variant === 'button' ? 'button' : 'span'}
    {...(variant === 'button' ? { type: 'button' as const, onClick } : {})}
    sx={{
      ...monoPlain(10.5),
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: '#fff',
      border: `1px solid ${t.fieldBorder}`,
      borderRadius: '2px',
      padding: variant === 'button' ? '6px 11px' : '4px 8px',
      color: t.ink2,
      whiteSpace: 'nowrap',
      ...(variant === 'button'
        ? { cursor: 'pointer', '&:hover': { borderColor: t.accent, color: t.accent } }
        : {}),
    }}>
    ▶ {stamp(seconds)}
  </Box>
);

/** Segmented two-way toggle: Questions|All excerpts, Compare|Read. */
export const SegmentedToggle = <T extends string>({
  value,
  options,
  onChange,
  padding = '6px 13px',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  padding?: string;
}) => (
  <Box
    sx={{
      display: 'flex',
      gap: '1px',
      background: t.fieldBorder,
      border: `1px solid ${t.fieldBorder}`,
      borderRadius: '3px',
      overflow: 'hidden',
      flex: 'none',
    }}>
    {options.map((option) => {
      const on = option.value === value;
      return (
        <Box
          key={option.value}
          component="button"
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={on}
          sx={{
            ...monoPlain(11, 0.06),
            border: 'none',
            padding,
            cursor: 'pointer',
            background: on ? t.ink : t.surface,
            color: on ? t.paper : t.muted,
            whiteSpace: 'nowrap',
          }}>
          {option.label}
        </Box>
      );
    })}
  </Box>
);

/** Small outlined mono control: expand all, all, clear. */
export const MonoButton = ({
  children,
  onClick,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      ...monoPlain(10, 0.06),
      border: `1px solid ${active ? t.accent : t.fieldBorder}`,
      background: 'transparent',
      color: active ? t.accent : t.muted3,
      padding: '4px 8px',
      borderRadius: '2px',
      cursor: 'pointer',
      '&:hover': { borderColor: t.accent, color: t.accent },
    }}>
    {children}
  </Box>
);

/** "← All themes" style back link. */
export const BackLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Box
    component={Link}
    href={href}
    sx={{ ...mono(11, 0.1), color: t.muted3, textDecoration: 'none', '&:hover': { color: t.accent } }}>
    {children}
  </Box>
);

/** Coverage dots: one per interview, filled when that interview answered. */
export const CoverageDots = ({ answered }: { answered: boolean[] }) => (
  <Box sx={{ display: 'flex', gap: '4px' }}>
    {answered.map((on, index) => (
      <Box
        key={index}
        sx={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: on ? t.accent : 'transparent',
          border: `1px solid ${on ? t.accent : t.dotEmpty}`,
        }}
      />
    ))}
  </Box>
);

/** The content column every Explore view sits in. */
export const Shell = ({ children, sx }: { children: React.ReactNode; sx?: SxProps<Theme> }) => (
  <Box sx={{ maxWidth: 1240, mx: 'auto', px: { xs: 3, md: 5 }, ...sx }}>{children}</Box>
);
