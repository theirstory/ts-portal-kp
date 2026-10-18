'use client';

/**
 * "Ask the collection" on the home page: a visitor asks a question in their own words and gets back
 * the Permanente-curated interview questions (the ones Explore is built on) whose answers speak to
 * it, each with its closest excerpts. Unlike Discover, nothing generated is shown: every result is a
 * curated question and every excerpt is a verbatim passage from the evidence bank.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Box, ButtonBase, CircularProgress, Drawer, IconButton, InputBase, Typography } from '@mui/material';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { ChatInteractionProvider } from '@/app/discover/ChatInteractionContext';
import { SidePanel } from '@/app/discover/Components/SidePanel';
import { SpeakerThumb } from '@/app/explore/Components/SpeakerThumb';
import { useOpenExcerpt } from '@/app/explore/Components/useOpenExcerpt';
import { useChatStore } from '@/app/stores/useChatStore';
import { loadInterviewRefs } from '@/lib/insights/interviewRefs';
import { colors } from '@/lib/theme';
import { initials } from '@/lib/insights/format';
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

/** Characters of the quote kept before its key phrase, so the phrase shows within the clamped lines. */
const LEAD = 45;

/**
 * The quote with its key phrase highlighted. A long quote is shown from shortly before the phrase
 * (with an ellipsis) so the highlight is always in view.
 */
const QuoteWithPhrase = ({ quote, phrase }: { quote: string; phrase?: string }) => {
  const at = phrase ? quote.indexOf(phrase) : -1;
  if (!phrase || at < 0) return <>&ldquo;{quote}&rdquo;</>;

  let from = 0;
  if (at > LEAD) {
    const space = quote.indexOf(' ', at - LEAD);
    from = space >= 0 && space < at ? space + 1 : at;
  }
  return (
    <>
      &ldquo;{from > 0 && '…'}
      {quote.slice(from, at)}
      <Box
        component="mark"
        sx={{
          bgcolor: `${colors.primary.main}1f`,
          color: colors.text.primary,
          fontWeight: 600,
          borderRadius: '3px',
          px: '2px',
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
        }}>
        {phrase}
      </Box>
      {quote.slice(at + phrase.length)}&rdquo;
    </>
  );
};

