'use client';

/**
 * "Ask the collection" on the home page: a visitor asks a question in their own words and gets back
 * the Permanente-curated interview questions (the ones Explore is built on) whose answers speak to
 * it, each with its closest excerpts. Unlike Discover, nothing generated is shown: every result is a
 * curated question and every excerpt is a verbatim passage from the evidence bank.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Box,
  ButtonBase,
  CircularProgress,
  Drawer,
  IconButton,
  InputBase,
  Typography,
  useMediaQuery,
} from '@mui/material';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { ChatInteractionProvider } from '@/app/discover/ChatInteractionContext';
import { SidePanel } from '@/app/discover/Components/SidePanel';
import { SpeakerThumb } from '@/app/explore/Components/SpeakerThumb';
import { useOpenExcerpt } from '@/app/explore/Components/useOpenExcerpt';
import { useChatStore } from '@/app/stores/useChatStore';
import { loadInterviewRefs } from '@/lib/insights/interviewRefs';
import { colors, theme } from '@/lib/theme';
import { initials } from '@/lib/insights/format';
import { KEYWORD_GROUPS, keywordColor, keywordGroup } from '@/lib/insights/keywordColors';
import type { AskMatch, AskResponse } from '@/lib/insights/ask';
import type { EvidenceClip } from '@/types/insights';

/** The interview guide's themes, each with a question a visitor might ask about it. */
const TOPICS: { label: string; example: string }[] = [
  { label: 'Paths into medicine', example: 'What drew these physicians to medicine and to Kaiser Permanente?' },
  { label: 'Values & culture', example: 'What makes the Permanente culture distinctive?' },
  { label: 'Leading change', example: 'How do physician leaders bring colleagues along through a major change?' },
  { label: 'Patient care', example: 'How did they improve the quality of care for members?' },
  { label: 'Public health', example: 'How did Permanente respond to public health crises?' },
  { label: 'Technology', example: 'How did the electronic health record change the way physicians practice?' },
  { label: 'Mentorship', example: 'Who mentored them, and how do they develop new leaders?' },
  { label: 'Advice & the future', example: 'What advice do they have for physicians stepping into leadership?' },
];

const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
};

type AskState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'done'; response: AskResponse }
  | { status: 'error'; query: string; message: string };

export const useAskCollection = () => {
  const [state, setState] = useState<AskState>({ status: 'idle' });
  const latest = useRef(0);

  const ask = useCallback(async (query: string) => {
    const q = query.trim();
    if (q.length < 3) return;
    const id = ++latest.current;
    setState({ status: 'loading', query: q });
    try {
      const res = await fetch('/api/insights/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (id !== latest.current) return;
      if (!res.ok) throw new Error(data?.error || 'Something went wrong finding answers.');
      setState({ status: 'done', response: data as AskResponse });
    } catch (err) {
      if (id !== latest.current) return;
      setState({
        status: 'error',
        query: q,
        message: err instanceof Error ? err.message : 'Something went wrong finding answers.',
      });
    }
  }, []);

  const clear = useCallback(() => {
    latest.current++;
    setState({ status: 'idle' });
  }, []);

  return { state, ask, clear };
};

export const AskCollectionCard = ({ onAsk, loading }: { onAsk: (query: string) => void; loading: boolean }) => {
  const [value, setValue] = useState('');

  const submit = (query = value) => {
    if (query.trim().length < 3 || loading) return;
    onAsk(query);
  };

  return (
    <Box
      component="section"
      aria-labelledby="ask-collection-heading"
      sx={{
        bgcolor: colors.background.paper,
        borderRadius: 2,
        boxShadow: `0 1px 3px ${colors.common.shadow}`,
        p: { xs: 2.5, md: 3.5 },
        display: 'flex',
        flexDirection: 'column',
        // The card stretches to the carousel's height; keep its content centred in it.
        justifyContent: 'center',
        minWidth: 0,
      }}>
      <Typography
        component="span"
        sx={{
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          fontWeight: 700,
          fontSize: 12,
          color: colors.primary.main,
          mb: 1,
        }}>
        Ask the archive
      </Typography>
      <Typography
        id="ask-collection-heading"
        component="h2"
        sx={{ m: 0, fontWeight: 700, fontSize: { xs: 22, md: 'clamp(22px, 1.7vw, 27px)' }, lineHeight: 1.2, mb: 2.5 }}>
        What would you like to learn from Permanente physician leaders?
      </Typography>

      <Box
        component="form"
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          submit();
        }}
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          border: `1.5px solid ${colors.grey[300]}`,
          borderRadius: 2,
          pl: 2.25,
          pr: 1.25,
          py: 1.5,
          transition: 'border-color .15s ease',
          '&:focus-within': { borderColor: colors.primary.main },
        }}>
        <InputBase
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          multiline
          minRows={4}
          maxRows={8}
          placeholder="What makes the Permanente culture distinctive?"
          inputProps={{ 'aria-label': 'Ask a question about the collection', maxLength: 500 }}
          sx={{ flex: 1, fontSize: 16, lineHeight: 1.55, py: 0.25 }}
        />
        <IconButton
          type="submit"
          aria-label="Find answers"
          disabled={value.trim().length < 3 || loading}
          sx={{
            bgcolor: colors.primary.main,
            color: colors.primary.contrastText,
            width: 44,
            height: 44,
            '&:hover': { bgcolor: colors.primary.dark },
            '&.Mui-disabled': { bgcolor: colors.grey[300], color: colors.common.white },
          }}>
          {loading ? <CircularProgress size={18} color="inherit" /> : <ArrowUpwardRoundedIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Typography
        component="span"
        sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mt: 2.5, mb: 1 }}
        color="text.secondary">
        Topics you can ask about
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {TOPICS.map((topic) => (
          <ButtonBase
            key={topic.label}
            title={topic.example}
            onClick={() => {
              setValue(topic.example);
              submit(topic.example);
            }}
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 999,
              border: `1px solid ${colors.grey[300]}`,
              fontSize: 13,
              color: colors.text.primary,
              // globals.css gives every button a 32px minimum on small screens.
              minHeight: 0,
              transition: 'border-color .15s ease, background-color .15s ease',
              '&:hover': { borderColor: colors.primary.main, bgcolor: `${colors.primary.main}0f` },
            }}>
            {topic.label}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
};

