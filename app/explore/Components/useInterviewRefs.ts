'use client';

import { useEffect, useState } from 'react';
import { loadInterviewRefs, type InterviewRef } from '@/lib/insights/interviewRefs';

/**
 * The interview_title -> story/media map, loaded once per page and shared
 * through the module-level cache in loadInterviewRefs. Explore's pages are
 * statically prerendered, so this resolves on the client rather than at build.
 */
export const useInterviewRefs = (): Record<string, InterviewRef> => {
  const [refs, setRefs] = useState<Record<string, InterviewRef>>({});

  useEffect(() => {
    let cancelled = false;
    loadInterviewRefs().then((loaded) => {
      if (!cancelled) setRefs(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return refs;
};
