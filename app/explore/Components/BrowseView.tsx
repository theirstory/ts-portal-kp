'use client';

import React from 'react';
import Link from 'next/link';
import { Box } from '@mui/material';
import {
  FEATURED_QUESTION_IDS,
  getQuestion,
  respondentCount,
  rosterSize,
  themeVoiceTitles,
  themes,
} from '@/lib/insights/evidenceBank';
import { plural, shorten } from '@/lib/insights/format';
import { mono, monoPlain, serif, t } from '../tokens';
import { Eyebrow, Shell } from './primitives';
import { FaceStack, PeopleStrip } from './PeopleBand';

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
  <Shell sx={{ pt: '24px', pb: '32px' }}>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
        gap: { xs: '24px', md: '48px' },
        alignItems: 'start',
        pb: '22px',
        mb: '22px',
        borderBottom: `1px solid ${t.rule}`,
      }}>
      <FeaturedRail />
      <PeopleStrip />
    </Box>

    {/* Compact tiles: the whole set is meant to be scannable without scrolling,
        so each theme shows only its name and counts — questions live one click
        in, on the theme page. */}
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        gap: '1px',
        background: t.rule,
        border: `1px solid ${t.rule}`,
      }}>
      {themes.map((theme) => (
        <Box
          key={theme.slug}
          component={Link}
          href={`/explore/${theme.slug}`}
          sx={{
            background: t.surface,
            padding: '16px 18px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minHeight: 116,
            textDecoration: 'none',
            color: 'inherit',
            transition: 'background-color 0.12s',
            '&:hover': { background: t.surfaceHover },
            '&:hover .theme-name': { color: t.accent },
            '&:hover .theme-open': { color: t.accentHover },
          }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
            <Box className="theme-name" sx={{ ...serif(18, 1.25, 600), color: t.ink, textWrap: 'pretty' }}>
              {theme.category}
            </Box>
            <Box sx={{ ...monoPlain(11), color: t.muted4, flex: 'none' }}>{theme.index}</Box>
          </Box>

          <Box sx={{ ...monoPlain(11, 0.03), color: t.muted3 }}>
            {plural(theme.questionCount, 'question')} · {plural(theme.clipCount, 'excerpt')}
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              mt: 'auto',
            }}>
            <Box className="theme-open" sx={{ ...mono(10.5, 0.08), color: t.accent }}>
              Open theme →
            </Box>
            <FaceStack titles={themeVoiceTitles(theme)} />
          </Box>
        </Box>
      ))}
    </Box>
  </Shell>
);
