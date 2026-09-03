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
import { joinNames, plural, shorten, stamp } from '@/lib/insights/format';
import { useExploreStore } from '@/app/stores/useExploreStore';
import type { EvidenceClip, EvidenceQuestion, QuestionAnswer } from '@/types/insights';
import { CONFIDENCE, monoPlain, serif, t } from '../tokens';
import { BackLink, ConfidenceChip, Eyebrow, SegmentedToggle, Shell, TimestampPill } from './primitives';
import { SpeakerThumb } from './SpeakerThumb';
import { useInterviewRefs } from './useInterviewRefs';
import { useOpenExcerpt } from './useOpenExcerpt';

/** One excerpt inside an answer card. The whole block opens the side panel. */
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
        margin: '0 -10px',
        padding: '10px',
        borderRadius: '6px',
        '&:hover': { background: t.wash },
      }}>
      <Box component="blockquote" sx={{ ...serif(17, 1.62), m: 0, color: t.ink, textWrap: 'pretty' }}>
        “{clip.quote}”
      </Box>

      {clip.rationale && (
        <Box sx={{ fontSize: '12.5px', lineHeight: 1.55, color: t.muted2, mt: '10px' }}>{clip.rationale}</Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mt: '12px', flexWrap: 'wrap' }}>
        <TimestampPill
          seconds={clip.start}
          onClick={(event) => {
            event.stopPropagation();
            open();
          }}
        />
        <ConfidenceChip confidence={clip.confidence} />
      </Box>
    </Box>
  );
};

/** One leader's answer: their face and name, then everything they said. */
const AnswerCard = ({ answer }: { answer: QuestionAnswer }) => {
  const refs = useInterviewRefs();
  const uuid = refs[answer.interview_title]?.storyUuid;

  const header = (
    <>
      <SpeakerThumb
        interviewTitle={answer.interview_title}
        initials={answer.initials}
        time={answer.clips[0].start}
        size={52}
      />
      <Box sx={{ minWidth: 0 }}>
        <Box
          className="answer-name"
          sx={{
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '-0.005em',
            lineHeight: 1.3,
            color: t.ink,
            transition: 'color 0.12s',
          }}>
          {answer.name}
        </Box>
        <Box sx={{ ...monoPlain(10.5), color: t.muted3, mt: '3px' }}>
          {plural(answer.clips.length, 'excerpt')} · {stamp(answer.clips[0].start)}
        </Box>
      </Box>
    </>
  );

  const headerSx = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    pb: '14px',
    borderBottom: `1px solid ${t.ruleSoft}`,
    textDecoration: 'none',
    color: 'inherit',
  } as const;

  return (
    <Box
      sx={{
        background: t.surface,
        border: `1px solid ${t.rule}`,
        borderRadius: '8px',
        padding: '18px 20px 16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        '&:hover': { borderColor: t.fieldBorder, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' },
      }}>
      {/* The header opens the full interview; the excerpts below open the
          side panel at their own timestamps. */}
      {uuid ? (
        <Box
          component={Link}
          href={`/story/${uuid}`}
          title={`Open ${answer.name}'s interview`}
          sx={{ ...headerSx, '&:hover .answer-name': { color: t.accent } }}>
          {header}
        </Box>
      ) : (
        <Box sx={headerSx}>{header}</Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px', pt: '14px' }}>
        {answer.clips.map((clip, index) => (
          <Excerpt key={`${clip.start}-${index}`} clip={clip} />
        ))}
      </Box>
    </Box>
  );
};

/**
 * The people, as a row of faces directly under the question — who spoke to this,
 * who didn't, and a click to narrow the answers to one voice.
 */
