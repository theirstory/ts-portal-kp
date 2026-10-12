'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Box } from '@mui/material';
import type { Model as JourneysModel } from '@/lib/journeys-canon/model';
import type { MapModel } from '@/lib/system-map/view';
import { mono, serif, shell, t } from '@/app/explore/tokens';
import { CanonSection } from './canon/CanonSection';
import { JourneysSection } from './journeys/JourneysSection';
import { NarratorFilter } from './NarratorFilter';
import { MethodNote, narratorColorFor } from './shared';
import type { MemoryNarrator } from './shared';
import { SystemSection } from './system/SystemSection';

type Tab = 'journeys' | 'canon' | 'system';
const TABS: { id: Tab; label: string }[] = [
  { id: 'journeys', label: 'Journeys' },
  { id: 'canon', label: 'The canon' },
  { id: 'system', label: 'System' },
];

/**
 * The Memory Map: Journeys, The canon and System, under one "Compare narrators" filter. The
 * selection lives in the URL (?n=slug,slug; absent means everyone) and the tab in the hash, so links
 * keep both.
 */
export const MemoryMap = ({
  narrators,
  journeys,
  system,
}: {
  narrators: MemoryNarrator[];
  journeys: JourneysModel;
  system: MapModel;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const all = useMemo(() => narrators.map((n) => n.slug), [narrators]);

  const fromUrl = useCallback(() => {
    const raw = searchParams.get('n');
    if (raw === null) return all;
    const wanted = raw.split(',').filter((s) => all.includes(s));
    return all.filter((s) => wanted.includes(s));
  }, [searchParams, all]);

  const [selected, setSelectedState] = useState<string[]>(fromUrl);
  const [tab, setTab] = useState<Tab>('journeys');
  const [focusMoment, setFocusMoment] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace('#', '') as Tab;
      if (TABS.some((x) => x.id === h)) setTab(h);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const setSelected = useCallback(
    (next: string[]) => {
      // Keep registry order, so colours and lists are stable.
      const ordered = all.filter((s) => next.includes(s));
      setSelectedState(ordered);
      const params = new URLSearchParams(searchParams.toString());
      if (ordered.length === all.length) params.delete('n');
      else params.set('n', ordered.join(','));
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}${window.location.hash}`, { scroll: false });
    },
    [all, pathname, router, searchParams],
  );

  const goTab = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${next}`);
  };

  const colorFor = useMemo(() => narratorColorFor(all), [all]);

  const jumpToMoment = (momentId: string) => {
    const m = journeys.moments.find((x) => x.id === momentId);
    if (m && !selected.includes(m.narrator)) setSelected([...selected, m.narrator]);
    setFocusMoment(momentId);
    goTab('journeys');
  };
  const showEvent = (eventId: string) => {
    setSelectedEvent(eventId);
    goTab('canon');
  };

  return (
    <Box sx={{ pb: 10 }}>
      <Box sx={{ ...shell, maxWidth: 1600, pt: { xs: 3, md: 4 }, mb: 2 }}>
        <Box component="h1" sx={{ m: 0, ...serif(36, 1.1, 600), color: t.ink }}>
          Memory Map
        </Box>
        <Box
          role="tablist"
          aria-label="Memory Map sections"
          sx={{ display: 'flex', gap: { xs: 2, md: 3.5 }, mt: 2, borderBottom: `1px solid ${t.rule}` }}>
          {TABS.map((x) => (
            <Box
              key={x.id}
              component="button"
              type="button"
              role="tab"
              id={`tab-${x.id}`}
              aria-selected={tab === x.id}
              aria-controls={`panel-${x.id}`}
              onClick={() => goTab(x.id)}
              sx={{
                ...mono(12, 0.12),
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                px: 0,
                pb: 1,
                mb: '-1px',
                color: tab === x.id ? t.accent : t.muted3,
                borderBottom: `2px solid ${tab === x.id ? t.accent : 'transparent'}`,
                '&:focus-visible': { outline: `2px solid ${t.accent}`, outlineOffset: '3px' },
              }}>
              {x.label}
            </Box>
          ))}
        </Box>
      </Box>

      {/* A direct child of the page, so it stays stuck for the whole scroll. */}
      <NarratorFilter narrators={narrators} selected={selected} onChange={setSelected} colorFor={colorFor} />

      <Box role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'journeys' && (
          <JourneysSection
            model={journeys}
            selected={selected}
            setSelected={setSelected}
            colorFor={colorFor}
            focusMoment={focusMoment}
            onShowEvent={showEvent}
          />
        )}
        {tab === 'canon' && (
          <CanonSection
            model={journeys}
            selected={selected}
            colorFor={colorFor}
            selectedEvent={selectedEvent}
            onSelectEvent={setSelectedEvent}
            onJumpToMoment={jumpToMoment}
          />
        )}
        {tab === 'system' && <SystemSection model={system} selectedNarrators={selected} narratorColor={colorFor} />}
      </Box>

      {tab !== 'system' && (
        <MethodNote>
          <p>
            Journey moments, events, stories and questions were extracted by AI from the interview transcripts and
            verified word for word: every quote appears in the recording exactly as transcribed, and every clip runs
            from the first quoted word to the last. Passages narrators asked to have cut are left out.
          </p>
          <p>
            Fortune scores, stages and estimated years are interpretations, not measurements. A fortune score reads how
            things were going for the narrator at that moment in their own telling; stages are a narrative grammar, not
            a claim that every career follows one shape. Years marked ≈ were worked out from what the narrator (or, in a
            few cases, the interviewer) said; hollow points were placed between dated moments.
          </p>
          <p>
            Narrators answered versions of a shared question list, so how often an event comes up partly reflects what
            was asked. Frequency is not importance, and absence from these interviews is not absence from history.
          </p>
        </MethodNote>
      )}
    </Box>
  );
};