/** A keyword as a small toggle: filters the results to excerpts about it. */
const KeywordChip = ({
  keyword,
  selected,
  onToggle,
  count,
}: {
  keyword: string;
  selected: boolean;
  onToggle: (keyword: string) => void;
  count?: number;
}) => {
  const color = keywordColor(keyword);
  const group = keywordGroup(keyword);
  return (
    <ButtonBase
      onClick={() => onToggle(keyword)}
      aria-pressed={selected}
      title={group ? `${group}: ${selected ? 'remove filter' : 'filter by this keyword'}` : undefined}
      sx={{
        px: 1,
        py: 0.25,
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 600,
        lineHeight: 1.6,
        minHeight: 0,
        border: `1px solid ${selected ? color.solid : color.border}`,
        bgcolor: selected ? color.solid : color.bg,
        color: selected ? colors.common.white : color.fg,
        transition: 'background-color .15s ease, border-color .15s ease, color .15s ease',
        '&:hover': selected ? { filter: 'brightness(0.92)' } : { borderColor: color.solid },
      }}>
      {keyword}
      {count !== undefined && (
        <Box component="span" sx={{ ml: 0.5, fontWeight: 400, opacity: 0.8 }}>
          {count}
        </Box>
      )}
    </ButtonBase>
  );
};

/** Keywords on an excerpt: colored pills, each a filter toggle. */
const KeywordDots = ({
  keywords,
  selected,
  onToggle,
}: {
  keywords: string[];
  selected: string[];
  onToggle: (keyword: string) => void;
}) => (
  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
    {keywords.map((keyword) => (
      <KeywordChip key={keyword} keyword={keyword} selected={selected.includes(keyword)} onToggle={onToggle} />
    ))}
  </Box>
);

const THUMB = 52;

