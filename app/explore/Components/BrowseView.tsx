'use client';

import React from 'react';
import Link from 'next/link';
import { Box } from '@mui/material';
import {
  FEATURED_QUESTION_IDS,
  getQuestion,
  respondentCount,
  rosterSize,
  themes,
} from '@/lib/insights/evidenceBank';
import { plural, shorten } from '@/lib/insights/format';
import { mono, monoPlain, serif, t } from '../tokens';
import { Eyebrow, Shell } from './primitives';

const STANDFIRST =
  'Eight leaders sat for the same interview guide. This view turns that guide inside out: pick a question and read every answer to it side by side, or search across the whole collection for a phrase you already have in mind.';

const questionHref = (questionId: number) => `/explore/q/${questionId}`;

const FeaturedRail = () => {
  const featured = FEATURED_QUESTION_IDS.map((id) => getQuestion(id)).filter(
    (question): question is NonNullable<typeof question> => Boolean(question),
  );

  if (featured.length === 0) return null;

  return (
    <Box sx={{ borderLeft: `2px solid ${t.rail}`, pl: '18px' }}>
      <Eyebrow sx={{ mb: '10px' }}>Start somewhere</Eyebrow>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {featured.map((question) => (
          <Box
            key={question.question_id}
            component={Link}
            href={questionHref(question.question_id)}
            sx={{
              ...serif(16, 1.4),
              color: t.ink,
              textDecoration: 'none',
              textWrap: 'pretty',
              '&:hover': { color: t.accent },
            }}>
            {shorten(question.question, 86)}{' '}
            <Box component="span" sx={{ ...monoPlain(11), color: t.muted3, whiteSpace: 'nowrap' }}>
              {respondentCount(question)} of {rosterSize}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/** Landing view: the whole guide at a glance, eight themes as a hairline grid. */
export const BrowseView = () => (
  <Shell sx={{ pt: '36px', pb: '80px' }}>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.35fr 1fr' },
        gap: { xs: '28px', md: '44px' },
        alignItems: 'start',
        pb: '34px',
        mb: '34px',
        borderBottom: `1px solid ${t.rule}`,
      }}>
      <Box component="p" sx={{ ...serif(19, 1.55), color: t.ink2, m: 0, maxWidth: '56ch', textWrap: 'pretty' }}>
        {STANDFIRST}
      </Box>
      <FeaturedRail />
    </Box>

    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1px',
        background: t.rule,
        border: `1px solid ${t.rule}`,
      }}>
      {themes.map((theme) => (
        <Box
          key={theme.slug}
          sx={{
            background: t.surface,
            padding: '22px 22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            '&:hover': { background: t.surfaceHover },
          }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
              <Box
                component={Link}
                href={`/explore/${theme.slug}`}
                sx={{
                  ...serif(18, 1.25, 600),
                  color: t.ink,
                  textDecoration: 'none',
                  textWrap: 'pretty',
                  '&:hover': { color: t.accent },
                }}>
                {theme.category}
              </Box>
              <Box sx={{ ...monoPlain(11), color: t.muted4 }}>{theme.index}</Box>
            </Box>
            <Box sx={{ ...monoPlain(11, 0.03), color: t.muted3, mt: '8px' }}>
              {plural(theme.questionCount, 'question')} · {plural(theme.clipCount, 'excerpt')}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {theme.questions.map((question) => (
              <Box
                key={question.question_id}
                component={Link}
                href={questionHref(question.question_id)}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '30px 1fr',
                  gap: '8px',
                  alignItems: 'start',
                  lineHeight: 1.4,
                  textDecoration: 'none',
                  color: 'inherit',
                  '&:hover span': { color: t.accent },
                }}>
                <Box component="span" sx={{ ...monoPlain(11), color: t.muted4, pt: '2px' }}>
                  Q{question.question_id}
                </Box>
                <Box component="span" sx={{ fontSize: '13.5px', color: t.ink2, textWrap: 'pretty' }}>
                  {shorten(question.question, 92)}
                  <Box component="span" sx={{ ...monoPlain(11), color: t.muted4 }}>
                    {' '}
                    · {respondentCount(question)}/{rosterSize}
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>

          <Box
            component={Link}
            href={`/explore/${theme.slug}`}
            sx={{
              ...mono(11, 0.08),
              color: t.accent,
              textDecoration: 'none',
              mt: 'auto',
              '&:hover': { color: t.accentHover },
            }}>
            Open theme →
          </Box>
        </Box>
      ))}
    </Box>
  </Shell>
);
