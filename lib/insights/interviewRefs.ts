'use client';

import type { InterviewRef, InterviewsResponse } from '@/app/api/insights/interviews/route';

/**
 * Client-side cache of interview_title -> story uuid / media, fetched once per
 * page load. Explore needs it to turn an evidence-bank excerpt into a Citation
 * the shared side panel understands.
 */

let pending: Promise<Record<string, InterviewRef>> | null = null;

export const loadInterviewRefs = (): Promise<Record<string, InterviewRef>> => {
  if (!pending) {
    pending = fetch('/api/insights/interviews')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((json: InterviewsResponse) => json.byTitle ?? {})
      .catch((error) => {
        console.error('[explore] interview refs failed to load', error);
        // Let a later click retry rather than caching the failure forever.
        pending = null;
        return {};
      });
  }
  return pending;
};

export type { InterviewRef };
