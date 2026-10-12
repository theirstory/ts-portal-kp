'use client';

import React from 'react';
import Link from 'next/link';
import { Box } from '@mui/material';
import { stamp } from '@/lib/insights/format';
import { mono, monoPlain, NARRATOR_PALETTE, serif, shell, t } from '@/app/explore/tokens';
import { clipHref, useOpenClip } from './useOpenClip';

/** A narrator as every section needs it. */
export type MemoryNarrator = { slug: string; name: string; regions: string[]; cohort: string };

export const COHORTS = ['before 1980', '1980s', '1990s or later', 'unknown'] as const;

/** Each narrator's own colour, fixed by their position in the registry (`all`). */
export function narratorColorFor(all: string[]) {
  return (slug: string) => {
    const i = all.indexOf(slug);
    return i >= 0 ? NARRATOR_PALETTE[i % NARRATOR_PALETTE.length] : t.muted4;
  };
}

export const surname = (name: string) => name.replace(/,.*$/, '').trim().split(/\s+/).slice(-1)[0];

export const Chip = ({
  on,
  onClick,
  children,
  color,
  title,
  ariaLabel,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
  title?: string;
  ariaLabel?: string;
}) => (
  <Box
    component="button"
    type="button"
    aria-pressed={on}
    aria-label={ariaLabel}
    title={title}
    onClick={onClick}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      fontFamily: 'inherit',
      fontSize: '13px',
      px: '10px',
      py: '4px',
      borderRadius: '999px',
      cursor: 'pointer',
      border: `1.5px solid ${on ? (color ?? t.accent) : t.rule}`,
      background: on ? t.surface : 'transparent',
      color: on ? t.ink : t.muted4,
      '&:hover': { borderColor: color ?? t.accent },
      '&:focus-visible': { outline: `2px solid ${t.accent}`, outlineOffset: '2px' },
    }}>
    {children}
  </Box>
);

export const Label = ({ children }: { children: React.ReactNode }) => (
  <Box component="span" sx={{ ...mono(10.5, 0.12), color: t.muted3, mr: '4px', whiteSpace: 'nowrap' }}>
    {children}
  </Box>
);

export const SectionIntro = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box sx={{ ...shell, pt: { xs: 3, md: 4 } }}>
    <Box component="h2" sx={{ m: 0, ...serif(30, 1.15, 600), color: t.ink }}>
      {title}
    </Box>
    <Box component="p" sx={{ mt: 1.25, mb: 0, maxWidth: 760, fontSize: '16px', lineHeight: 1.6, color: t.ink2 }}>
      {children}
    </Box>
  </Box>
);

export type Finding = { text: string; onSelect: () => void };

/** Two or three computed findings, each a button that shows the selection behind it. */
export const FindingsStrip = ({ findings, label = 'Findings' }: { findings: Finding[]; label?: string }) =>
  findings.length ? (
    <Box
      component="ul"
      aria-label={label}
      sx={{
        ...shell,
        listStyle: 'none',
        mt: 2,
        mb: 0,
        display: 'grid',
        gap: '10px',
        gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.min(3, findings.length)}, 1fr)` },
      }}>
      {findings.map((f) => (
        <Box component="li" key={f.text}>
          <Box
            component="button"
            type="button"
            onClick={f.onSelect}
            sx={{
              width: '100%',
              height: '100%',
              textAlign: 'left',
              fontFamily: 'inherit',
              fontSize: '14px',
              lineHeight: 1.5,
              color: t.ink,
              background: t.surface,
              border: `1px solid ${t.rule}`,
              borderLeft: `3px solid ${t.rail}`,
              borderRadius: '4px',
              p: '10px 12px',
              cursor: 'pointer',
              '&:hover': { background: t.surfaceHover },
              '&:focus-visible': { outline: `2px solid ${t.accent}`, outlineOffset: '2px' },
            }}>
            {f.text}
          </Box>
        </Box>
      ))}
    </Box>
  ) : null;

/** ▶ Play (side panel, cued to the exact clip) and a link into the full recording. */
export const ClipLinks = ({
  clip,
  narratorName,
  quote,
}: {
  clip: { t: number; end: number; storyUuid: string; part: number };
  narratorName: string;
  quote: string;
}) => {
  const openClip = useOpenClip();
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
      <Box
        component="button"
        type="button"
        onClick={() => openClip({ ...clip, quote }, narratorName)}
        aria-label={`Play ${narratorName} at ${stamp(clip.t)}`}
        sx={{
          ...monoPlain(11.5),
          border: 'none',
          background: 'transparent',
          color: t.accent,
          cursor: 'pointer',
          p: 0,
          '&:hover': { textDecoration: 'underline' },
          '&:focus-visible': { outline: `2px solid ${t.accent}`, outlineOffset: '2px' },
        }}>
        ▶ Play {stamp(clip.t)}–{stamp(clip.end)}
      </Box>
      <Box
        component={Link}
        href={clipHref(clip)}
        sx={{ ...monoPlain(11), color: t.muted3, '&:hover': { color: t.accent } }}>
        open in recording
      </Box>
    </Box>
  );
};

export const Quote = ({ children, color = t.rule }: { children: React.ReactNode; color?: string }) => (
  <Box
    component="blockquote"
    sx={{ m: 0, pl: '12px', borderLeft: `2px solid ${color}`, ...serif(16, 1.5), fontStyle: 'italic', color: t.ink2 }}>
    “{children}”
  </Box>
);

export const STAGE_LABELS: Record<string, string> = {
  ordinary_world: 'Ordinary world',
  call: 'The call',
  refusal: 'Refusal',
  mentor: 'Mentor',
  threshold: 'Threshold',
  trials: 'Trials',
  ordeal: 'Ordeal',
  reward: 'Reward',
  transformation: 'Transformation',
  return: 'Return',
};

export const fortuneLabel = (f: number) => (f > 0 ? `+${f}` : String(f));

export const MethodNote = ({ children }: { children: React.ReactNode }) => (
  <Box component="section" aria-label="Method" sx={{ ...shell, mt: 5 }}>
    <Box sx={{ maxWidth: 820, borderTop: `1px solid ${t.rule}`, pt: 2.5 }}>
      <Box component="h2" sx={{ m: 0, ...mono(11, 0.14), color: t.muted3 }}>
        How this was made
      </Box>
      <Box sx={{ mt: 1.25, fontSize: '14px', lineHeight: 1.65, color: t.ink2, '& p': { m: 0, mb: 1 } }}>{children}</Box>
    </Box>
  </Box>
);