/** One excerpt as a compact card: who and what at the top, the quote, then its keywords. */
const Excerpt = ({
  clip,
  onOpen,
  selectedKeywords,
  onToggleKeyword,
}: {
  clip: EvidenceClip;
  onOpen: (clip: EvidenceClip) => void;
  selectedKeywords: string[];
  onToggleKeyword: (keyword: string) => void;
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      border: `1px solid ${colors.grey[200]}`,
      borderRadius: 2,
      bgcolor: colors.background.paper,
      transition: 'border-color .15s ease, box-shadow .15s ease',
      '&:hover': { borderColor: colors.grey[300], boxShadow: `0 2px 8px ${colors.common.shadow}` },
    }}>
    <ButtonBase
      onClick={() => onOpen(clip)}
      aria-label={`Play excerpt from ${clip.name} at ${formatTime(clip.start)}${clip.tag ? `: ${clip.tag}` : ''}`}
      sx={{
        // Content from the top, even when the row stretches this card to a taller neighbour's height.
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        width: '100%',
        textAlign: 'left',
        p: 1.5,
        pb: 1,
        borderRadius: 2,
        minHeight: 0,
        flex: 1,
        '&:hover .play': { bgcolor: colors.primary.main, transform: 'scale(1.08)' },
      }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
        {/* Their face at the moment they say it, with a play badge. */}
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <SpeakerThumb
            interviewTitle={clip.interview_title}
            initials={initials(clip.name)}
            time={clip.start + 2}
            size={THUMB}
            radius="10px"
          />
          <Box
            className="play"
            sx={{
              position: 'absolute',
              right: -5,
              bottom: -5,
              width: 22,
              height: 22,
              borderRadius: '50%',
              bgcolor: colors.primary.dark,
              color: colors.common.white,
              border: `2px solid ${colors.background.paper}`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color .15s ease, transform .15s ease',
            }}>
            <PlayArrowRoundedIcon sx={{ fontSize: 15 }} />
          </Box>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {clip.tag && (
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: colors.text.primary, lineHeight: 1.25 }}>
              {clip.tag}
            </Typography>
          )}
          <Typography sx={{ fontSize: 12.5, color: colors.text.secondary, lineHeight: 1.4, mt: 0.25 }}>
            {clip.name} · {formatTime(clip.start)}
          </Typography>
        </Box>
      </Box>
      {/* The excerpt exactly as transcribed, from its first word. */}
      <Typography
        sx={{
          fontSize: 13.5,
          lineHeight: 1.55,
          fontStyle: 'italic',
          color: colors.text.secondary,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
        &ldquo;{clip.quote}&rdquo;
      </Typography>
    </ButtonBase>
    {!!clip.keywords?.length && (
      // Outside the play button: buttons can't nest.
      <Box sx={{ px: 1.5, pb: 1.25 }}>
        <KeywordDots keywords={clip.keywords} selected={selectedKeywords} onToggle={onToggleKeyword} />
      </Box>
    )}
  </Box>
);

const SHOWN = 3;

/** Up to `n` excerpts, best first but one per narrator where possible, so a question shows a range of voices. */
const pickExcerpts = (clips: EvidenceClip[], n: number): EvidenceClip[] => {
  const picked: EvidenceClip[] = [];
  const seen = new Set<string>();
  for (const clip of clips) {
    if (picked.length >= n) break;
    if (seen.has(clip.interview_title)) continue;
    seen.add(clip.interview_title);
    picked.push(clip);
  }
  for (const clip of clips) {
    if (picked.length >= n) break;
    if (!picked.includes(clip)) picked.push(clip);
  }
  return picked;
};

/** Active filters. Within one kind any selection matches; across kinds an excerpt must match both. */
type Filters = { keywords: string[]; people: string[] };

const NO_FILTERS: Filters = { keywords: [], people: [] };

const toggleIn = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const isFiltering = (filters: Filters) => filters.keywords.length + filters.people.length > 0;

const matchesFilters = (clip: EvidenceClip, filters: Filters) =>
  (filters.keywords.length === 0 || filters.keywords.some((k) => clip.keywords?.includes(k))) &&
  (filters.people.length === 0 || filters.people.includes(clip.interview_title));

/** One returned question: a numbered heading with one quiet line of context, then its best excerpts side by side. */
const QuestionResult = ({
  match,
  number,
  onOpen,
  filters,
  onToggleKeyword,
}: {
  match: AskMatch;
  number: number;
  onOpen: (clip: EvidenceClip) => void;
  filters: Filters;
  onToggleKeyword: (keyword: string) => void;
}) => {
  const matching = match.excerpts.filter((clip) => matchesFilters(clip, filters));
  const filtered = isFiltering(filters);
  return (
    <Box component="article" sx={{ py: { xs: 2.5, md: 3 }, borderTop: `1px solid ${colors.grey[300]}` }}>
      <Box sx={{ display: 'flex', gap: { xs: 1.25, md: 1.75 }, alignItems: 'flex-start', mb: 1.75 }}>
        <Box
          aria-hidden
          sx={{
            flexShrink: 0,
            width: 28,
            height: 28,
            mt: '1px',
            borderRadius: '50%',
            bgcolor: colors.primary.main,
            color: colors.primary.contrastText,
            fontSize: 14,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {number}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h3" sx={{ m: 0, fontSize: { xs: 18, md: 20 }, fontWeight: 700, lineHeight: 1.3 }}>
            <Box
              component={Link}
              href={`/explore/q/${match.question_id}`}
              sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { color: colors.primary.main } }}>
              {match.question}
            </Box>
          </Typography>
          <Typography sx={{ fontSize: 13, mt: 0.5 }} color="text.secondary">
            {match.category} · {match.narratorCount} {match.narratorCount === 1 ? 'leader' : 'leaders'} ·{' '}
            {filtered ? `${matching.length} of ${match.clipCount}` : match.clipCount}{' '}
            {match.clipCount === 1 ? 'excerpt' : 'excerpts'}
            {filtered && ' match your filter'}
          </Typography>
        </Box>
        <Box
          component={Link}
          href={`/explore/q/${match.question_id}`}
          sx={{
            display: { xs: 'none', md: 'inline-flex' },
            flexShrink: 0,
            alignItems: 'center',
            gap: 0.5,
            mt: 0.5,
            fontSize: 14,
            fontWeight: 700,
            color: colors.primary.main,
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}>
          Hear all {match.clipCount}
          <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
        </Box>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.5,
          pl: { xs: 0, md: '44px' },
        }}>
        {pickExcerpts(matching, SHOWN).map((clip) => (
          <Excerpt
            key={`${clip.interview_title}-${clip.start}`}
            clip={clip}
            onOpen={onOpen}
            selectedKeywords={filters.keywords}
            onToggleKeyword={onToggleKeyword}
          />
        ))}
      </Box>
      <Box
        component={Link}
        href={`/explore/q/${match.question_id}`}
        sx={{
          display: { xs: 'inline-flex', md: 'none' },
          alignItems: 'center',
          gap: 0.5,
          mt: 1.5,
          fontSize: 14,
          fontWeight: 700,
          color: colors.primary.main,
          textDecoration: 'none',
        }}>
        Hear all {match.clipCount} excerpts
        <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
      </Box>
    </Box>
  );
};

