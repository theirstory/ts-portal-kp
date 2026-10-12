'use client';

import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import type { CanonEvent, Model } from '@/lib/journeys-canon/model';
import { mono, monoPlain, serif, shell, t } from '@/app/explore/tokens';
import { ClipLinks, FindingsStrip, fortuneLabel, Quote, SectionIntro, surname } from '../shared';
import type { Finding } from '../shared';
import { yearText } from '../journeys/JourneyChart';

type Props = {
  model: Model;
  selected: string[];
  colorFor: (slug: string) => string;
  selectedEvent: string | null;
  onSelectEvent: (id: string) => void;
  onJumpToMoment: (momentId: string) => void;
};

const yearsText = (e: Pick<CanonEvent, 'yearStart' | 'yearEnd'>) =>
  e.yearStart === null
    ? 'year not given'
    : e.yearEnd && e.yearEnd !== e.yearStart
      ? `${e.yearStart}–${e.yearEnd}`
      : String(e.yearStart);

const PROMPT_LABEL = {
  asked_directly: 'asked directly',
  narrators_choice: 'raised by narrator',
  follow_up: 'follow-up',
} as const;
const SOURCE_LABEL: Record<string, string> = {
  question_list: 'From the question list',
  written_for_narrator: 'Written for this narrator',
  improvised: 'Improvised',
};

const Tag = ({ children, title }: { children: React.ReactNode; title?: string }) => (
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

const SubHeading = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <Box component="h3" id={id} sx={{ m: 0, mt: 5, mb: 1.5, ...mono(11.5, 0.14), color: t.muted3 }}>
    {children}
  </Box>
);