const Excerpt = ({ clip, onOpen }: { clip: EvidenceClip; onOpen: (clip: EvidenceClip) => void }) => (
  <ButtonBase
    onClick={() => onOpen(clip)}
    aria-label={`Play excerpt from ${clip.name} at ${formatTime(clip.start)}${clip.tag ? `: ${clip.tag}` : ''}`}
    sx={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 1.75,
      width: '100%',
      textAlign: 'left',
      p: 1.25,
      borderRadius: 1.5,
      minHeight: 0,
      transition: 'background-color .15s ease',
      '&:hover': { bgcolor: colors.grey[100] },
      '&:hover .play': { bgcolor: colors.primary.main, transform: 'scale(1.08)' },
    }}>
    {/* Their face at the moment they say it, with a play badge. */}
    <Box sx={{ position: 'relative', flexShrink: 0 }}>
      <SpeakerThumb
        interviewTitle={clip.interview_title}
        initials={initials(clip.name)}
        time={clip.start + 2}
        size={76}
        radius="12px"
      />
      <Box
        className="play"
        sx={{
          position: 'absolute',
          right: -6,
          bottom: -6,
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: colors.primary.dark,
          color: colors.common.white,
          border: `2px solid ${colors.background.paper}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color .15s ease, transform .15s ease',
        }}>
        <PlayArrowRoundedIcon sx={{ fontSize: 18 }} />
      </Box>
    </Box>
    <Box sx={{ minWidth: 0 }}>
      {clip.tag && (
        <Typography sx={{ fontSize: 15.5, fontWeight: 700, color: colors.text.primary, lineHeight: 1.3, mb: 0.25 }}>
          {clip.tag}
        </Typography>
      )}
      <Typography
        sx={
          clip.tag
            ? { fontSize: 12.5, color: colors.text.secondary, lineHeight: 1.3 }
            : { fontSize: 14, fontWeight: 700, color: colors.text.primary, lineHeight: 1.3 }
        }>
        {clip.tag ? (
          <>
            <Box component="span" sx={{ fontWeight: 600 }}>
              {clip.name}
            </Box>{' '}
            · {formatTime(clip.start)}
          </>
        ) : (
          <>
            {clip.name}
            <Box component="span" sx={{ fontWeight: 400, color: colors.text.secondary, fontSize: 12.5 }}>
              {' '}
              · {formatTime(clip.start)}
            </Box>
          </>
        )}
      </Typography>
      <Typography
        sx={{
          mt: 0.75,
          fontSize: 14,
          lineHeight: 1.6,
          fontStyle: 'italic',
          color: colors.text.secondary,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
        <QuoteWithPhrase quote={clip.quote} phrase={clip.key_phrase} />
      </Typography>
    </Box>
  </ButtonBase>
);

const FACES = 7;

/** The faces of everyone who answered, overlapping, with the overflow as a count. */
const Voices = ({ voices }: { voices: AskMatch['voices'] }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 1.25, mb: 1 }}>
    <Box sx={{ display: 'flex', pl: '6px' }}>
      {voices.slice(0, FACES).map((voice) => (
        <Box
          key={voice.interview_title}
          title={voice.name}
          sx={{ ml: '-6px', borderRadius: '50%', border: `2px solid ${colors.background.paper}`, lineHeight: 0 }}>
          <SpeakerThumb
            interviewTitle={voice.interview_title}
            initials={voice.initials}
            time={voice.time}
            size={34}
            radius="50%"
          />
        </Box>
      ))}
      {voices.length > FACES && (
        <Box
          sx={{
            ml: '-6px',
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: `2px solid ${colors.background.paper}`,
            bgcolor: colors.grey[200],
            color: colors.text.secondary,
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          +{voices.length - FACES}
        </Box>
      )}
    </Box>
  </Box>
);

const MatchCard = ({ match, onOpen }: { match: AskMatch; onOpen: (clip: EvidenceClip) => void }) => (
  <Box
    component="article"
    sx={{
      bgcolor: colors.background.paper,
      borderRadius: 2,
      boxShadow: `0 1px 3px ${colors.common.shadow}`,
      p: { xs: 2, md: 2.5 },
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }}>
    <Box
      component={Link}
      href={`/explore/${match.categorySlug}`}
      sx={{
        alignSelf: 'flex-start',
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: colors.primary.main,
        textDecoration: 'none',
        '&:hover': { textDecoration: 'underline' },
      }}>
      {match.category}
    </Box>
    <Typography component="h3" sx={{ m: 0, mt: 0.75, fontSize: { xs: 17, md: 18 }, fontWeight: 700, lineHeight: 1.35 }}>
      <Box
        component={Link}
        href={`/explore/q/${match.question_id}`}
        sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { color: colors.primary.main } }}>
        {match.question}
      </Box>
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1.25 }}>
      <Voices voices={match.voices} />
      <Typography sx={{ fontSize: 13 }} color="text.secondary">
        {match.narratorCount} {match.narratorCount === 1 ? 'leader' : 'leaders'} answered · {match.clipCount}{' '}
        {match.clipCount === 1 ? 'excerpt' : 'excerpts'}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', flexDirection: 'column', mx: -1.25, mt: 0.5 }}>
      {match.previews.map((clip) => (
        <Excerpt key={`${clip.interview_title}-${clip.start}`} clip={clip} onOpen={onOpen} />
      ))}
    </Box>
    <Box
      component={Link}
      href={`/explore/q/${match.question_id}`}
      sx={{
        mt: 'auto',
        pt: 1.5,
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        fontSize: 14,
        fontWeight: 700,
        color: colors.primary.main,
        textDecoration: 'none',
        '&:hover': { textDecoration: 'underline' },
      }}>
      Hear all {match.clipCount} excerpts
      <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
    </Box>
  </Box>
);

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

  if (state.status === 'idle') return null;
  const query = state.status === 'done' ? state.response.query : state.query;

  return (
    <Box component="section" aria-live="polite" aria-busy={state.status === 'loading'} sx={{ mb: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" sx={{ m: 0, fontSize: { xs: 18, md: 20 }, fontWeight: 700, lineHeight: 1.3 }}>
            {state.status === 'loading' ? 'Finding answers to' : 'Curated questions that answer'} &ldquo;{query}&rdquo;
          </Typography>
          {state.status === 'done' && state.response.matches.length > 0 && (
            <Typography sx={{ fontSize: 13.5, mt: 0.5 }} color="text.secondary">
              Questions from the Permanente interview guide, with the excerpts closest to what you asked. Play one, or
              open a question to hear every answer.
            </Typography>
          )}
        </Box>
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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: { xs: 1.5, md: 2 },
          }}>
          {state.response.matches.map((match) => (
            <MatchCard key={match.question_id} match={match} onOpen={onOpen} />
          ))}
        </Box>
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
