'use client';

import React, { useState } from 'react';
import { Box } from '@mui/material';
import { monoPlain, shell, t } from '@/app/explore/tokens';
import { Chip, COHORTS, Label, surname } from './shared';
import type { MemoryNarrator } from './shared';

type Grouping = 'none' | 'region' | 'joined';

/**
 * "Compare narrators": the one narrator selection every Memory Map section filters by. Any
 * combination, All and Clear, and grouping by region or by the decade they joined, where a group's
 * label selects the whole group. Selected narrators get strong colours only while few enough are
 * selected to tell apart; the rest stay neutral.
 */
export const NarratorFilter = ({
  narrators,
  selected,
  onChange,
  colorFor,
}: {
  narrators: MemoryNarrator[];
  selected: string[];
  onChange: (next: string[]) => void;
  colorFor: (slug: string) => string;
}) => {
  const [grouping, setGrouping] = useState<Grouping>('none');
  const all = narrators.map((n) => n.slug);

  const toggle = (slug: string) =>
    onChange(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]);
  const sameSet = (slugs: string[]) => slugs.length === selected.length && slugs.every((s) => selected.includes(s));

  const chip = (n: MemoryNarrator) => {
    const on = selected.includes(n.slug);
    return (
      <Chip
        key={n.slug}
        on={on}
        color={colorFor(n.slug)}
        title={n.name}
        ariaLabel={`${n.name}${on ? ', selected' : ''}`}
        onClick={() => toggle(n.slug)}>
        {
          <Box
            component="span"
            aria-hidden="true"
            sx={{ width: 7, height: 7, borderRadius: '50%', background: colorFor(n.slug) }}
          />
        }
        {surname(n.name)}
      </Chip>
    );
  };

  const groups: { label: string; members: MemoryNarrator[] }[] =
    grouping === 'region'
      ? [...new Set(narrators.flatMap((n) => n.regions))]
          .sort()
          .map((r) => ({ label: r, members: narrators.filter((n) => n.regions.includes(r)) }))
      : grouping === 'joined'
        ? COHORTS.map((c) => ({ label: `Joined ${c}`, members: narrators.filter((n) => n.cohort === c) })).filter(
            (g) => g.members.length,
          )
        : [];

  return (
    <Box
      role="region"
      aria-label="Compare narrators"
      sx={{
        position: { xs: 'static', md: 'sticky' },
        top: 0,
        zIndex: 4,
        background: t.paper,
        borderTop: `1px solid ${t.rule}`,
        borderBottom: `1px solid ${t.rule}`,
      }}>
      <Box sx={{ ...shell, maxWidth: 1600, py: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          <Label>Compare narrators</Label>
          {grouping === 'none' && narrators.map(chip)}
          <Chip on={false} onClick={() => onChange(all)}>
            All
          </Chip>
          <Chip on={false} onClick={() => onChange([])}>
            Clear
          </Chip>
          <Box component="span" sx={{ ...monoPlain(11), color: t.muted3 }} aria-live="polite">
            {selected.length} of {all.length} selected
          </Box>
          <Box component="span" sx={{ flex: 1 }} />
          <Label>Group by</Label>
          {(['none', 'region', 'joined'] as Grouping[]).map((g) => (
            <Chip key={g} on={grouping === g} onClick={() => setGrouping(g)}>
              {g === 'none' ? 'None' : g === 'region' ? 'Region' : 'Era joined'}
            </Chip>
          ))}
        </Box>
        {groups.map((g) => {
          const slugs = g.members.map((m) => m.slug);
          return (
            <Box key={g.label} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
              <Chip on={sameSet(slugs)} onClick={() => onChange(slugs)} title={`Select only ${g.label}`}>
                {g.label}
              </Chip>
              <Box component="span" aria-hidden="true" sx={{ color: t.muted4 }}>
                ·
              </Box>
              {g.members.map(chip)}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