const VoicesStrip = ({ question, answers }: { question: EvidenceQuestion; answers: QuestionAnswer[] }) => {
  const speakers = useExploreStore((s) => s.speakers);
  const toggleSpeaker = useExploreStore((s) => s.toggleSpeaker);
  const clearSpeakers = useExploreStore((s) => s.clearSpeakers);

  const rows = rosterFor(question);
  const firstStartByTitle = new Map(answers.map((a) => [a.interview_title, a.clips[0].start]));
  const initialsByTitle = new Map(answers.map((a) => [a.interview_title, a.initials]));

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        flexWrap: 'wrap',
        py: '18px',
        borderTop: `1px solid ${t.rule}`,
        borderBottom: `1px solid ${t.rule}`,
      }}>
      {rows.map((row) => {
        const answered = row.clipCount > 0;
        const on = speakers.includes(row.name);
        const dim = speakers.length > 0 && !on;
        const initials = initialsByTitle.get(row.interview_title) ?? row.name.slice(0, 2).toUpperCase();

        return (
          <Box
            key={row.interview_title}
            component="button"
            type="button"
            disabled={!answered}
            aria-pressed={on}
            title={answered ? `${row.name} — ${plural(row.clipCount, 'excerpt')}` : `${row.name} — did not answer`}
            onClick={() => answered && toggleSpeaker(row.name)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '6px 12px 6px 6px',
              border: `1px solid ${on ? t.accent : t.rule}`,
              borderRadius: '999px',
              background: on ? t.wash : t.surface,
              cursor: answered ? 'pointer' : 'default',
              fontFamily: 'inherit',
              textAlign: 'left',
              opacity: dim ? 0.5 : 1,
              transition: 'border-color 0.15s, background-color 0.15s, opacity 0.15s',
              '&:hover': answered ? { borderColor: t.accent } : {},
            }}>
            <SpeakerThumb
              interviewTitle={row.interview_title}
              initials={initials}
              time={firstStartByTitle.get(row.interview_title) ?? 60}
              size={36}
              radius="50%"
              muted={!answered}
            />
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ fontSize: '13px', fontWeight: 600, color: answered ? t.ink : t.muted4, lineHeight: 1.25 }}>
                {row.name}
              </Box>
              <Box sx={{ ...monoPlain(10), color: answered ? t.muted3 : t.muted4, mt: '1px' }}>
                {answered ? plural(row.clipCount, 'excerpt') : 'no answer'}
              </Box>
            </Box>
          </Box>
        );
      })}

      {speakers.length > 0 && (
        <Box
          component="button"
          type="button"
          onClick={clearSpeakers}
          sx={{
            ...monoPlain(10.5, 0.06),
            alignSelf: 'center',
            border: 'none',
            background: 'transparent',
            color: t.accent,
            cursor: 'pointer',
            padding: '6px 4px',
            '&:hover': { textDecoration: 'underline' },
          }}>
          show all
        </Box>
      )}
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
      : `${answers.length} of ${rosterSize} leaders answered · ${plural(totalClipCount, 'excerpt')}`;

  return (
    <Shell sx={{ pt: '22px', pb: '80px' }}>
      <BackLink href={theme ? `/explore/${theme.slug}` : '/explore'}>
        ← {theme ? theme.category : 'All themes'}
      </BackLink>

      {/* Question first, then the people, then their answers — one path down the page. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { md: 'flex-end' },
          justifyContent: 'space-between',
          gap: '32px',
          flexWrap: 'wrap',
          mt: '16px',
          mb: '18px',
        }}>
        {/* The theme is already named in the back link above; no need to repeat it. */}
        <Box sx={{ minWidth: 0, flex: '1 1 520px' }}>
          <Box
            component="h2"
            sx={{ ...serif(34, 1.22), m: 0, maxWidth: '24ch', letterSpacing: '-0.012em', textWrap: 'pretty' }}>
            {question.question}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Box component="span" sx={{ fontSize: '13px', color: t.muted }}>
            {coverageLine}
          </Box>
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
      </Box>

      <VoicesStrip question={question} answers={answers} />

      <Box
        sx={
          layout === 'compare'
            ? {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
                gap: '18px',
                alignItems: 'start',
                mt: '24px',
              }
            : { display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: 780, mt: '24px' }
        }>
        {shown.map((answer) => (
          <AnswerCard key={answer.interview_title} answer={answer} />
        ))}
      </Box>

      {silent.length > 0 && speakers.length === 0 && (
        <Box sx={{ mt: '32px', pt: '18px', borderTop: `1px solid ${t.rule}`, maxWidth: '70ch' }}>
          <Eyebrow tracking={0.12}>Not on the record here</Eyebrow>
          <Box sx={{ fontSize: '13.5px', lineHeight: 1.6, color: t.muted, mt: '8px' }}>
            {joinNames(silent)} did not speak to this question. The interview guide was a starting point, not a script
            — each conversation followed where the speaker went.
          </Box>
        </Box>
      )}

      {/* Reference material sits at the end, out of the reading path. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr' },
          gap: { xs: '24px', md: '48px' },
          mt: '40px',
          pt: '20px',
          borderTop: `1px solid ${t.rule}`,
        }}>
        <Box>
          <Eyebrow tracking={0.12} sx={{ mb: '8px' }}>
            Reading the labels
          </Eyebrow>
          <Box sx={{ fontSize: '12.5px', lineHeight: 1.65, color: t.muted2 }}>
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

        {siblings.length > 0 && (
          <Box>
            <Eyebrow tracking={0.12} sx={{ mb: '10px' }}>
              More in {theme?.category ?? 'this theme'}
            </Eyebrow>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: '8px 28px',
              }}>
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
                  {shorten(sibling.question, 74)}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Shell>
  );
};
