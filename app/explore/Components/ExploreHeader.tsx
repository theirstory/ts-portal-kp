'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Box } from '@mui/material';
import { evidenceQuestions, roster, totalClipCount } from '@/lib/insights/evidenceBank';
import { plural } from '@/lib/insights/format';
import { monoPlain, serif, t } from '../tokens';
import { Shell } from './primitives';

const SEARCH_DEBOUNCE_MS = 180;

/**
 * Persistent header. Typing switches the body to search results by pushing ?q=
 * onto /explore; clearing returns to browse. The field is kept in local state so
 * typing stays responsive and only the committed value hits the router.
 */
export const ExploreHeader = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';

  const [value, setValue] = useState(urlQuery);
  const lastPushed = useRef(urlQuery);

  // Adopt the URL's query when it changes from outside this field (back button,
  // a link, landing on /explore?q=…).
  useEffect(() => {
    if (urlQuery !== lastPushed.current) {
      lastPushed.current = urlQuery;
      setValue(urlQuery);
    }
  }, [urlQuery]);

  useEffect(() => {
    if (value === lastPushed.current) return;

    const timer = setTimeout(() => {
      lastPushed.current = value;
      router.push(value.trim() ? `/explore?q=${encodeURIComponent(value)}` : '/explore', { scroll: false });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, router]);

  const clear = () => {
    setValue('');
    lastPushed.current = '';
    if (pathname !== '/explore' || urlQuery) router.push('/explore', { scroll: false });
  };

  const collectionLine = `${plural(roster.length, 'interview')} · ${plural(
    evidenceQuestions.length,
    'question',
  )} · ${plural(totalClipCount, 'excerpt')}`;

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: t.surface,
        borderBottom: `1px solid ${t.rule}`,
      }}>
      <Shell
        sx={{
          py: '20px',
          display: 'flex',
          alignItems: { xs: 'stretch', md: 'flex-end' },
          flexDirection: { xs: 'column', md: 'row' },
          gap: { xs: '16px', md: '40px' },
        }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
            <Box
              component={Link}
              href="/explore"
              sx={{
                ...serif(30, 1.2, 600),
                letterSpacing: '-0.01em',
                color: t.ink,
                textDecoration: 'none',
                '&:hover': { color: t.accent },
              }}>
              Explore by theme &amp; question
            </Box>
            <Box component="span" sx={{ fontSize: '13px', color: t.muted, whiteSpace: 'nowrap' }}>
              {collectionLine}
            </Box>
          </Box>
        </Box>

        <Box sx={{ width: { xs: '100%', md: 400 }, flex: 'none' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#fff',
              border: `1px solid ${t.fieldBorder}`,
              borderRadius: '3px',
              padding: '9px 12px',
              '&:focus-within': { borderColor: t.accent },
            }}>
            <Box component="span" sx={{ ...monoPlain(12), color: t.muted4 }} aria-hidden>
              ⌕
            </Box>
            <Box
              component="input"
              type="search"
              value={value}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
              placeholder={`Search ${totalClipCount} excerpts — e.g. prevention, burnout, culture`}
              aria-label="Search questions and excerpts"
              sx={{
                border: 'none',
                outline: 'none',
                flex: 1,
                minWidth: 0,
                fontSize: '14px',
                color: t.ink,
                background: 'transparent',
                fontFamily: 'inherit',
                '&::-webkit-search-cancel-button': { display: 'none' },
              }}
            />
            {value.length > 0 && (
              <Box
                component="button"
                type="button"
                onClick={clear}
                sx={{
                  ...monoPlain(11),
                  border: 'none',
                  background: '#efe9dc',
                  color: t.muted,
                  padding: '3px 7px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}>
                clear
              </Box>
            )}
          </Box>
        </Box>
      </Shell>
    </Box>
  );
};
