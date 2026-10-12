'use client';

import { useCallback } from 'react';
import { useChatStore } from '@/app/stores/useChatStore';
import { loadInterviewRefs } from '@/lib/insights/interviewRefs';
import type { Citation } from '@/types/chat';

/** Anything with a verified clip: a system-map claim, a journey moment, an event view, a story. */
export type ClipSource = { t: number; end: number; storyUuid: string; quote: string };

/**
 * Plays a claim's clip in the portal's transcript side panel: the video cued to the first quoted
 * word, with the quoted passage (first to last word) highlighted.
 */
export const useOpenClip = () => {
  const openTranscript = useChatStore((s) => s.openTranscript);

  return useCallback(
    async (claim: ClipSource, narratorName: string) => {
      const refs = Object.values(await loadInterviewRefs());
      const ref = refs.find((r) => r.storyUuid === claim.storyUuid);
      const citation: Citation = {
        index: 0,
        transcription: claim.quote,
        speaker: narratorName,
        interviewTitle: narratorName,
        sectionTitle: '',
        startTime: claim.t,
        endTime: claim.end,
        theirstoryId: claim.storyUuid,
        videoUrl: ref?.videoUrl ?? '',
        isAudioFile: ref?.isAudioFile ?? false,
      };
      openTranscript(citation);
    },
    [openTranscript],
  );
};

/** The clip as a link into the full recording. */
export const clipHref = (claim: Pick<ClipSource, 'storyUuid' | 't' | 'end'>) =>
  `/story/${claim.storyUuid}?start=${claim.t}&end=${claim.end}`;