export const CanonSection = ({ model, selected, colorFor, selectedEvent, onSelectEvent, onJumpToMoment }: Props) => {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = selected.length === model.narrators.length;
  const narratorBySlug = useMemo(() => new Map(model.narrators.map((n) => [n.slug, n])), [model]);
  const momentById = useMemo(() => new Map(model.moments.map((m) => [m.id, m])), [model]);
  const mentionById = useMemo(() => new Map(model.mentions.map((m) => [m.id, m])), [model]);
  const name = (slug: string) => narratorBySlug.get(slug)?.name ?? slug;

  // Shared events, re-ranked by how many of the selected narrators mention them.
  const shared = useMemo(() => {
    const list = model.events.filter((e) => e.narrators.length >= 2);
    if (allSelected) return list;
    const inSel = (e: CanonEvent) => e.narrators.filter((n) => selectedSet.has(n)).length;
    return [...list].sort((a, b) => inSel(b) - inSel(a) || b.narrators.length - a.narrators.length);
  }, [model, allSelected, selectedSet]);

  const event = model.events.find((e) => e.id === (selectedEvent ?? shared[0]?.id)) ?? shared[0];

  const findings = useMemo<Finding[]>(() => {
    const out: Finding[] = [];
    const top = model.findings.promptedEvents[0];
    const ev = top && model.events.find((e) => e.id === top.event);
    if (top && ev) {
      out.push({
        text:
          `The most-mentioned event, ${ev.name}, comes up with ${ev.narrators.length} narrators; ${top.askedDirectly} of ${top.mentions} mentions ` +
          `answered a question that named it${ev.onQuestionList ? ' (it is on the interview guide)' : ''}. How often an event comes up partly reflects what was asked.`,
        onSelect: () => onSelectEvent(ev.id),
      });
    }
    const opp = model.findings.oppositeFeelings[0];
    const oev = opp && model.events.find((e) => e.id === opp.event);
    if (opp && oev) {
      const hi = momentById.get(opp.high)!;
      const lo = momentById.get(opp.low)!;
      out.push({
        text: `${oev.name} felt very different from inside: ${fortuneLabel(hi.fortune)} for ${surname(name(hi.narrator))}, ${fortuneLabel(lo.fortune)} for ${surname(name(lo.narrator))}.`,
        onSelect: () => onSelectEvent(oev.id),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, momentById, onSelectEvent]);

  const stories = model.stories
    .filter((s) => selectedSet.has(s.narrator))
    .sort((a, b) => Number(b.featured) - Number(a.featured));
  const questions = model.questions.filter((q) => selectedSet.has(q.narrator));

  return (
    <Box>
      <SectionIntro title="The backbone stories">
        The events more than one narrator returns to, and the stories from each interview most worth retelling in an
        exhibit, a lesson plan, or onboarding.
      </SectionIntro>
      <FindingsStrip findings={findings} label="Canon findings" />

      <Box sx={{ ...shell, maxWidth: 1600, mt: 2.5 }}>
        <SubHeading>Shared events</SubHeading>
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' },
            alignItems: 'start',
          }}>
          {/* Ranked list */}
          <Box
            component="ol"
            aria-label="Shared events"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              border: `1px solid ${t.rule}`,
              borderRadius: '8px',
              background: t.surface,
            }}>
            {shared.map((e) => {
              const active = e.id === event?.id;
              const asked = e.askedDirectly;
              return (
                <Box
                  component="li"
                  key={e.id}
                  sx={{ borderTop: `1px solid ${t.ruleSoft}`, '&:first-of-type': { borderTop: 'none' } }}>
                  <Box
                    component="button"
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectEvent(e.id)}
                    sx={{
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: active ? t.wash : 'transparent',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      p: '10px 14px',
                      display: 'grid',
                      gap: '4px',
                      '&:hover': { background: active ? t.wash : t.surfaceHover },
                      '&:focus-visible': { outline: `2px solid ${t.accent}`, outlineOffset: '-2px' },
                    }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
                      <Box sx={{ fontSize: '14px', fontWeight: 600, color: active ? t.accentOnWash : t.ink }}>
                        {e.name}
                      </Box>
                      <Box sx={{ ...monoPlain(11), color: t.muted3, whiteSpace: 'nowrap' }}>{yearsText(e)}</Box>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                      <Dots
                        event={e}
                        narrators={model.narrators.map((n) => n.slug)}
                        selected={selectedSet}
                        colorFor={colorFor}
                        name={name}
                      />
                      <Box sx={{ ...monoPlain(10.5), color: t.muted3 }}>
                        {allSelected
                          ? `${e.narrators.length} narrators`
                          : `${e.narrators.filter((n) => selectedSet.has(n)).length} of ${selected.length} selected`}
                      </Box>
                      {e.onQuestionList && <Tag title="The interview guide names this event">on the question list</Tag>}
                      {asked > 0 && (
                        <Tag title="Mentions that answered a question naming the event">
                          asked directly {asked}/{e.mentions.length}
                        </Tag>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Event detail */}
          {event && (
            <Box
              component="section"
              aria-live="polite"
              aria-label={`${event.name}: views`}
              sx={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: '8px', p: { xs: 2, md: 2.5 } }}>
              <Box component="h3" sx={{ m: 0, ...serif(22, 1.25, 600), color: t.ink }}>
                {event.name}
              </Box>
              <Box sx={{ ...monoPlain(11.5), color: t.muted3, mt: 0.5 }}>
                {yearsText(event)} · {event.narrators.length} narrators · {event.askedDirectly} of{' '}
                {event.mentions.length} mentions asked directly
              </Box>

              <Box sx={{ mt: 2 }}>
                <Box sx={{ ...mono(10.5, 0.12), color: t.muted3, mb: 0.75 }}>How it felt at the time</Box>
                <FeltStrip
                  event={event}
                  selected={selectedSet}
                  name={name}
                  colorFor={colorFor}
                  momentById={momentById}
                  onJump={onJumpToMoment}
                />
              </Box>

              <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, mt: 2 }}>
                {event.mentions
                  .map((id) => mentionById.get(id)!)
                  .filter((m) => m && selectedSet.has(m.narrator))
                  .map((m) => (
                    <Box component="li" key={m.id} sx={{ py: 1.75, borderTop: `1px solid ${t.ruleSoft}` }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: t.ink,
                          flexWrap: 'wrap',
                        }}>
                        <Box
                          component="span"
                          aria-hidden="true"
                          sx={{ width: 8, height: 8, borderRadius: '50%', background: colorFor(m.narrator) }}
                        />
                        {name(m.narrator)}
                        <Tag title={`Asked: “${m.prompt.question}”`}>
                          {PROMPT_LABEL[m.prompt.type]}
                          {m.prompt.list_number ? ` · ${m.prompt.list_number}` : ''}
                        </Tag>
                      </Box>
                      <Box sx={{ mt: 0.75, fontSize: '14px', color: t.ink2 }}>{m.view}</Box>
                      <Box sx={{ mt: 1 }}>
                        <Quote color={colorFor(m.narrator)}>{m.quote}</Quote>
                      </Box>
                      <Box sx={{ mt: 0.75 }}>
                        <ClipLinks clip={m} narratorName={name(m.narrator)} quote={m.quote} />
                      </Box>
                    </Box>
                  ))}
              </Box>
            </Box>
          )}
        </Box>

        <SubHeading>Stories worth retelling</SubHeading>
        {stories.length === 0 && (
          <Box sx={{ fontSize: '14px', color: t.muted3 }}>Select narrators above to see their stories.</Box>
        )}
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
          }}>
          {stories.map((s) => (
            <Box
              component="article"
              key={s.id}
              sx={{
                background: t.surface,
                border: `1px solid ${t.rule}`,
                borderRadius: '8px',
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}>
              <Box component="h4" sx={{ m: 0, ...serif(18, 1.3, 600), color: t.ink }}>
                {s.title}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: t.muted3 }}>
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{ width: 7, height: 7, borderRadius: '50%', background: colorFor(s.narrator) }}
                />
                {name(s.narrator)}
              </Box>
              <Box sx={{ fontSize: '14px', lineHeight: 1.55, color: t.ink2 }}>{s.summary}</Box>
              <Quote color={colorFor(s.narrator)}>{s.quote}</Quote>
              <Box sx={{ fontSize: '12.5px', color: t.muted3 }}>Why retell it: {s.why}</Box>
              <Box sx={{ mt: 'auto' }}>
                <ClipLinks clip={s} narratorName={name(s.narrator)} quote={s.quote} />
              </Box>
            </Box>
          ))}
        </Box>

        <SubHeading>Questions that opened things up</SubHeading>
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}>
          {questions.map((q) => (
            <Box
              component="li"
              key={q.id}
              sx={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: '8px', p: 2 }}>
              <Box sx={{ ...serif(17, 1.45), color: t.ink }}>“{q.question}”</Box>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '8px',
                  mt: 1,
                  fontSize: '12.5px',
                  color: t.muted3,
                }}>
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{ width: 7, height: 7, borderRadius: '50%', background: colorFor(q.narrator) }}
                />
                asked of {name(q.narrator)}
                <Tag>
                  {SOURCE_LABEL[q.source] ?? q.source}
                  {q.list_number ? ` · ${q.list_number}` : ''}
                </Tag>
              </Box>
              <Box sx={{ mt: 0.75, fontSize: '14px', color: t.ink2 }}>What it drew out: {q.why}</Box>
              <Box sx={{ mt: 0.75 }}>
                <ClipLinks clip={q} narratorName={name(q.narrator)} quote={q.question} />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

