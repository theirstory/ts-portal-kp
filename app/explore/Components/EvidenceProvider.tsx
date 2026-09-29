'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { indexEvidenceBank } from '@/lib/insights/evidenceBank';
import type { EvidenceIndex } from '@/lib/insights/evidenceBank';
import type { EvidenceBank } from '@/types/insights';

/**
 * The evidence bank for this request (reviewed + generated excerpts), loaded on the server by the
 * Explore layout and indexed once here for every view under it.
 */
const EvidenceContext = createContext<EvidenceIndex | null>(null);

export function EvidenceProvider({ bank, children }: { bank: EvidenceBank; children: React.ReactNode }) {
  const index = useMemo(() => indexEvidenceBank(bank), [bank]);
  return <EvidenceContext.Provider value={index}>{children}</EvidenceContext.Provider>;
}

export function useEvidence(): EvidenceIndex {
  const index = useContext(EvidenceContext);
  if (!index) throw new Error('useEvidence must be used inside <EvidenceProvider>');
  return index;
}
