'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Box } from '@mui/material';
import {
  allClipsFor,
  collectionVoices,
  questionClipCount,
  respondentCount,
  roster,
  rosterSize,
  voicesFor,
} from '@/lib/insights/evidenceBank';
import { plural } from '@/lib/insights/format';
import { useExploreStore } from '@/app/stores/useExploreStore';
import { useOpenExcerpt } from './useOpenExcerpt';
import type { EvidenceClip, EvidenceQuestion, ThemeSummary } from '@/types/insights';
import { mono, monoPlain, serif, t } from '../tokens';
import { BackLink, ConfidenceChip, Eyebrow, MonoButton, SegmentedToggle, Shell, TimestampPill } from './primitives';
import { FaceRow } from './PeopleBand';
import { useInterviewRefs } from './useInterviewRefs';
import { SpeakerThumb } from './SpeakerThumb';

const VoicesRail = ({ theme }: { theme: ThemeSummary }) => {
  const refs = useInterviewRefs();

  return (
  <Box sx={{ borderLeft: `2px solid ${t.rail}`, pl: '18px' }}>
    <Eyebrow tracking={0.12} sx={{ mb: '10px' }}>
      Voices in this theme
    </Eyebrow>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: '7px 18px' }}>
      {voicesFor(theme).map((voice) => {
        const present = voice.clipCount > 0;
        const frame = collectionVoices.find((v) => v.interview_title === voice.interview_title)?.frameTime ?? 60;
        const uuid = refs[voice.interview_title]?.storyUuid;
        const body = (
          <>
            <SpeakerThumb
              interviewTitle={voice.interview_title}
              initials={voice.name.slice(0, 1)}
              time={frame}
              size={28}
              radius="50%"
              muted={!present}
            />
            <Box sx={{ minWidth: 0 }}>
              <Box
                className="voice-name"
                sx={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: present ? t.ink : t.muted4,
                  lineHeight: 1.25,
                  transition: 'color 0.12s',
                }}>
                {voice.name}
              </Box>
              <Box sx={{ ...monoPlain(9.5), color: t.muted3 }}>
                {present ? plural(voice.clipCount, 'excerpt') : 'none'}
              </Box>
            </Box>
          </>
        );

        const rowSx = {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: 0,
          opacity: present ? 1 : 0.5,
          textDecoration: 'none',
          color: 'inherit',
        } as const;

        // Each voice opens that person's full interview, once its uuid resolves.
        return uuid ? (
          <Box
            key={voice.interview_title}
            component={Link}
            href={`/story/${uuid}`}
            title={`Open ${voice.name}'s interview`}
            sx={{ ...rowSx, '&:hover .voice-name': { color: t.accent } }}>
            {body}
          </Box>
        ) : (
          <Box key={voice.interview_title} sx={rowSx}>
            {body}
          </Box>
        );
      })}
    </Box>
  </Box>
  );
};

/** One excerpt card in All-excerpts mode; the whole card opens the drawer. */
const ExcerptCard = ({ clip }: { clip: EvidenceClip }) => {
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
        background: t.surface,
        border: `1px solid ${t.rule}`,
        padding: '18px 20px',
        cursor: 'pointer',
        '&:hover': { borderColor: t.accent },
      }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', mb: '12px', flexWrap: 'wrap' }}>
        <SpeakerThumb
          interviewTitle={clip.interview_title}
          initials={clip.name.slice(0, 1)}
          time={clip.start}
          size={30}
          radius="50%"
        />
        <Box component="span" sx={{ fontSize: '13px', fontWeight: 600 }}>
          {clip.name}
        </Box>
        <ConfidenceChip confidence={clip.confidence} size={9.5} />
        <Box sx={{ flex: 1 }} />
        <TimestampPill seconds={clip.start} variant="static" />
      </Box>
      <Box sx={{ ...serif(15.5, 1.55), color: t.ink, textWrap: 'pretty' }}>“{clip.quote}”</Box>
    </Box>
  );
};