/** A small uppercase heading for a column of the keyword panel. */
const PanelLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography
    component="h3"
    sx={{ m: 0, mb: 1, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
    color="text.secondary">
    {children}
  </Typography>
);

const DETAIL_PAGE = 6;

/**
 * Desktop results as two columns, like the keyword panel: every returned question on the left
 * (staying in view), the selected one's excerpts on the right.
 */
const QuestionsMasterDetail = ({
  matches,
  rankOf,
  onOpen,
  filters,
  onToggleKeyword,
}: {
  matches: AskMatch[];
  rankOf: (match: AskMatch) => number;
  onOpen: (clip: EvidenceClip) => void;
  filters: Filters;
  onToggleKeyword: (keyword: string) => void;
}) => {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [limit, setLimit] = useState(DETAIL_PAGE);
  // A filter can hide the selected question; fall back to the first one still shown.
  const active = matches.find((m) => m.question_id === activeId) ?? matches[0];
  useEffect(() => setLimit(DETAIL_PAGE), [active?.question_id, filters]);
  if (!active) return null;

  const filtered = isFiltering(filters);
  const matching = active.excerpts.filter((clip) => matchesFilters(clip, filters));
  const ordered = pickExcerpts(matching, matching.length);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)',
        gap: 3,
        alignItems: 'start',
        borderTop: `1px solid ${colors.grey[300]}`,
        pt: 2.5,
      }}>
      <Box sx={{ position: 'sticky', top: 12 }}>
        <PanelLabel>Questions</PanelLabel>
        <Box role="tablist" aria-orientation="vertical" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {matches.map((match) => {
            const on = match.question_id === active.question_id;
            const count = match.excerpts.filter((clip) => matchesFilters(clip, filters)).length;
            return (
              <ButtonBase
                key={match.question_id}
                role="tab"
                aria-selected={on}
                onClick={() => setActiveId(match.question_id)}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.25,
                  textAlign: 'left',
                  p: 1.25,
                  borderRadius: 2,
                  minHeight: 0,
                  bgcolor: on ? colors.background.paper : 'transparent',
                  boxShadow: on ? `0 1px 3px ${colors.common.shadow}` : 'none',
                  borderLeft: `3px solid ${on ? colors.primary.main : 'transparent'}`,
                  transition: 'background-color .15s ease',
                  '&:hover': { bgcolor: on ? colors.background.paper : colors.grey[100] },
                }}>
                <Box
                  aria-hidden
                  sx={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: on ? colors.primary.main : colors.grey[300],
                    color: on ? colors.primary.contrastText : colors.text.primary,
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {rankOf(match)}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: 14.5,
                      lineHeight: 1.35,
                      fontWeight: on ? 700 : 600,
                      color: on ? colors.text.primary : colors.grey[800],
                    }}>
                    {match.question}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, mt: 0.5 }} color="text.secondary">
                    {match.narratorCount} {match.narratorCount === 1 ? 'leader' : 'leaders'} ·{' '}
                    {filtered ? `${count} of ${match.clipCount}` : match.clipCount}{' '}
                    {match.clipCount === 1 ? 'excerpt' : 'excerpts'}
                  </Typography>
                </Box>
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      <Box role="tabpanel" sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1.75 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h3" sx={{ m: 0, fontSize: 21, fontWeight: 700, lineHeight: 1.3 }}>
              {active.question}
            </Typography>
            <Typography sx={{ fontSize: 13, mt: 0.5 }} color="text.secondary">
              {active.category} · {active.narratorCount} {active.narratorCount === 1 ? 'leader' : 'leaders'} ·{' '}
              {filtered ? `${matching.length} of ${active.clipCount}` : active.clipCount}{' '}
              {active.clipCount === 1 ? 'excerpt' : 'excerpts'}
              {filtered && ' match your filter'}
            </Typography>
          </Box>
          <Box
            component={Link}
            href={`/explore/q/${active.question_id}`}
            sx={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              mt: 0.5,
              fontSize: 14,
              fontWeight: 700,
              color: colors.primary.main,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}>
            Open on Explore
            <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { md: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
          {ordered.slice(0, limit).map((clip) => (
            <Excerpt
              key={`${clip.interview_title}-${clip.start}`}
              clip={clip}
              onOpen={onOpen}
              selectedKeywords={filters.keywords}
              onToggleKeyword={onToggleKeyword}
            />
          ))}
        </Box>
        {ordered.length > limit && (
          <ButtonBase
            onClick={() => setLimit((n) => n + DETAIL_PAGE)}
            sx={{
              mt: 2,
              px: 2,
              py: 0.75,
              borderRadius: 999,
              minHeight: 0,
              fontSize: 14,
              fontWeight: 600,
              color: colors.primary.main,
              border: `1px solid ${colors.grey[300]}`,
              bgcolor: colors.background.paper,
              '&:hover': { borderColor: colors.primary.main },
            }}>
            Show {Math.min(DETAIL_PAGE, ordered.length - limit)} more of {ordered.length}
          </ButtonBase>
        )}
      </Box>
    </Box>
  );
};

