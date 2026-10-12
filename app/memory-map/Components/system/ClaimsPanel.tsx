'use client';

import React from 'react';
import Link from 'next/link';
import { Box } from '@mui/material';
import { stamp } from '@/lib/insights/format';
import type { Claim } from '@/lib/system-map/model';
import type { MapFactor, MapNarrator, Selection } from '@/lib/system-map/view';
import { loop, mono, monoPlain, serif, t } from '@/app/explore/tokens';
import { clipHref, useOpenClip } from '../useOpenClip';

type Props = {
  selection: Selection | null;
  claims: Claim[];
  /** Claims on the selection that sit on arrows below the minimum narrator count. */
  belowMinimum: number;
  minNarrators: number;
  onShowAll: () => void;
  factors: Map<string, MapFactor>;
  narrators: Map<string, MapNarrator>;
  narratorColor: (slug: string) => string;
};

const Tag = ({ polarity }: { polarity: '+' | '-' }) => (
  <Box
    component="span"
    sx={{
      ...mono(9.5, 0.08),
      px: '6px',
      py: '2px',
      borderRadius: '3px',
      whiteSpace: 'nowrap',
      color: polarity === '+' ? loop.strengthens : loop.undermines,
      background: polarity === '+' ? loop.strengthensWash : loop.underminesWash,
      border: `1px solid ${polarity === '+' ? loop.strengthens : loop.undermines}`,
    }}>
    {polarity === '+' ? 'strengthens' : 'undermines'}
  </Box>
);

const MetaTag = ({ children, title }: { children: React.ReactNode; title?: string }) => (
  <Box
    component="span"
    title={title}
    sx={{
      ...monoPlain(10),
      color: t.muted3,
      border: `1px solid ${t.rule}`,
      borderRadius: '3px',
      px: '5px',
      py: '1px',
      whiteSpace: 'nowrap',
    }}>
    {children}
  </Box>
);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const ClaimsPanel = ({
  selection,
  claims,
  belowMinimum,
  minNarrators,
  onShowAll,
  factors,
  narrators,
  narratorColor,
}: Props) => {
  const openClip = useOpenClip();
  const narratorCount = new Set(claims.map((c) => c.narrator)).size;

  const heading =
    selection?.type === 'factor'
      ? selection.name
      : selection?.type === 'edges'
        ? selection.label
        : 'Select a factor or an arrow';
  const definition = selection?.type === 'factor' ? factors.get(selection.name)?.definition : null;

  return (
    <Box
      component="section"
      aria-live="polite"
      aria-label="Claims for the selection"
      sx={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: '8px', p: { xs: 2, md: 2.5 } }}>
      <Box component="h2" sx={{ m: 0, ...serif(20, 1.3, 600), color: t.ink, textWrap: 'balance' }}>
        {heading}
      </Box>
      {definition && <Box sx={{ mt: '4px', fontSize: '13px', color: t.muted3 }}>{definition}</Box>}
      {selection && (
        <Box sx={{ ...monoPlain(11), color: t.muted3, mt: '6px' }}>
          {plural(claims.length, 'claim')} from {plural(narratorCount, 'narrator')}
        </Box>
      )}

      {selection && claims.length === 0 && (
        <Box sx={{ mt: 2, fontSize: '14px', color: t.muted3 }}>None of the selected narrators made a claim here.</Box>
      )}

      <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, mt: 1.5 }}>
        {claims.map((c) => {
          const narrator = narrators.get(c.narrator);
          const name = narrator?.name ?? c.narrator;
          const multipart = (narrator?.recordings.length ?? 1) > 1;
          return (
            <Box
              component="li"
              key={c.id}
              sx={{ py: 1.75, borderTop: `1px solid ${t.ruleSoft}`, '&:first-of-type': { borderTop: 'none' } }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: t.ink,
                }}>
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{ width: 8, height: 8, borderRadius: '50%', background: narratorColor(c.narrator), flex: 'none' }}
                />
                {name}
                {multipart && (
                  <Box component="span" sx={{ ...monoPlain(10.5), color: t.muted4, fontWeight: 400 }}>
                    part {c.part}
                  </Box>
                )}
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '6px',
                  mt: '6px',
                  fontSize: '13px',
                }}>
                <Box component="span" sx={{ fontWeight: 600, color: t.ink }}>
                  {c.from} → {c.to}
                </Box>
                <Tag polarity={c.polarity} />
                {c.prompt.type === 'asked_directly' && (
                  <MetaTag title={`Asked: “${c.prompt.question}”`}>
                    asked directly{c.prompt.list_number ? ` · ${c.prompt.list_number}` : ''}
                  </MetaTag>
                )}
                {c.explicitness === 'implied' && (
                  <MetaTag title="The link is clearly entailed by what they said, not stated outright.">
                    implied
                  </MetaTag>
                )}
              </Box>
              <Box
                component="blockquote"
                sx={{
                  m: 0,
                  mt: '8px',
                  pl: '12px',
                  borderLeft: `2px solid ${narratorColor(c.narrator)}`,
                  ...serif(16, 1.5),
                  fontStyle: 'italic',
                  color: t.ink2,
                }}>
                “{c.quote}”
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '14px', mt: '8px', alignItems: 'center' }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => openClip(c, name)}
                  aria-label={`Play ${name} at ${stamp(c.t)}`}
                  sx={{
                    ...monoPlain(11.5),
                    border: 'none',
                    background: 'transparent',
                    color: t.accent,
                    cursor: 'pointer',
                    p: 0,
                    '&:hover': { textDecoration: 'underline' },
                  }}>
                  ▶ Play {stamp(c.t)}–{stamp(c.end)}
                </Box>
                <Box
                  component={Link}
                  href={clipHref(c)}
                  sx={{ ...monoPlain(11), color: t.muted3, '&:hover': { color: t.accent } }}>
                  open in recording
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      {belowMinimum > 0 && (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${t.ruleSoft}`, fontSize: '13px', color: t.muted3 }}>
          {plural(belowMinimum, 'more claim')} here sit on arrows made by fewer than {minNarrators} narrators.{' '}
          <Box
            component="button"
            type="button"
            onClick={onShowAll}
            sx={{
              border: 'none',
              background: 'transparent',
              color: t.accent,
              cursor: 'pointer',
              p: 0,
              fontSize: '13px',
              textDecoration: 'underline',
            }}>
            Show arrows from a single narrator
          </Box>
        </Box>
      )}
    </Box>
  );
};
