'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Box } from '@mui/material';
import { joinNames, plural, shorten, stamp } from '@/lib/insights/format';
import { useExploreStore } from '@/app/stores/useExploreStore';
import type { EvidenceClip, EvidenceQuestion, QuestionAnswer } from '@/types/insights';
import { CONFIDENCE, monoPlain, serif, t } from '../tokens';
import { useEvidence } from './EvidenceProvider';
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

/** Speaker chips shown before "show all"; the rest wait behind the toggle. */
const COLLAPSED_SPEAKERS = 12;

/**
 * The people who answered, as compact chips directly under the question — most
 * excerpts first, a click narrows the answers to one voice. Those who didn't
 * answer are summed up in one line, so the strip stays short as the archive grows.
 */
const VoicesStrip = ({ question, answers }: { question: EvidenceQuestion; answers: QuestionAnswer[] }) => {
  const { rosterFor } = useEvidence();
  const speakers = useExploreStore((s) => s.speakers);
  const toggleSpeaker = useExploreStore((s) => s.toggleSpeaker);
  const clearSpeakers = useExploreStore((s) => s.clearSpeakers);

  const [expanded, setExpanded] = useState(false);

  const all = rosterFor(question);
  const answeredRows = all.filter((row) => row.clipCount > 0).sort((a, b) => b.clipCount - a.clipCount);
  const silentRows = all.filter((row) => row.clipCount === 0);
  // Never hide a chip that is currently selected.
  const rows =
    expanded || answeredRows.length <= COLLAPSED_SPEAKERS
      ? answeredRows
      : answeredRows.filter((row, i) => i < COLLAPSED_SPEAKERS || speakers.includes(row.name));
  const hidden = answeredRows.length - rows.length;
  const firstStartByTitle = new Map(answers.map((a) => [a.interview_title, a.clips[0].start]));
  const initialsByTitle = new Map(answers.map((a) => [a.interview_title, a.initials]));

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        py: '18px',
        borderTop: `1px solid ${t.rule}`,
        borderBottom: `1px solid ${t.rule}`,
      }}>
      {rows.map((row) => {
        const on = speakers.includes(row.name);
        const dim = speakers.length > 0 && !on;
        const initials = initialsByTitle.get(row.interview_title) ?? row.name.slice(0, 2).toUpperCase();

        return (
          <Box
            key={row.interview_title}
            component="button"
            type="button"
            aria-pressed={on}
            title={`${row.name} — ${plural(row.clipCount, 'excerpt')}`}
            onClick={() => toggleSpeaker(row.name)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '3px 11px 3px 3px',
              border: `1px solid ${on ? t.accent : t.rule}`,
              borderRadius: '999px',
              background: on ? t.wash : t.surface,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              opacity: dim ? 0.5 : 1,
              transition: 'border-color 0.15s, background-color 0.15s, opacity 0.15s',
              '&:hover': { borderColor: t.accent },
            }}>
            <SpeakerThumb
              interviewTitle={row.interview_title}
              initials={initials}
              time={firstStartByTitle.get(row.interview_title) ?? 60}
              size={24}
              radius="50%"
            />
            <Box sx={{ fontSize: '12.5px', fontWeight: 600, color: t.ink, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              {row.name}
            </Box>
            <Box sx={{ ...monoPlain(10), color: t.muted3 }}>{row.clipCount}</Box>
          </Box>
        );
      })}

      {(hidden > 0 || expanded) && answeredRows.length > COLLAPSED_SPEAKERS && (
        <Box
          component="button"
          type="button"
          onClick={() => setExpanded((open) => !open)}
          sx={{
            ...monoPlain(10.5, 0.06),
            border: 'none',
            background: 'transparent',
            color: t.accent,
            cursor: 'pointer',
            padding: '6px 4px',
            '&:hover': { textDecoration: 'underline' },
          }}>
          {expanded ? 'show fewer' : `+${hidden} more`}
        </Box>
      )}

      {silentRows.length > 0 && (
        <Box
          title={silentRows.map((row) => row.name).join(', ')}
          sx={{ ...monoPlain(10.5), color: t.muted4, padding: '6px 4px' }}>
          {silentRows.length} didn&apos;t answer
        </Box>
      )}

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
export const QuestionView = ({ questionId }: { questionId: number }) => {
  const { answersFor, getQuestion, getThemeByCategory, rosterSize, siblingsOf, silentFor } = useEvidence();
  // The page checked it exists in this request's bank.
  const question = getQuestion(questionId)!;
  const layout = useExploreStore((s) => s.layout);
  const setLayout = useExploreStore((s) => s.setLayout);
  const speakers = useExploreStore((s) => s.speakers);
  const clearSpeakers = useExploreStore((s) => s.clearSpeakers);

  // The roster filter belongs to one question — starting a new one clears it.
  useEffect(() => {
    clearSpeakers();
  }, [question.question_id, clearSpeakers]);

  const answers = useMemo(() => answersFor(question), [answersFor, question]);
  const shown = speakers.length > 0 ? answers.filter((answer) => speakers.includes(answer.name)) : answers;
  const silent = useMemo(() => silentFor(question), [silentFor, question]);
  const siblings = useMemo(() => siblingsOf(question), [siblingsOf, question]);
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
            {joinNames(silent)} did not speak to this question. The interview guide was a starting point, not a script —
            each conversation followed where the speaker went.
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
