'use client';

import React from 'react';
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

/**
 * Everyone in the archive, compact enough to sit beside the "start somewhere" rail so
 * the whole landing page fits one screen. Each opens their full interview.
 */
export const PeopleStrip = () => {
  const { collectionVoices } = useEvidence();
  const refs = useInterviewRefs();

  return (
    <Box>
      <Eyebrow sx={{ mb: '10px' }}>The voices in this archive</Eyebrow>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: '8px 20px',
        }}>
        {collectionVoices.map((voice) => {
          const uuid = refs[voice.interview_title]?.storyUuid;
          const inner = (
            <>
              <SpeakerThumb
                interviewTitle={voice.interview_title}
                initials={voice.initials}
                time={voice.frameTime}
                size={34}
                radius="50%"
              />
              <Box sx={{ minWidth: 0 }}>
                <Box
                  className="voice-name"
                  sx={{
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
                <Box sx={{ ...monoPlain(10), color: t.muted3, mt: '1px' }}>{plural(voice.clipCount, 'excerpt')}</Box>
              </Box>
            </>
          );

          const sx = {
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            minWidth: 0,
            textDecoration: 'none',
            color: 'inherit',
          } as const;

          // Only a link once the story uuid has resolved; otherwise it would
          // point nowhere.
          return uuid ? (
            <Box
              key={voice.interview_title}
              component={Link}
              href={`/story/${uuid}`}
              sx={{ ...sx, '&:hover .voice-name': { color: t.accent } }}>
              {inner}
            </Box>
          ) : (
            <Box key={voice.interview_title} sx={sx}>
              {inner}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * The whole roster in fixed order, faces of those present and the rest greyed —
 * so a coverage row says *who* answered, not just how many.
 */
export const FaceRow = ({
  titles,
  present,
  size = 22,
}: {
  titles: string[];
  present: (title: string) => boolean;
  size?: number;
}) => {
  const { collectionVoices } = useEvidence();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      {titles.map((title) => {
        const here = present(title);
        const voice = collectionVoices.find((v) => v.interview_title === title);
        return (
          <Box
            key={title}
            title={`${displayName(title)}${here ? '' : ' — did not answer'}`}
            sx={{ display: 'flex', opacity: here ? 1 : 0.28 }}>
            <SpeakerThumb
              interviewTitle={title}
              initials={displayName(title).slice(0, 1)}
              time={voice?.frameTime ?? 60}
              size={size}
              radius="50%"
              muted={!here}
            />
          </Box>
        );
      })}
    </Box>
  );
};
