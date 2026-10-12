'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import type { Model, Moment } from '@/lib/journeys-canon/model';
import { mono, monoPlain, serif, shell, t } from '@/app/explore/tokens';
import {
  Chip,
  ClipLinks,
  FindingsStrip,
  fortuneLabel,
  Label,
  Quote,
  SectionIntro,
  STAGE_LABELS,
  surname,
} from '../shared';
import type { Finding } from '../shared';
import { JourneyChart, yearText } from './JourneyChart';

type Props = {
  model: Model;
  selected: string[];
  setSelected: (slugs: string[]) => void;
  colorFor: (slug: string) => string;
  /** A moment another section asked to show (e.g. from an event's "how it felt"). */
  focusMoment: string | null;
  onShowEvent: (eventId: string) => void;
};

/** The finding's default point: the sharpest "same event, opposite feeling", else the first moment. */
export const defaultMoment = (model: Model): string | null =>
  model.findings.oppositeFeelings[0]?.high ?? model.moments[0]?.id ?? null;

export const JourneysSection = ({ model, selected, setSelected, colorFor, focusMoment, onShowEvent }: Props) => {
  const [view, setView] = useState<'overlay' | 'multiples'>('overlay');
  const [selectedMoment, setSelectedMoment] = useState<string | null>(focusMoment ?? defaultMoment(model));
  const chartRef = useRef<HTMLDivElement>(null);

  const narratorBySlug = useMemo(() => new Map(model.narrators.map((n) => [n.slug, n])), [model]);
  const momentById = useMemo(() => new Map(model.moments.map((m) => [m.id, m])), [model]);
  const eventById = useMemo(() => new Map(model.events.map((e) => [e.id, e])), [model]);
  const visibleMoments = useMemo(() => model.moments.filter((m) => m.review_status !== 'hidden'), [model]);

  const lines = useMemo(
    () =>
      model.narrators.map((n) => ({
        slug: n.slug,
        name: n.name,
        lowConfidence: n.lowConfidence,
        moments: visibleMoments.filter((m) => m.narrator === n.slug),
      })),
    [model, visibleMoments],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = selected.length === model.narrators.length;

  useEffect(() => {
    if (!focusMoment) return;
    setSelectedMoment(focusMoment);
    chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusMoment]);

  // If the selected moment's narrator is filtered out, fall back to one that is shown.
  const current = selectedMoment ? momentById.get(selectedMoment) : undefined;
  const shown =
    current && selectedSet.has(current.narrator) ? current : visibleMoments.find((m) => selectedSet.has(m.narrator));

  const select = (m: Moment) => setSelectedMoment(m.id);

  const findings = useMemo<Finding[]>(() => {
    const out: Finding[] = [];
    const f = model.findings;
    const name = (slug: string) => surname(narratorBySlug.get(slug)?.name ?? slug);
    const opp = f.oppositeFeelings[0];
    if (opp) {
      const hi = momentById.get(opp.high)!;
      const lo = momentById.get(opp.low)!;
      const ev = eventById.get(opp.event);
      out.push({
        text: `${ev?.name ?? 'The same event'}, opposite feelings: “${hi.fortune_basis}” for ${name(hi.narrator)} (${fortuneLabel(hi.fortune)}), a low point for ${name(lo.narrator)} (${fortuneLabel(lo.fortune)}).`,
        onSelect: () => {
          setSelected([hi.narrator, lo.narrator]);
          setSelectedMoment(hi.id);
        },
      });
    }
    const low = [...f.sharedLows].sort((a, b) => b.narrators.length - a.narrators.length)[0];
    if (low) {
      const estimated = low.moments.some((id) => momentById.get(id)?.placement === 'interpolated');
      out.push({
        text: `Shared low, ${low.from}–${low.to}: ${low.narrators.map(name).join(', ')} each describe a hard moment (−2 or lower)${estimated ? ', some at estimated years' : ''}.`,
        onSelect: () => {
          setSelected(low.narrators);
          setSelectedMoment(low.moments[0]);
        },
      });
    }
    if (f.personalLows.length) {
      const deepest = f.personalLows.map((p) => momentById.get(p.moment)!).sort((a, b) => a.fortune - b.fortune)[0];
      out.push({
        text: `For ${f.personalLows.length} of ${model.narrators.length} narrators the lowest point is personal, not a shared event. The deepest: ${name(deepest.narrator)}, “${deepest.label.toLowerCase()}” (${fortuneLabel(deepest.fortune)}).`,
        onSelect: () => {
          setSelected([deepest.narrator]);
          setSelectedMoment(deepest.id);
        },
      });
    }
    return out;
  }, [model, momentById, eventById, narratorBySlug, setSelected]);

  const multiplesShown = lines.filter((l) => selectedSet.has(l.slug));

  return (
    <Box>
      <SectionIntro title="How it felt, year by year">
        Each line is one narrator’s career, plotted by how things were going in their own telling. Dips are setbacks;
        peaks are breakthroughs. Hollow points have estimated years. Select any point to hear that moment.
      </SectionIntro>
      <FindingsStrip findings={findings} label="Journey findings" />

      <Box
        sx={{
          ...shell,
          maxWidth: 1600,
          mt: 2.5,
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 380px' },
          alignItems: 'start',
        }}>
        <Box sx={{ minWidth: 0 }} ref={chartRef}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', mb: 1 }}>
            <Label>View</Label>
            <Chip on={view === 'overlay'} onClick={() => setView('overlay')}>
              All lines
            </Chip>
            <Chip
              on={view === 'multiples'}
              onClick={() => setView('multiples')}
              title="One small chart per selected narrator, on a shared scale">
              Small multiples
            </Chip>
          </Box>

          {view === 'overlay' ? (
            <Box
              sx={{
                background: t.surface,
                border: `1px solid ${t.rule}`,
                borderRadius: '8px',
                // Phone widths: the chart scrolls sideways inside its card, never the page.
                overflowX: 'auto',
                p: { xs: 1, md: 1.5 },
              }}>
              <JourneyChart
                label="Narrators' journeys over time. Each point is a button."
                lines={lines}
                yearRange={model.yearRange}
                bands={model.bands}
                selected={selectedSet}
                allSelected={allSelected}
                colorFor={colorFor}
                selectedMoment={shown?.id ?? null}
                onSelect={select}
              />
            </Box>
          ) : (
            <Box
              sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
              {multiplesShown.length === 0 && (
                <Box sx={{ fontSize: '14px', color: t.muted3 }}>Select narrators above to compare them.</Box>
              )}
              {multiplesShown.map((line) => (
                <Box
                  key={line.slug}
                  sx={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: '8px', p: 1.25 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      fontSize: '13px',
                      fontWeight: 600,
                      mb: 0.5,
                    }}>
                    <Box
                      component="span"
                      aria-hidden="true"
                      sx={{ width: 8, height: 8, borderRadius: '50%', background: colorFor(line.slug) }}
                    />
                    {line.name}
                    {line.lowConfidence && (
                      <Box component="span" sx={{ ...monoPlain(10), color: t.muted4, fontWeight: 400 }}>
                        mostly estimated years
                      </Box>
                    )}
                  </Box>
                  <JourneyChart
                    compact
                    label={`${line.name}'s journey`}
                    lines={[line]}
                    yearRange={model.yearRange}
                    bands={model.bands}
                    selected={new Set([line.slug])}
                    allSelected={false}
                    colorFor={colorFor}
                    selectedMoment={shown?.id ?? null}
                    onSelect={select}
                    pxPerYear={6}
                    plotHeight={110}
                  />
                </Box>
              ))}
            </Box>
          )}
          <Legend />
        </Box>

        <Box sx={{ position: { lg: 'sticky' }, top: { lg: 120 } }}>
          {shown ? (
            <MomentPanel
              moment={shown}
              narrator={narratorBySlug.get(shown.narrator)!}
              color={colorFor(shown.narrator)}
              eventName={shown.event ? eventById.get(shown.event)?.name : undefined}
              eventShared={shown.event ? (eventById.get(shown.event)?.narrators.length ?? 0) >= 2 : false}
              onShowEvent={onShowEvent}
            />
          ) : (
            <Box sx={{ fontSize: '14px', color: t.muted3 }}>Select narrators above to see their journeys.</Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const MomentPanel = ({
  moment: m,
  narrator,
  color,
  eventName,
  eventShared,
  onShowEvent,
}: {
  moment: Moment;
  narrator: Model['narrators'][number];
  color: string;
  eventName?: string;
  eventShared: boolean;
  onShowEvent: (id: string) => void;
}) => {
  const estimated = m.placement !== 'stated';
  return (
    <Box
      component="section"
      aria-live="polite"
      aria-label="Selected moment"
      sx={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: '8px', p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: t.ink }}>
        <Box component="span" aria-hidden="true" sx={{ width: 9, height: 9, borderRadius: '50%', background: color }} />
        {narrator.name}
      </Box>
      <Box component="h3" sx={{ m: 0, mt: 1, ...serif(21, 1.3, 600), color: t.ink }}>
        {m.label}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px', mt: 1, alignItems: 'center' }}>
        <Box
          component="span"
          title={
            m.placement === 'interpolated'
              ? 'Year not given; placed between the narrator’s dated moments.'
              : m.year_note || undefined
          }
          sx={{
            ...monoPlain(12),
            color: t.ink,
            border: `1px ${estimated ? 'dashed' : 'solid'} ${t.rule}`,
            borderRadius: '3px',
            px: '6px',
            py: '1px',
          }}>
          {yearText(m)}
          {m.placement === 'interpolated' ? ' · estimated' : m.placement === 'inferred' ? ' · inferred' : ''}
        </Box>
        <Box component="span" sx={{ ...mono(10, 0.08), color: t.muted3 }}>
          {STAGE_LABELS[m.stage] ?? m.stage}
        </Box>
        <Box
          component="span"
          title="Fortune: how things were going for them then, in their own telling (−3 to +3). An interpretation."
          sx={{
            ...monoPlain(12),
            fontWeight: 600,
            color: m.fortune > 0 ? '#1b7550' : m.fortune < 0 ? '#bf4317' : t.muted3,
          }}>
          {fortuneLabel(m.fortune)}
        </Box>
      </Box>
      {m.year_note && m.placement === 'inferred' && (
        <Box sx={{ mt: 0.75, fontSize: '12.5px', color: t.muted3 }}>{m.year_note}</Box>
      )}
      <Box sx={{ mt: 1.5 }}>
        <Quote color={color}>{m.quote}</Quote>
      </Box>
      <Box sx={{ mt: 1 }}>
        <ClipLinks clip={m} narratorName={narrator.name} quote={m.quote} />
      </Box>
      {eventName && (
        <Box sx={{ mt: 1.5, fontSize: '13px', color: t.muted3 }}>
          About:{' '}
          {eventShared ? (
            <Box
              component="button"
              type="button"
              onClick={() => onShowEvent(m.event!)}
              sx={{
                border: 'none',
                background: 'transparent',
                p: 0,
                color: t.accent,
                cursor: 'pointer',
                fontSize: '13px',
                textDecoration: 'underline',
              }}>
              {eventName}
            </Box>
          ) : (
            eventName
          )}
        </Box>
      )}
      <Box
        sx={{
          mt: 2,
          pt: 1.5,
          borderTop: `1px solid ${t.ruleSoft}`,
          fontSize: '13.5px',
          lineHeight: 1.5,
          color: t.ink2,
        }}>
        {narrator.one_line}
        {narrator.lowConfidence && (
          <Box component="span" sx={{ display: 'block', mt: 0.5, ...monoPlain(11), color: t.muted4 }}>
            Most of this narrator’s years are estimated; their line is dashed.
          </Box>
        )}
      </Box>
    </Box>
  );
};

const Legend = () => (
  <Box
    aria-label="Legend"
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px 20px',
      alignItems: 'center',
      mt: 1.25,
      fontSize: '12.5px',
      color: t.muted3,
    }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <svg width="14" height="14" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" fill="#4b6a83" />
      </svg>
      year stated or worked out from the interview
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <svg width="14" height="14" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" fill="#fff" stroke="#4b6a83" strokeWidth="1.6" />
      </svg>
      estimated year (placed between dated moments)
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <svg width="34" height="10" aria-hidden="true">
        <line x1="1" y1="5" x2="33" y2="5" stroke="#4b6a83" strokeWidth="2" strokeDasharray="5 4" />
      </svg>
      mostly estimated years
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <svg width="22" height="12" aria-hidden="true">
        <rect x="1" y="1" width="20" height="10" fill="rgba(0, 120, 179, 0.12)" />
      </svg>
      shared event
    </Box>
    <Box sx={{ ...monoPlain(11.5) }}>+3 a peak · 0 neutral · −3 a low point, in their own telling</Box>
  </Box>
);
