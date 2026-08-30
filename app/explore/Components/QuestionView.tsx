'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Box } from '@mui/material';
import {
  answersFor,
  getThemeByCategory,
  rosterFor,
  rosterSize,
  siblingsOf,
  silentFor,
} from '@/lib/insights/evidenceBank';
import { categorySlug, joinNames, plural, shorten, stamp } from '@/lib/insights/format';
import { useExploreStore } from '@/app/stores/useExploreStore';
import { useOpenExcerpt } from './useOpenExcerpt';
import type { EvidenceClip, EvidenceQuestion, QuestionAnswer } from '@/types/insights';
import { CONFIDENCE, mono, monoPlain, serif, t } from '../tokens';
import { BackLink, ConfidenceChip, Eyebrow, MonoButton, SegmentedToggle, Shell, TimestampPill } from './primitives';

/** One excerpt inside an answer card. The whole block opens the drawer. */
const Excerpt = ({ clip }: { clip: EvidenceClip }) => {
  const openExcerpt = useOpenExcerpt();
  const open = () => openExcerpt(clip);

  return (
    <Box
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      sx={{
        cursor: 'pointer',
        margin: '-6px -8px',
        padding: '6px 8px',
        borderRadius: '2px',
        '&:hover': { background: t.wash },
      }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '9px' }}>
        <ConfidenceChip confidence={clip.confidence} />
      </Box>
      <Box component="blockquote" sx={{ ...serif(16.5, 1.6), m: 0, color: t.ink, textWrap: 'pretty' }}>
        “{clip.quote}”
      </Box>
      {clip.rationale && (
        <Box
          sx={{
            fontSize: '12px',
            lineHeight: 1.5,
            color: t.muted2,
            mt: '10px',
            pl: '12px',
            borderLeft: `1px solid ${t.rule}`,
          }}>
          {clip.rationale}
        </Box>
      )}
      <Box sx={{ mt: '12px' }}>
        <TimestampPill
          seconds={clip.start}
          onClick={(event) => {
            event.stopPropagation();
            open();
          }}
        />
      </Box>
    </Box>
  );
};

/** One leader's answer: who they are, then each excerpt in order. */
const AnswerCard = ({ answer }: { answer: QuestionAnswer }) => (
  <Box
    sx={{
      background: t.surface,
      border: `1px solid ${t.rule}`,
      borderTop: `2px solid ${t.ink}`,
      padding: '20px 22px 18px',
    }}>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '11px',
        pb: '14px',
        borderBottom: `1px solid ${t.ruleSoft}`,
      }}>
      <Box
        sx={{
          ...monoPlain(11, 0.02),
          width: 30,
          height: 30,
          flex: 'none',
          borderRadius: '50%',
          background: t.avatarBg,
          color: t.avatarFg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {answer.initials}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.005em' }}>{answer.name}</Box>
        <Box sx={{ ...monoPlain(10.5), color: t.muted3, mt: '2px' }}>
          {plural(answer.clips.length, 'excerpt')} · {stamp(answer.clips[0].start)}
        </Box>
      </Box>
    </Box>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '18px', pt: '16px' }}>
      {answer.clips.map((clip, index) => (
        <Excerpt key={`${clip.start}-${index}`} clip={clip} />
      ))}
    </Box>
  </Box>
);

/** "Who answered": multi-select filter over the respondents. */
const RosterPanel = ({ question, answers }: { question: EvidenceQuestion; answers: QuestionAnswer[] }) => {
  const speakers = useExploreStore((s) => s.speakers);
  const toggleSpeaker = useExploreStore((s) => s.toggleSpeaker);
  const setSpeakers = useExploreStore((s) => s.setSpeakers);
  const clearSpeakers = useExploreStore((s) => s.clearSpeakers);

  const rows = rosterFor(question);
  const answeredNames = answers.map((answer) => answer.name);
  const allSelected = speakers.length > 0 && speakers.length === answeredNames.length;

  return (
    <Box>
      <Box sx={{ border: `1px solid ${t.rule}`, background: t.surface }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderBottom: `1px solid ${t.ruleSoft}`,
          }}>
          <Eyebrow tracking={0.12} sx={{ flex: 1 }}>
            Who answered
          </Eyebrow>
          <MonoButton onClick={() => setSpeakers(answeredNames)} active={allSelected}>
            all
          </MonoButton>
          <MonoButton onClick={clearSpeakers}>clear</MonoButton>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((row) => {
            const answered = row.clipCount > 0;
            const on = speakers.includes(row.name);
            const dim = speakers.length > 0 && !on;

            return (
              <Box
                key={row.interview_title}
                component="button"
                type="button"
                disabled={!answered}
                aria-pressed={on}
                onClick={() => answered && toggleSpeaker(row.name)}
                sx={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 16px',
                  border: 'none',
                  borderBottom: `1px solid ${t.ruleSoft}`,
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  textAlign: 'left',
                  cursor: answered ? 'pointer' : 'default',
                  background: on ? t.wash : 'transparent',
                  color: answered ? (dim ? t.dim : t.ink) : t.muted4,
                }}>
                <Box
                  component="span"
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    flex: 'none',
                    background: answered && (on || speakers.length === 0) ? t.accent : 'transparent',
                    border: `1px solid ${answered ? t.accent : t.dotEmpty}`,
                  }}
                />
                <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                  {row.name}
                </Box>
                <Box component="span" sx={{ ...monoPlain(10.5), color: t.muted4 }}>
                  {answered ? `${row.clipCount}×` : '—'}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {speakers.length > 0 && (
        <Box sx={{ ...monoPlain(10.5), color: t.accent, mt: '10px', lineHeight: 1.6 }}>
          Filtered to {speakers.length} of {answeredNames.length} respondents — tap a name to remove, or clear to see
          all.
        </Box>
      )}

      {/* Each term carries its chip's colour so the legend reads straight onto
          the excerpts above it. */}
      <Box sx={{ fontSize: '12px', lineHeight: 1.6, color: t.muted2, mt: '16px' }}>
        <Box component="span" sx={{ fontWeight: 600, color: CONFIDENCE.high.fg }}>
          {CONFIDENCE.high.label}
        </Box>{' '}
        answers the question as asked.{' '}
        <Box component="span" sx={{ fontWeight: 600, color: CONFIDENCE.medium.fg }}>
          {CONFIDENCE.medium.label}
        </Box>{' '}
        speaks to it from another angle in the interview.{' '}
        <Box component="span" sx={{ fontWeight: 600, color: CONFIDENCE.low.fg }}>
          {CONFIDENCE.low.label}
        </Box>{' '}
        touches it in passing.
      </Box>
    </Box>
  );
};