/** Keywords across every excerpt in the results, by category, as filter toggles. */
const KeywordPanel = ({
  matches,
  selected,
  onToggle,
}: {
  matches: AskMatch[];
  selected: string[];
  onToggle: (keyword: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  // A topic family narrows the keyword list (null: every family).
  const [family, setFamily] = useState<string | null>(null);
  // Phones get fewer before "more", so the filter doesn't push the answers off screen.
  const shown = useMediaQuery(theme.breakpoints.down('sm')) ? 6 : 12;
  const counts = new Map<string, number>();
  for (const match of matches)
    for (const clip of match.excerpts) for (const k of clip.keywords ?? []) counts.set(k, (counts.get(k) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (ranked.length === 0) return null;

  // The chosen family narrows the keywords; typing narrows them further to keywords with a word
  // starting with the text, whole-word matches first ("care" puts "Integrated care delivery" ahead
  // of "Career advice").
  const needle = text.trim().toLowerCase();
  const inFamily = family ? ranked.filter(([k]) => keywordGroup(k) === family) : ranked;
  const wordMatch = (keyword: string): number => {
    const words = keyword.toLowerCase().split(/[\s/-]+/);
    if (words.some((w) => w === needle)) return 2;
    if (words.some((w) => w.startsWith(needle)) || keyword.toLowerCase().startsWith(needle)) return 1;
    return 0;
  };
  const found = !needle
    ? inFamily
    : inFamily
        .map((entry) => ({ entry, score: wordMatch(entry[0]) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.entry);
  // A family or a search shows every match; otherwise the most common, with the rest behind "more".
  const narrowed = !!needle || !!family;
  const visible = narrowed || expanded ? found : ranked.slice(0, shown);
  const families = KEYWORD_GROUPS.map((g) => ({
    ...g,
    count: ranked.filter(([k]) => keywordGroup(k) === g.name).length,
  })).filter((g) => g.count > 0);

  return (
    <Box
      sx={{
        mt: 1.25,
        borderRadius: 2,
        bgcolor: colors.background.paper,
        border: `1px solid ${colors.grey[200]}`,
        display: 'grid',
        // Categories in a column on the left, their keywords to the right; stacked on phones.
        gridTemplateColumns: { xs: '1fr', md: families.length > 1 ? '240px minmax(0, 1fr)' : '1fr' },
      }}>
      {families.length > 1 && (
        <Box
          sx={{
            p: { xs: 1.5, md: 2 },
            pb: { xs: 0.5, md: 2 },
            borderRight: { md: `1px solid ${colors.grey[200]}` },
            minWidth: 0,
          }}>
          <PanelLabel>Categories</PanelLabel>
          <Box
            role="group"
            aria-label="Keyword categories"
            sx={{
              display: 'flex',
              flexDirection: { xs: 'row', md: 'column' },
              // Phones: one row that scrolls sideways, instead of seven stacked lines.
              overflowX: { xs: 'auto', md: 'visible' },
              mx: { xs: -1.5, md: 0 },
              px: { xs: 1.5, md: 0 },
              pb: { xs: 0.5, md: 0 },
              gap: { xs: 0.75, md: 0.25 },
              '& > *': { flexShrink: 0, whiteSpace: 'nowrap' },
            }}>
            {[
              {
                name: null as string | null,
                label: 'All categories',
                count: null as number | null,
                dot: null as string | null,
              },
            ]
              .concat(families.map((f) => ({ name: f.name, label: f.name, count: f.count, dot: f.color.solid })))
              .map((f) => {
                const on = family === f.name;
                return (
                  <ButtonBase
                    key={f.label}
                    onClick={() => setFamily(f.name)}
                    aria-pressed={on}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: 1,
                      px: 1.25,
                      py: 0.75,
                      borderRadius: 1.5,
                      minHeight: 0,
                      fontSize: 13.5,
                      textAlign: 'left',
                      fontWeight: on ? 700 : 500,
                      color: on ? colors.text.primary : colors.text.secondary,
                      bgcolor: on ? colors.grey[100] : 'transparent',
                      '&:hover': { color: colors.text.primary, bgcolor: colors.grey[100] },
                    }}>
                    <Box
                      component="span"
                      sx={{
                        width: 10,
                        height: 10,
                        flexShrink: 0,
                        borderRadius: '50%',
                        bgcolor: f.dot ?? 'transparent',
                        border: f.dot ? 'none' : `1.5px solid ${colors.grey[500]}`,
                      }}
                    />
                    <Box component="span" sx={{ flex: { md: 1 } }}>
                      {f.label}
                    </Box>
                    {f.count !== null && (
                      <Box component="span" sx={{ fontWeight: 400, fontSize: 12.5, opacity: 0.75 }}>
                        {f.count}
                      </Box>
                    )}
                  </ButtonBase>
                );
              })}
          </Box>
        </Box>
      )}
      <Box sx={{ p: { xs: 1.5, md: 2 }, minWidth: 0 }}>
        <PanelLabel>{family ? `${family} keywords` : 'Keywords'}</PanelLabel>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            border: `1px solid ${colors.grey[300]}`,
            borderRadius: 999,
            px: 1.25,
            py: 0.25,
            mb: 1.25,
            width: { xs: '100%', sm: 320 },
            '&:focus-within': { borderColor: colors.primary.main },
          }}>
          <SearchRoundedIcon sx={{ fontSize: 18, color: colors.text.secondary }} />
          <InputBase
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter picks the best match, so a keyword can be found and applied without the mouse.
              if (e.key === 'Enter' && found.length > 0) {
                e.preventDefault();
                onToggle(found[0][0]);
                setText('');
              }
              if (e.key === 'Escape') setText('');
            }}
            placeholder={`Find among ${inFamily.length} keywords`}
            inputProps={{ 'aria-label': 'Find a keyword' }}
            sx={{ flex: 1, fontSize: 14 }}
          />
          {text && (
            <IconButton size="small" aria-label="Clear keyword search" onClick={() => setText('')} sx={{ p: 0.25 }}>
              <CloseRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
          {visible.map(([keyword, count]) => (
            <KeywordChip
              key={keyword}
              keyword={keyword}
              count={count}
              selected={selected.includes(keyword)}
              onToggle={onToggle}
            />
          ))}
          {needle && found.length === 0 && (
            <Typography sx={{ fontSize: 13 }} color="text.secondary">
              No keywords match &ldquo;{text.trim()}&rdquo;
            </Typography>
          )}
          {!narrowed && ranked.length > shown && (
            <ButtonBase
              onClick={() => setExpanded((v) => !v)}
              sx={{ fontSize: 13, fontWeight: 600, color: colors.primary.main, minHeight: 0, px: 0.5 }}>
              {expanded ? 'Fewer' : `${ranked.length - shown} more`}
            </ButtonBase>
          )}
        </Box>
      </Box>
    </Box>
  );
};

type Person = { interview_title: string; name: string; count: number; time: number };

/** The interviewees with excerpts in the results, most excerpts first. */
const peopleIn = (matches: AskMatch[]): Person[] => {
  const byTitle = new Map<string, Person>();
  for (const match of matches)
    for (const clip of match.excerpts) {
      const person = byTitle.get(clip.interview_title);
      if (person) person.count++;
      else
        byTitle.set(clip.interview_title, {
          interview_title: clip.interview_title,
          name: clip.name,
          count: 1,
          time: clip.start + 2,
        });
    }
  return [...byTitle.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

/** Everyone in the results, most excerpts first, as filter toggles with their faces. */
const PeoplePanel = ({
  matches,
  selected,
  onToggle,
}: {
  matches: AskMatch[];
  selected: string[];
  onToggle: (interviewTitle: string) => void;
}) => (
  <Box
    role="group"
    aria-label="Interviewees"
    sx={{
      mt: 1.25,
      p: { xs: 1.5, md: 2 },
      borderRadius: 2,
      bgcolor: colors.background.paper,
      border: `1px solid ${colors.grey[200]}`,
      display: 'grid',
      gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, minmax(0, 1fr))',
        md: 'repeat(3, minmax(0, 1fr))',
        lg: 'repeat(4, minmax(0, 1fr))',
      },
      gap: 0.5,
    }}>
    {peopleIn(matches).map((person) => {
      const on = selected.includes(person.interview_title);
      return (
        <ButtonBase
          key={person.interview_title}
          onClick={() => onToggle(person.interview_title)}
          aria-pressed={on}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 1.25,
            p: 0.75,
            pr: 1.25,
            borderRadius: 1.5,
            minHeight: 0,
            textAlign: 'left',
            border: `1px solid ${on ? colors.primary.main : 'transparent'}`,
            bgcolor: on ? `${colors.primary.main}12` : 'transparent',
            '&:hover': { bgcolor: on ? `${colors.primary.main}1a` : colors.grey[100] },
          }}>
          <SpeakerThumb
            interviewTitle={person.interview_title}
            initials={initials(person.name)}
            time={person.time}
            size={36}
            radius="50%"
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{ fontSize: 13.5, fontWeight: on ? 700 : 600, lineHeight: 1.3, color: colors.text.primary }}>
              {person.name}
            </Typography>
            <Typography sx={{ fontSize: 12 }} color="text.secondary">
              {person.count} {person.count === 1 ? 'excerpt' : 'excerpts'}
            </Typography>
          </Box>
        </ButtonBase>
      );
    })}
  </Box>
);

