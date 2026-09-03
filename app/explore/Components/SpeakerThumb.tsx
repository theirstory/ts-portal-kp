'use client';

import React, { useState } from 'react';
import { Box } from '@mui/material';
import { getMuxPlaybackId } from '@/app/utils/converters';
import { monoPlain, t } from '../tokens';
import { useInterviewRefs } from './useInterviewRefs';

/**
 * The speaker's face, pulled from the interview video at a given moment — so a
 * card shows the person as they were saying the words beside it, rather than a
 * set of initials.
 *
 * Falls back to initials while the interview map loads, for audio-only
 * recordings, and if the frame fails to fetch.
 */
export const SpeakerThumb = ({
  interviewTitle,
  initials,
  time,
  size = 56,
  radius = '6px',
  muted = false,
}: {
  interviewTitle: string;
  initials: string;
  /** Seconds into the interview to grab the frame from. */
  time: number;
  size?: number;
  radius?: string;
  /** Render greyed out — used for people who didn't answer, or filtered-out rows. */
  muted?: boolean;
}) => {
  const refs = useInterviewRefs();
  const [failed, setFailed] = useState(false);

  const ref = refs[interviewTitle];
  const playbackId = ref && !ref.isAudioFile ? getMuxPlaybackId(ref.videoUrl) : null;
  // 2x for crisp rendering on retina; the frame is cropped square on Mux's side.
  const src = playbackId
    ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${Math.max(0, Math.round(time))}&width=${size * 2}&height=${size * 2}&fit_mode=crop`
    : null;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: radius,
        overflow: 'hidden',
        background: t.avatarBg,
        color: t.avatarFg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        ...monoPlain(Math.max(10, Math.round(size / 4.5)), 0.02),
        ...(muted ? { filter: 'grayscale(1)', opacity: 0.55 } : {}),
      }}>
      {initials}
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </Box>
  );
};
