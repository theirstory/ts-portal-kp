/**
 * Types for the pre-computed evidence bank that powers the Explore
 * (themes & questions) section. See json/insights/kp_evidence_bank.json —
 * the bank is a static analysis artifact, not something the app derives.
 */

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

/** One verbatim excerpt from one interview that answers one guide question. */
export interface EvidenceMatch {
  quote: string;
  speaker: string;
  chunk_id: number;
  /** Seconds into the source video. */
  start: number;
  end: number;
  confidence: Confidence;
  rationale: string;
}

export interface EvidenceInterview {
  interview_title: string;
  /** TheirStory `_id`. NOT the uuid /story/[storyUuid] expects — see resolveStoryUuids. */
  interview_id: string;
  source_file: string;
}

export interface EvidenceQuestion {
  question_id: number;
  category: string;
  question: string;
  /** Keyed by interview_title. An empty array means that interview did not address the question. */
  by_interview: Record<string, EvidenceMatch[]>;
}

export interface EvidenceBank {
  _schema_note?: string;
  interviews: EvidenceInterview[];
  questions: EvidenceQuestion[];
}

/** A single match flattened together with the interview it came from. */
export interface EvidenceClip extends EvidenceMatch {
  interview_title: string;
  /** Reader-facing label for the interview, e.g. "Ed Ellison, MD · I". */
  name: string;
}

/** All clips from one interview for one question, in timestamp order. */
export interface QuestionAnswer {
  interview_title: string;
  name: string;
  initials: string;
  clips: EvidenceClip[];
}

/** A theme: one of the 8 interview-guide categories. */
export interface ThemeSummary {
  category: string;
  slug: string;
  /** "01"–"08", the guide's ordering. */
  index: string;
  questions: EvidenceQuestion[];
  questionCount: number;
  clipCount: number;
}

/** One interviewee's presence in a theme or question. */
export interface Voice {
  interview_title: string;
  name: string;
  clipCount: number;
}

/** A question as it appears in a search result list. */
export interface SearchResult {
  question: EvidenceQuestion;
  hits: EvidenceClip[];
  totalHits: number;
  /** True when the question text itself matched but none of its quotes did. */
  questionMatchedOnly: boolean;
}