const filterButtonSx = (open: boolean) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.75,
  px: 1.5,
  py: 0.5,
  borderRadius: 999,
  minHeight: 0,
  fontSize: 13.5,
  fontWeight: 600,
  border: `1px solid ${open ? colors.primary.main : colors.grey[300]}`,
  color: open ? colors.primary.main : colors.text.primary,
  bgcolor: colors.background.paper,
  '&:hover': { borderColor: colors.primary.main },
});

const activeChipSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  pl: 1.25,
  pr: 0.75,
  py: 0.5,
  borderRadius: 999,
  minHeight: 0,
  fontSize: 13,
  fontWeight: 600,
  color: colors.common.white,
} as const;

type Panel = 'keywords' | 'people';

/**
 * The filters, secondary to the results: one button per kind (keyword, interviewee), each opening
 * its panel, with every active filter beside them as a removable chip, even with the panels closed.
 */
const FilterBar = ({
  matches,
  filters,
  onToggleKeyword,
  onTogglePerson,
  onClear,
}: {
  matches: AskMatch[];
  filters: Filters;
  onToggleKeyword: (keyword: string) => void;
  onTogglePerson: (interviewTitle: string) => void;
  onClear: () => void;
}) => {
  const [open, setOpen] = useState<Panel | null>(null);
  const hasKeywords = matches.some((m) => m.excerpts.some((c) => c.keywords?.length));
  const names = new Map(peopleIn(matches).map((p) => [p.interview_title, p.name]));
  const toggleOpen = (panel: Panel) => setOpen((current) => (current === panel ? null : panel));
  const total = filters.keywords.length + filters.people.length;
  const chevron = (panel: Panel) => (
    <ExpandMoreRoundedIcon
      sx={{ fontSize: 18, transition: 'transform .15s ease', transform: open === panel ? 'rotate(180deg)' : 'none' }}
    />
  );

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        {hasKeywords && (
          <ButtonBase
            onClick={() => toggleOpen('keywords')}
            aria-expanded={open === 'keywords'}
            sx={filterButtonSx(open === 'keywords')}>
            <FilterListRoundedIcon sx={{ fontSize: 18 }} />
            Filter by keyword
            {chevron('keywords')}
          </ButtonBase>
        )}
        <ButtonBase
          onClick={() => toggleOpen('people')}
          aria-expanded={open === 'people'}
          sx={filterButtonSx(open === 'people')}>
          <PersonOutlineRoundedIcon sx={{ fontSize: 18 }} />
          Filter by interviewee
          {chevron('people')}
        </ButtonBase>
        {filters.people.map((title) => (
          <ButtonBase
            key={title}
            onClick={() => onTogglePerson(title)}
            aria-label={`Remove filter ${names.get(title) ?? title}`}
            sx={{ ...activeChipSx, bgcolor: colors.grey[800] }}>
            {names.get(title) ?? title}
            <CloseRoundedIcon sx={{ fontSize: 15 }} />
          </ButtonBase>
        ))}
        {filters.keywords.map((keyword) => (
          <ButtonBase
            key={keyword}
            onClick={() => onToggleKeyword(keyword)}
            aria-label={`Remove filter ${keyword}`}
            sx={{ ...activeChipSx, bgcolor: keywordColor(keyword).solid }}>
            {keyword}
            <CloseRoundedIcon sx={{ fontSize: 15 }} />
          </ButtonBase>
        ))}
        {total > 1 && (
          <ButtonBase
            onClick={onClear}
            sx={{ fontSize: 13, fontWeight: 600, color: colors.primary.main, minHeight: 0 }}>
            Clear all
          </ButtonBase>
        )}
      </Box>
      {open === 'keywords' && <KeywordPanel matches={matches} selected={filters.keywords} onToggle={onToggleKeyword} />}
      {open === 'people' && <PeoplePanel matches={matches} selected={filters.people} onToggle={onTogglePerson} />}
    </Box>
  );
};

