'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Box } from '@mui/material';
import { categoriesInResults, search } from '@/lib/insights/evidenceBank';
import { plural, shorten, stamp } from '@/lib/insights/format';
import type { EvidenceClip } from '@/types/insights';
import { mono, monoPlain, serif, t } from '../tokens';
import { Shell } from './primitives';
import { useOpenExcerpt } from './useOpenExcerpt';

const ALL_THEMES = 'All themes';

/** A matching excerpt. The whole block opens the side panel, as elsewhere in Explore. */
const Hit = ({ clip }: { clip: EvidenceClip }) => {
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
        '&:hover .hit-stamp': { textDecoration: 'underline' },
      }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Box component="span" sx={{ fontSize: '12px', fontWeight: 600 }}>
          {clip.name}
        </Box>
        <Box component="span" className="hit-stamp" sx={{ ...monoPlain(10.5), color: t.accent }}>
          ▶ {stamp(clip.start)}
        </Box>
      </Box>
      <Box sx={{ ...serif(14.5, 1.55), color: t.ink2, mt: '5px', textWrap: 'pretty' }}>
        “{shorten(clip.quote, 200)}”
      </Box>
    </Box>
  );
};

/**
 * Search results: one row per matching question, with up to three of its
 * matching excerpts alongside. Matching is case-insensitive substring over
 * question text and quotes.
 */
export const SearchView = ({ query, category }: { query: string; category: string }) => {
  const activeCategory = category || ALL_THEMES;

  const allResults = useMemo(() => search(query), [query]);
  const results = useMemo(
    () => (activeCategory === ALL_THEMES ? allResults : allResults.filter((r) => r.question.category === activeCategory)),
    [allResults, activeCategory],
  );

  const filters = useMemo(() => [ALL_THEMES, ...categoriesInResults(allResults)], [allResults]);

  const shownHits = results.reduce((sum, result) => sum + result.totalHits, 0);
  const trimmed = query.trim();

  const resultLine =
    results.length === 0
      ? `No matches for “${trimmed}”`
      : `${plural(shownHits, 'excerpt')} across ${plural(results.length, 'question')} for “${trimmed}”`;

  return (
    <Shell sx={{ pt: '30px', pb: '100px' }}>
      <Box component="h2" sx={{ ...serif(24, 1.3), m: 0 }}>
        {resultLine}
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: '7px',
          flexWrap: 'wrap',
          m: '20px 0 26px',
          pb: '22px',
          borderBottom: `1px solid ${t.rule}`,
        }}>
        {filters.map((filter) => {
          const on = filter === activeCategory;
          const href =
            filter === ALL_THEMES
              ? `/explore?q=${encodeURIComponent(query)}`
              : `/explore?q=${encodeURIComponent(query)}&theme=${encodeURIComponent(filter)}`;
          return (
            <Box
              key={filter}
              component={Link}
              href={href}
              scroll={false}
              sx={{
                border: `1px solid ${on ? t.ink : t.fieldBorder}`,
                background: on ? t.ink : 'transparent',
                color: on ? t.paper : t.muted,
                fontSize: '12px',
                padding: '6px 11px',
                borderRadius: '2px',
                textDecoration: 'none',
                cursor: 'pointer',
              }}>
              {filter === ALL_THEMES ? filter : shorten(filter, 34)}
            </Box>
          );
        })}
      </Box>

      {results.length === 0 ? (
        <Box sx={{ ...serif(18, 1.5), py: '40px', color: t.muted }}>
          Nothing in the collection matches that yet. Try a broader word — <em>culture</em>, <em>hospital</em>,{' '}
          <em>prevention</em>.
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
            background: t.rule,
            border: `1px solid ${t.rule}`,
          }}>
          {results.map((result) => (
            <Box key={result.question.question_id} sx={{ background: t.surface, padding: '22px 24px 24px' }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 300px' },
                  gap: { xs: '20px', md: '32px' },
                  alignItems: 'start',
                }}>
                <Box>
                  <Box sx={{ ...mono(10.5, 0.12), color: t.accent }}>{result.question.category}</Box>
                  <Box
                    component={Link}
                    href={`/explore/q/${result.question.question_id}`}
                    sx={{
                      ...serif(20, 1.35),
                      display: 'block',
                      color: t.ink,
                      textDecoration: 'none',
                      mt: '8px',
                      maxWidth: '34ch',
                      textWrap: 'pretty',
                      '&:hover': { color: t.accent },
                    }}>
                    {result.question.question}
                  </Box>
                  <Box sx={{ fontSize: '12.5px', color: t.muted2, mt: '10px' }}>
                    {result.questionMatchedOnly
                      ? `the question itself matches “${trimmed}”`
                      : `${result.totalHits} ${result.totalHits === 1 ? 'excerpt matches' : 'excerpts match'} “${trimmed}”`}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {result.hits.map((clip, index) => (
                    <Hit key={`${clip.interview_title}-${clip.start}-${index}`} clip={clip} />
                  ))}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Shell>
  );
};
