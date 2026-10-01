'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Box } from '@mui/material';
import { displayName, plural } from '@/lib/insights/format';
import { monoPlain, t } from '../tokens';
import { useEvidence } from './EvidenceProvider';
import { Eyebrow } from './primitives';
import { SpeakerThumb } from './SpeakerThumb';
import { useInterviewRefs } from './useInterviewRefs';

/** Up to five overlapping faces — who speaks inside a theme, at a glance. */
export const FaceStack = ({ titles, max = 5 }: { titles: string[]; max?: number }) => {
  const { collectionVoices } = useEvidence();
  const shown = titles.slice(0, max);
  const overflow = titles.length - shown.length;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((title, index) => (
        <Box
          key={title}
          title={displayName(title)}
          sx={{
            ml: index === 0 ? 0 : '-8px',
            borderRadius: '50%',
            border: `2px solid ${t.surface}`,
            display: 'flex',
            zIndex: shown.length - index,
          }}>
          <SpeakerThumb
            interviewTitle={title}
            initials={displayName(title).slice(0, 1)}
            time={collectionVoices.find((v) => v.interview_title === title)?.frameTime ?? 60}
            size={26}
            radius="50%"
          />
        </Box>
      ))}
      {overflow > 0 && <Box sx={{ ...monoPlain(10), color: t.muted3, ml: '8px' }}>+{overflow}</Box>}
    </Box>
  );
};

/** One person in a VoiceList. */
export interface VoiceItem {
  interview_title: string;
  name: string;
  initials: string;
  frameTime: number;
  clipCount: number;
}

/**
 * A compact, wrapping list of people that stays a few rows tall however many
 * recordings the archive grows to: columns fill the available width, and past
 * `collapsedCount` the rest sit behind a "show all" toggle. Each opens their
 * full interview once its story has resolved.
 */
export const VoiceList = ({
  voices,
  collapsedCount = 12,
  minColumn = 190,
}: {
  voices: VoiceItem[];
  collapsedCount?: number;
  minColumn?: number;
}) => {
  const refs = useInterviewRefs();
  const [expanded, setExpanded] = useState(false);
  const collapsible = voices.length > collapsedCount;
  const shown = collapsible && !expanded ? voices.slice(0, collapsedCount) : voices;

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(min(${minColumn}px, 100%), 1fr))`,
          gap: '6px 18px',
        }}>
        {shown.map((voice) => {
          const uuid = refs[voice.interview_title]?.storyUuid;
          const inner = (
            <>
              <SpeakerThumb
                interviewTitle={voice.interview_title}
                initials={voice.initials}
                time={voice.frameTime}
                size={28}
                radius="50%"
              />
              <Box
                className="voice-name"
                sx={{
                  minWidth: 0,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: t.ink,
                  lineHeight: 1.25,
                  transition: 'color 0.12s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                {voice.name}
              </Box>
              <Box sx={{ ...monoPlain(10), color: t.muted3, flex: 'none', ml: 'auto' }}>{voice.clipCount}</Box>
            </>
          );

          const sx = {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0,
            textDecoration: 'none',
            color: 'inherit',
          } as const;
          const title = `${voice.name} — ${plural(voice.clipCount, 'excerpt')}`;

          // Only a link once the story uuid has resolved; otherwise it would
          // point nowhere.
          return uuid ? (
            <Box
              key={voice.interview_title}
              component={Link}
              href={`/story/${uuid}`}
              title={title}
              sx={{ ...sx, '&:hover .voice-name': { color: t.accent } }}>
              {inner}
            </Box>
          ) : (
            <Box key={voice.interview_title} title={title} sx={sx}>
              {inner}
            </Box>
          );
        })}
      </Box>

      {collapsible && (
        <Box
          component="button"
          type="button"
          onClick={() => setExpanded((open) => !open)}
          sx={{
            ...monoPlain(10.5, 0.06),
            mt: '10px',
            p: 0,
            border: 'none',
            background: 'transparent',
            color: t.accent,
            cursor: 'pointer',
            '&:hover': { textDecoration: 'underline' },
          }}>
          {expanded ? 'show fewer' : `show all ${voices.length}`}
        </Box>
      )}
    </Box>
  );
};

/** Everyone in the archive, alphabetically, with how many excerpts each has. */
export const PeopleStrip = () => {
  const { collectionVoices } = useEvidence();
  const voices = useMemo(() => [...collectionVoices].sort((a, b) => a.name.localeCompare(b.name)), [collectionVoices]);

  return (
    <Box>
      <Eyebrow sx={{ mb: '10px' }}>The voices in this archive · {voices.length}</Eyebrow>
      <VoiceList voices={voices} collapsedCount={12} />
    </Box>
  );
};