/** One dot per narrator in a fixed order: filled when they mention the event. */
const Dots = ({
  event,
  narrators,
  selected,
  colorFor,
  name,
}: {
  event: CanonEvent;
  narrators: string[];
  selected: Set<string>;
  colorFor: (slug: string) => string;
  name: (slug: string) => string;
}) => (
  <Box
    component="span"
    role="img"
    aria-label={`Mentioned by ${event.narrators.map(name).join(', ')}`}
    sx={{ display: 'inline-flex', gap: '3px' }}>
    {narrators.map((n) => {
      const mentions = event.narrators.includes(n);
      const on = selected.has(n);
      return (
        <Box
          component="span"
          key={n}
          title={`${name(n)}${mentions ? '' : ' — not mentioned'}`}
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            border: `1.5px solid ${mentions ? (on ? colorFor(n) : t.dotEmpty) : t.dotEmpty}`,
            background: mentions ? (on ? colorFor(n) : t.dotEmpty) : 'transparent',
            opacity: on ? 1 : 0.45,
          }}
        />
      );
    })}
  </Box>
);

/** Each narrator's fortune near the event, on a −3..3 strip; a narrator's name jumps to that point on the journey chart. */
const FeltStrip = ({
  event,
  selected,
  name,
  colorFor,
  momentById,
  onJump,
}: {
  event: CanonEvent;
  selected: Set<string>;
  name: (slug: string) => string;
  colorFor: (slug: string) => string;
  momentById: Map<string, Model['moments'][number]>;
  onJump: (momentId: string) => void;
}) => {
  const rows = event.feltAtTime
    .filter((f) => selected.has(f.narrator))
    .map((f) => ({ narrator: f.narrator, moments: f.moments.map((id) => momentById.get(id)!).filter(Boolean) }));
  const W = 210;
  const X = (f: number) => 6 + ((f + 3) / 6) * (W - 12);
  if (!rows.some((r) => r.moments.length)) {
    return (
      <Box sx={{ fontSize: '13px', color: t.muted3 }}>
        No journey moments from the selected narrators sit at this event’s time.
      </Box>
    );
  }
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(110px, max-content) auto',
        columnGap: 1.5,
        rowGap: 0.5,
        alignItems: 'center',
      }}>
      <Box />
      <Box
        aria-hidden="true"
        sx={{ display: 'flex', justifyContent: 'space-between', width: W, ...monoPlain(10), color: t.muted4 }}>
        <span>−3</span>
        <span>0</span>
        <span>+3</span>
      </Box>
      {rows.map((r) => {
        const first = r.moments[0];
        return (
          <React.Fragment key={r.narrator}>
            <Box
              component="button"
              type="button"
              disabled={!first}
              onClick={() => first && onJump(first.id)}
              title={first ? 'Show on the journey chart' : 'No moment near this event'}
              sx={{
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                p: 0,
                fontFamily: 'inherit',
                fontSize: '13px',
                color: first ? t.accent : t.muted4,
                cursor: first ? 'pointer' : 'default',
                textDecoration: first ? 'underline' : 'none',
              }}>
              {surname(name(r.narrator))}
            </Box>
            <svg
              width={W}
              height={16}
              role="img"
              aria-label={
                r.moments.map((m) => `${yearText(m)} ${m.label}: ${fortuneLabel(m.fortune)}`).join('; ') || 'no moment'
              }>
              <line x1={6} x2={W - 6} y1={8} y2={8} stroke="#e0e0e0" />
              <line x1={X(0)} x2={X(0)} y1={3} y2={13} stroke="#bdbdbd" />
              {r.moments.map((m) => (
                <circle
                  key={m.id}
                  cx={X(m.fortune)}
                  cy={8}
                  r={4.5}
                  fill={m.placement === 'interpolated' ? '#fff' : colorFor(r.narrator)}
                  stroke={colorFor(r.narrator)}
                  strokeWidth={1.5}>
                  <title>{`${yearText(m)} ${m.label} (${fortuneLabel(m.fortune)})`}</title>
                </circle>
              ))}
            </svg>
          </React.Fragment>
        );
      })}
    </Box>
  );
};
