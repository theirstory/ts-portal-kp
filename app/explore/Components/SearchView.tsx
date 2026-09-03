'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Box } from '@mui/material';
import { categoriesInResults, search } from '@/lib/insights/evidenceBank';
import { plural, shorten, stamp } from '@/lib/insights/format';
import type { EvidenceClip } from '@/types/insights';
import { mono, monoPlain, serif, t } from '../tokens';
import { Shell } from './primitives';
import { SpeakerThumb } from './SpeakerThumb';
import { useOpenExcerpt } from './useOpenExcerpt';

const ALL_THEMES = 'All themes';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The searched term, marked inside a snippet. */
const Highlight = ({ text, query }: { text: string; query: string }) => {
  const term = query.trim();
  if (!term) return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegExp(term)})`, 'gi'));
  const lowered = term.toLowerCase();

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === lowered ? (
          <Box key={index} component="mark" sx={{ background: t.wash, color: 'inherit', px: '1px' }}>
            {part}
          </Box>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        ),
      )}
    </>
  );
};

/** A matching excerpt: who said it, when, and the passage. Opens the side panel. */
const Hit = ({ clip, query }: { clip: EvidenceClip; query: string }) => {
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
        background: t.surface,
        border: `1px solid ${t.rule}`,
        borderRadius: '8px',
        padding: '14px 16px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': { borderColor: t.fieldBorder, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' },
        '&:hover .hit-stamp': { color: t.accentHover },
      }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '9px', mb: '10px' }}>
        <SpeakerThumb
          interviewTitle={clip.interview_title}
          initials={clip.name.slice(0, 1)}
          time={clip.start}
          size={32}
          radius="50%"
        />
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: '12.5px', fontWeight: 600, lineHeight: 1.25 }}>{clip.name}</Box>
          <Box component="span" className="hit-stamp" sx={{ ...monoPlain(10), color: t.accent }}>
            ▶ {stamp(clip.start)}
          </Box>
        </Box>
      </Box>
      <Box sx={{ ...serif(14.5, 1.55), color: t.ink2, textWrap: 'pretty' }}>
        “<Highlight text={shorten(clip.quote, 260)} query={query} />”
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
                  gridTemplateColumns: { xs: '1fr', md: '340px 1fr' },
                  gap: { xs: '20px', md: '40px' },
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
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                    gap: '12px',
                    alignItems: 'start',
                  }}>
                  {result.hits.map((clip, index) => (
                    <Hit key={`${clip.interview_title}-${clip.start}-${index}`} clip={clip} query={query} />
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