/** How every leader answered one question, side by side. */
export const QuestionView = ({ question }: { question: EvidenceQuestion }) => {
  const layout = useExploreStore((s) => s.layout);
  const setLayout = useExploreStore((s) => s.setLayout);
  const speakers = useExploreStore((s) => s.speakers);
  const clearSpeakers = useExploreStore((s) => s.clearSpeakers);

  // The roster filter belongs to one question — starting a new one clears it.
  useEffect(() => {
    clearSpeakers();
  }, [question.question_id, clearSpeakers]);

  const answers = useMemo(() => answersFor(question), [question]);
  const shown = speakers.length > 0 ? answers.filter((answer) => speakers.includes(answer.name)) : answers;
  const silent = useMemo(() => silentFor(question), [question]);
  const siblings = useMemo(() => siblingsOf(question), [question]);
  const theme = getThemeByCategory(question.category);

  const shownClipCount = shown.reduce((sum, answer) => sum + answer.clips.length, 0);
  const totalClipCount = answers.reduce((sum, answer) => sum + answer.clips.length, 0);

  const coverageLine =
    speakers.length > 0
      ? `Showing ${shown.length} of ${answers.length} respondents · ${plural(shownClipCount, 'excerpt')}`
      : `${answers.length} of ${rosterSize} leaders addressed this · ${plural(totalClipCount, 'excerpt')}`;

  return (
    <Shell sx={{ pt: '26px', pb: '100px' }}>
      <BackLink href="/explore">← All themes</BackLink>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 300px' },
          gap: { xs: '32px', md: '48px' },
          alignItems: 'start',
          mt: '22px',
        }}>
        <Box sx={{ minWidth: 0 }}>
          <Box
            component={Link}
            href={theme ? `/explore/${theme.slug}` : `/explore/${categorySlug(question.category)}`}
            sx={{
              ...mono(11, 0.14),
              display: 'inline-block',
              color: t.accent,
              textDecoration: 'none',
              mb: '12px',
              '&:hover': { color: t.accentHover },
            }}>
            {question.category} ↗
          </Box>
          <Box
            component="h2"
            sx={{ ...serif(32, 1.25), m: 0, maxWidth: '30ch', letterSpacing: '-0.01em', textWrap: 'pretty' }}>
            {question.question}
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              mt: '18px',
              pb: '20px',
              borderBottom: `1px solid ${t.rule}`,
              flexWrap: 'wrap',
            }}>
            <Box component="span" sx={{ fontSize: '13px', color: t.muted }}>
              {coverageLine}
            </Box>
            <Box sx={{ flex: 1 }} />
            <SegmentedToggle
              value={layout}
              onChange={setLayout}
              padding="7px 15px"
              options={[
                { value: 'compare' as const, label: 'Compare' },
                { value: 'read' as const, label: 'Read' },
              ]}
            />
          </Box>

          <Box
            sx={
              layout === 'compare'
                ? {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '20px',
                    alignItems: 'start',
                    mt: '26px',
                  }
                : { display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: 760, mt: '26px' }
            }>
            {shown.map((answer) => (
              <AnswerCard key={answer.interview_title} answer={answer} />
            ))}
          </Box>

          {silent.length > 0 && (
            <Box sx={{ mt: '32px', pt: '20px', borderTop: `1px solid ${t.rule}` }}>
              <Eyebrow tracking={0.12}>Not on the record here</Eyebrow>
              <Box sx={{ fontSize: '13.5px', lineHeight: 1.6, color: t.muted, mt: '8px', maxWidth: '62ch' }}>
                {joinNames(silent)} did not speak to this question. The interview guide was a starting point, not a
                script — each conversation followed where the speaker went.
              </Box>
            </Box>
          )}
        </Box>

        <Box sx={{ position: { md: 'sticky' }, top: { md: '110px' } }}>
          <RosterPanel question={question} answers={answers} />

          {siblings.length > 0 && (
            <Box sx={{ mt: '18px', pt: '16px', borderTop: `1px solid ${t.rule}` }}>
              <Eyebrow tracking={0.12} sx={{ mb: '10px' }}>
                Next in this theme
              </Eyebrow>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {siblings.map((sibling) => (
                  <Box
                    key={sibling.question_id}
                    component={Link}
                    href={`/explore/q/${sibling.question_id}`}
                    sx={{
                      fontSize: '13px',
                      lineHeight: 1.45,
                      color: t.ink2,
                      textDecoration: 'none',
                      '&:hover': { color: t.accent },
                    }}>
                    {shorten(sibling.question, 80)}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Shell>
  );
};