export const AskResults = ({
  state,
  onClear,
  onOpen,
}: {
  state: AskState;
  onClear: () => void;
  onOpen: (clip: EvidenceClip) => void;
}) => {
  // Excerpts are played by story, so have the title -> story lookup ready before the first click.
  const hasMatches = state.status === 'done' && state.response.matches.length > 0;
  useEffect(() => {
    if (hasMatches) void loadInterviewRefs().catch(() => undefined);
  }, [hasMatches]);

  // Keyword and interviewee filters (see matchesFilters). Reset for each new question.
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const response = state.status === 'done' ? state.response : null;
  useEffect(() => setFilters(NO_FILTERS), [response]);
  const toggle = useCallback(
    (keyword: string) => setFilters((f) => ({ ...f, keywords: toggleIn(f.keywords, keyword) })),
    [],
  );
  const togglePerson = useCallback(
    (title: string) => setFilters((f) => ({ ...f, people: toggleIn(f.people, title) })),
    [],
  );

  // Two columns (questions | excerpts) where there's room; stacked on smaller screens.
  const wide = useMediaQuery(theme.breakpoints.up('md'));

  if (state.status === 'idle') return null;
  const query = state.status === 'done' ? state.response.query : state.query;
  // A question keeps its number when a filter hides others.
  const rankOf = (match: AskMatch) =>
    state.status === 'done' ? state.response.matches.findIndex((m) => m.question_id === match.question_id) + 1 : 0;
  const shown =
    state.status === 'done'
      ? state.response.matches.filter((match) => match.excerpts.some((clip) => matchesFilters(clip, filters)))
      : [];

  return (
    <Box component="section" aria-live="polite" aria-busy={state.status === 'loading'} sx={{ mb: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1.5 }}>
        <Typography
          component="h2"
          sx={{ flex: 1, minWidth: 0, m: 0, fontSize: { xs: 17, md: 19 }, fontWeight: 700, lineHeight: 1.35 }}>
          {state.status === 'done' && state.response.matches.length > 0 ? (
            <>
              {state.response.matches.length} curated {state.response.matches.length === 1 ? 'question' : 'questions'}{' '}
              for{' '}
            </>
          ) : state.status === 'loading' ? (
            'Finding answers to '
          ) : null}
          <Box component="span" sx={{ fontWeight: 400, color: colors.text.secondary }}>
            &ldquo;{query}&rdquo;
          </Box>
        </Typography>
        <IconButton aria-label="Clear answers" onClick={onClear} size="small">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Box>

      {state.status === 'loading' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 3 }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary" sx={{ fontSize: 14 }}>
            Searching the interview guide and transcripts…
          </Typography>
        </Box>
      )}

      {state.status === 'error' && (
        <Typography color="error" sx={{ fontSize: 14, py: 2 }}>
          {state.message}
        </Typography>
      )}

      {state.status === 'done' && state.response.matches.length === 0 && (
        <Typography color="text.secondary" sx={{ fontSize: 14, py: 2 }}>
          None of the curated questions speak to that yet. Try one of the topics, or{' '}
          <Box component={Link} href="/explore" sx={{ color: colors.primary.main, fontWeight: 600 }}>
            browse every question on Explore
          </Box>
          .
        </Typography>
      )}

      {state.status === 'done' && state.response.matches.length > 0 && (
        <>
          <FilterBar
            matches={state.response.matches}
            filters={filters}
            onToggleKeyword={toggle}
            onTogglePerson={togglePerson}
            onClear={() => setFilters(NO_FILTERS)}
          />
          {wide ? (
            <QuestionsMasterDetail
              matches={shown}
              rankOf={rankOf}
              onOpen={onOpen}
              filters={filters}
              onToggleKeyword={toggle}
            />
          ) : (
            shown.map((match) => (
              <QuestionResult
                key={match.question_id}
                match={match}
                number={rankOf(match)}
                onOpen={onOpen}
                filters={filters}
                onToggleKeyword={toggle}
              />
            ))
          )}
        </>
      )}
    </Box>
  );
};

const DRAWER_WIDTH = 520;

/**
 * Plays an excerpt in the portal's shared transcript side panel, the way Explore does. The panel's
 * state is shared with the Ask AI drawer, so this one opens only for excerpts opened from here.
 */
export const useExcerptDrawer = () => {
  const openExcerpt = useOpenExcerpt();
  const sidePanelMode = useChatStore((s) => s.sidePanelMode);
  const closeSidePanel = useChatStore((s) => s.closeSidePanel);
  const [requested, setRequested] = useState(false);

  const open = useCallback(
    (clip: EvidenceClip) => {
      setRequested(true);
      void openExcerpt(clip);
    },
    [openExcerpt],
  );
  const close = useCallback(() => {
    setRequested(false);
    closeSidePanel();
  }, [closeSidePanel]);
  const interaction = useMemo(() => ({ onGoBack: close }), [close]);

  const drawer = (
    <Drawer
      anchor="right"
      open={requested && sidePanelMode === 'transcript'}
      onClose={close}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: DRAWER_WIDTH }, maxWidth: '100%' } } }}>
      <ChatInteractionProvider value={interaction}>
        <SidePanel />
      </ChatInteractionProvider>
    </Drawer>
  );

  return { open, drawer };
};