/** All-excerpts mode: one collapsible group per question. */
const ExcerptGroups = ({ theme }: { theme: ThemeSummary }) => {
  const collapsed = useExploreStore((s) => s.collapsedQuestions);
  const toggle = useExploreStore((s) => s.toggleQuestionCollapsed);
  const collapseQuestions = useExploreStore((s) => s.collapseQuestions);
  const expandAll = useExploreStore((s) => s.expandAllQuestions);

  const questionIds = useMemo(() => theme.questions.map((q) => q.question_id), [theme]);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '7px', mt: '26px' }}>
        <MonoButton onClick={expandAll}>expand all</MonoButton>
        <MonoButton onClick={() => collapseQuestions(questionIds)}>collapse all</MonoButton>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '40px', mt: '18px' }}>
        {theme.questions.map((question) => {
          const isCollapsed = collapsed.includes(question.question_id);
          const clips = allClipsFor(question);

          return (
            <Box key={question.question_id}>
              <Box
                component="button"
                type="button"
                onClick={() => toggle(question.question_id)}
                aria-expanded={!isCollapsed}
                sx={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'baseline',
                  gap: '14px',
                  padding: '0 0 14px',
                  border: 'none',
                  borderBottom: `1px solid ${t.rule}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}>
                <Box component="span" sx={{ ...monoPlain(12), color: t.accent }}>
                  {isCollapsed ? '▸' : '▾'}
                </Box>
                <Box component="span" sx={{ ...monoPlain(12), color: t.muted4 }}>
                  Q{question.question_id}
                </Box>
                <Box component="span" sx={{ ...serif(20, 1.35), color: t.ink, flex: 1, maxWidth: '52ch', textWrap: 'pretty' }}>
                  {question.question}
                </Box>
                <Box component="span" sx={{ ...monoPlain(10.5), color: t.muted3, whiteSpace: 'nowrap' }}>
                  {plural(clips.length, 'excerpt')}
                </Box>
              </Box>

              {!isCollapsed && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: '12px',
                    alignItems: 'start',
                    mt: '12px',
                  }}>
                  {clips.map((clip, index) => (
                    <ExcerptCard key={`${clip.interview_title}-${clip.start}-${index}`} clip={clip} />
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </>
  );
};

/** Questions mode: the theme's questions as a hairline list with coverage. */
const QuestionRows = ({ questions }: { questions: EvidenceQuestion[] }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1px',
      background: t.rule,
      border: `1px solid ${t.rule}`,
      borderTop: 'none',
      mt: '26px',
    }}>
    {questions.map((question) => {
      const answeredIn = (title: string) => (question.by_interview[title] ?? []).length > 0;
      return (
        <Box
          key={question.question_id}
          component={Link}
          href={`/explore/q/${question.question_id}`}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '40px 1fr', md: '54px 1fr 220px 90px' },
            gap: { xs: '12px', md: '24px' },
            alignItems: 'start',
            background: t.surface,
            padding: '22px 24px',
            color: t.ink,
            textDecoration: 'none',
            '&:hover': { background: t.surfaceHover },
          }}>
          <Box component="span" sx={{ ...monoPlain(12), color: t.muted4, pt: '5px' }}>
            Q{question.question_id}
          </Box>
          <Box component="span" sx={{ ...serif(19, 1.4), textWrap: 'pretty' }}>
            {question.question}
          </Box>
          <Box
            component="span"
            sx={{
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              gap: '5px',
              pt: '4px',
            }}>
            <FaceRow titles={roster.map((interview) => interview.interview_title)} present={answeredIn} />
            <Box component="span" sx={{ ...monoPlain(10.5), color: t.muted3 }}>
              {respondentCount(question)} of {rosterSize} leaders
            </Box>
          </Box>
          <Box
            component="span"
            sx={{
              ...monoPlain(10.5),
              color: t.muted3,
              textAlign: { md: 'right' },
              pt: '4px',
              display: { xs: 'none', md: 'block' },
            }}>
            {plural(questionClipCount(question), 'excerpt')}
          </Box>
        </Box>
      );
    })}
  </Box>
);

/** A single theme: scan its questions, or read every excerpt in it. */
export const ThemeView = ({ theme }: { theme: ThemeSummary }) => {
  const mode = useExploreStore((s) => s.themeMode);
  const setMode = useExploreStore((s) => s.setThemeMode);

  return (
    <Shell sx={{ pt: '26px', pb: '100px' }}>
      <BackLink href="/explore">← All themes</BackLink>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 400px' },
          gap: { xs: '28px', md: '48px' },
          alignItems: 'start',
          mt: '22px',
          pb: '26px',
          borderBottom: `1px solid ${t.rule}`,
        }}>
        <Box>
          <Box sx={{ ...mono(11, 0.14), color: t.accent }}>Theme {theme.index}</Box>
          <Box
            component="h2"
            sx={{ ...serif(34, 1.2), m: '12px 0 0', maxWidth: '26ch', letterSpacing: '-0.015em', textWrap: 'pretty' }}>
            {theme.category}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '18px', mt: '16px', flexWrap: 'wrap' }}>
            <Box component="span" sx={{ fontSize: '13px', color: t.muted }}>
              {plural(theme.questionCount, 'question')} · {plural(theme.clipCount, 'excerpt')}
            </Box>
            <SegmentedToggle
              value={mode}
              onChange={setMode}
              options={[
                { value: 'questions' as const, label: 'Questions' },
                { value: 'excerpts' as const, label: 'All excerpts' },
              ]}
            />
          </Box>
        </Box>
        <VoicesRail theme={theme} />
      </Box>

      {mode === 'excerpts' ? <ExcerptGroups theme={theme} /> : <QuestionRows questions={theme.questions} />}
    </Shell>
  );
};
