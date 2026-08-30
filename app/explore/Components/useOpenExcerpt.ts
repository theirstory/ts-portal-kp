'use client';

import { useCallback } from 'react';
import { useChatStore } from '@/app/stores/useChatStore';
import { loadInterviewRefs } from '@/lib/insights/interviewRefs';
import { displayName } from '@/lib/insights/format';
import type { Citation } from '@/types/chat';
import type { EvidenceClip } from '@/types/insights';

/**
 * Opens an evidence-bank excerpt in the portal's existing transcript side panel
 * — the same one Discover uses for a citation, so an excerpt lands on the video
 * cued to its timestamp with the passage highlighted in the transcript.
 *
 * The panel keys off a Citation, so the clip is adapted into one. `index` is 0
 * because Explore excerpts aren't numbered the way chat citations are; the
 * panel header omits the prefix for a falsy index.
 */
export const useOpenExcerpt = () => {
  const openTranscript = useChatStore((s) => s.openTranscript);

  return useCallback(
    async (clip: EvidenceClip) => {
      const refs = await loadInterviewRefs();
      const ref = refs[clip.interview_title];
      if (!ref) {
        console.error('[explore] no story found for', clip.interview_title);
        return;
      }

      const citation: Citation = {
        index: 0,
        transcription: clip.quote,
        speaker: clip.speaker,
        interviewTitle: displayName(clip.interview_title),
        sectionTitle: '',
        startTime: clip.start,
        endTime: clip.end,
        theirstoryId: ref.storyUuid,
        videoUrl: ref.videoUrl,
        isAudioFile: ref.isAudioFile,
      };

      openTranscript(citation);
    },
    [openTranscript],
  );
};
