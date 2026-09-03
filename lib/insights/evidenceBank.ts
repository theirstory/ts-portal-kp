/**
 * Access layer for the static evidence bank (json/insights/kp_evidence_bank.json).
 *
 * The bank is pre-computed — nothing here re-derives excerpts. This module
 * indexes it (themes in guide order, question lookup, per-interview rosters) and
 * provides the selectors the Explore views render from.
 */

import bankData from '@/json/insights/kp_evidence_bank.json';
import type {
  EvidenceBank,
  EvidenceClip,
  EvidenceInterview,
  EvidenceQuestion,
  QuestionAnswer,
  SearchResult,
  ThemeSummary,
  Voice,
} from '@/types/insights';
import { categorySlug, displayName, initials } from './format';

const bank = bankData as EvidenceBank;

/** The order the interview guide lists its themes in. */
const CATEGORY_ORDER = [
  'Personal Background and Journey',
  'Organizational Values and Culture',
  'Leadership and Innovation',
  'Patient Care and Clinical Practices',
  'Community Engagement and Public Health',
  'Technology and Innovation',
  'Leadership Development and Mentorship',
  'Future Goals and Vision',
];

/** Questions hand-picked for the "start somewhere" rail on the browse view. */
export const FEATURED_QUESTION_IDS = [16, 24, 47];

export const evidenceInterviews: EvidenceInterview[] = bank.interviews;

export const evidenceQuestions: EvidenceQuestion[] = bank.questions;

/** Every interview in the collection, in bank order — the roster. */
export const roster: EvidenceInterview[] = evidenceInterviews;

export const rosterSize = roster.length;

export const totalClipCount = evidenceQuestions.reduce(
  (sum, q) => sum + Object.values(q.by_interview).reduce((n, matches) => n + matches.length, 0),
  0,
);

const questionById = new Map(evidenceQuestions.map((q) => [q.question_id, q]));

export const getQuestion = (questionId: number): EvidenceQuestion | undefined => questionById.get(questionId);

/** Clips on one question for one interview, in timestamp order. */
const clipsFor = (question: EvidenceQuestion, interviewTitle: string): EvidenceClip[] =>
  (question.by_interview[interviewTitle] ?? [])
    .map((match) => ({ ...match, interview_title: interviewTitle, name: displayName(interviewTitle) }))
    .sort((a, b) => a.start - b.start);

export const questionClipCount = (question: EvidenceQuestion): number =>
  Object.values(question.by_interview).reduce((n, matches) => n + matches.length, 0);

/** How many interviews addressed a question. */
export const respondentCount = (question: EvidenceQuestion): number =>
  Object.values(question.by_interview).filter((matches) => matches.length > 0).length;

/** The 8 themes, in guide order. Themes with no questions are dropped. */
export const themes: ThemeSummary[] = CATEGORY_ORDER.map((category, index) => {
  const questions = evidenceQuestions.filter((q) => q.category === category);
  return {
    category,
    slug: categorySlug(category),
    index: String(index + 1).padStart(2, '0'),
    questions,
    questionCount: questions.length,
    clipCount: questions.reduce((sum, q) => sum + questionClipCount(q), 0),
  };
}).filter((theme) => theme.questionCount > 0);

const themeBySlug = new Map(themes.map((theme) => [theme.slug, theme]));
const themeByCategory = new Map(themes.map((theme) => [theme.category, theme]));

export const getThemeBySlug = (slug: string): ThemeSummary | undefined => themeBySlug.get(slug);

export const getThemeByCategory = (category: string): ThemeSummary | undefined => themeByCategory.get(category);

/**
 * Every interview that answered a question, with its clips. Interviews with no
 * match are omitted — an empty array in the bank is expected, not missing data.
 */
export const answersFor = (question: EvidenceQuestion): QuestionAnswer[] =>
  roster
    .map((interview) => {
      const clips = clipsFor(question, interview.interview_title);
      const name = displayName(interview.interview_title);
      return { interview_title: interview.interview_title, name, initials: initials(name), clips };
    })
    .filter((answer) => answer.clips.length > 0);

/** Interviews that did not speak to a question, by display name. */
export const silentFor = (question: EvidenceQuestion): string[] =>
  roster
    .filter((interview) => (question.by_interview[interview.interview_title] ?? []).length === 0)
    .map((interview) => displayName(interview.interview_title));

/** The full roster with per-question clip counts — drives the "who answered" panel. */
export const rosterFor = (question: EvidenceQuestion): Voice[] =>
  roster.map((interview) => ({
    interview_title: interview.interview_title,
    name: displayName(interview.interview_title),
    clipCount: (question.by_interview[interview.interview_title] ?? []).length,
  }));

/** The full roster with per-theme clip counts — drives "voices in this theme". */
export const voicesFor = (theme: ThemeSummary): Voice[] =>
  roster.map((interview) => ({
    interview_title: interview.interview_title,
    name: displayName(interview.interview_title),
    clipCount: theme.questions.reduce(
      (sum, question) => sum + (question.by_interview[interview.interview_title] ?? []).length,
      0,
    ),
  }));

/** One interviewee across the whole collection — drives the people band. */
export interface CollectionVoice {
  interview_title: string;
  name: string;
  initials: string;
  clipCount: number;
  questionCount: number;
  /** A moment they are speaking, for the thumbnail frame. */
  frameTime: number;
}

/** Everyone in the archive, with how much of it they account for. */
export const collectionVoices: CollectionVoice[] = roster.map((interview) => {
  const title = interview.interview_title;
  let clipCount = 0;
  let questionCount = 0;
  let frameTime = 60;
  let earliest = Infinity;

  for (const question of evidenceQuestions) {
    const matches = question.by_interview[title] ?? [];
    if (matches.length === 0) continue;
    questionCount += 1;
    clipCount += matches.length;
    for (const match of matches) {
      if (match.start < earliest) earliest = match.start;
    }
  }

  // Their first indexed moment, rather than the top of the tape where the
  // recording is usually still a slate or the interviewer talking.
  if (Number.isFinite(earliest)) frameTime = earliest;

  const name = displayName(title);
  return { interview_title: title, name, initials: initials(name), clipCount, questionCount, frameTime };
});

/** Interviews with at least one excerpt in a theme, in roster order. */
export const themeVoiceTitles = (theme: ThemeSummary): string[] =>
  voicesFor(theme)
    .filter((voice) => voice.clipCount > 0)
    .map((voice) => voice.interview_title);

/** Every clip on a question across all interviews, in roster order. */
export const allClipsFor = (question: EvidenceQuestion): EvidenceClip[] =>
  roster.flatMap((interview) => clipsFor(question, interview.interview_title));

/** Other questions in the same theme. */
export const siblingsOf = (question: EvidenceQuestion): EvidenceQuestion[] =>
  (getThemeByCategory(question.category)?.questions ?? []).filter((q) => q.question_id !== question.question_id);

/**
 * Case-insensitive substring search over question text and excerpt quotes,
 * optionally narrowed to one theme. A question is a result if any of its quotes
 * match, or if the question text itself does.
 */
export const search = (query: string, category?: string): SearchResult[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const results: SearchResult[] = [];

  for (const question of evidenceQuestions) {
    if (category && question.category !== category) continue;

    const hits = allClipsFor(question).filter((clip) => clip.quote.toLowerCase().includes(needle));
    const questionMatches = question.question.toLowerCase().includes(needle);
    if (hits.length === 0 && !questionMatches) continue;

    results.push({
      question,
      hits: hits.slice(0, 3),
      totalHits: hits.length,
      questionMatchedOnly: hits.length === 0,
    });
  }

  // Richest questions first — the ones with the most to say about the term.
  // Ties keep the interview guide's order so the list is stable.
  return results.sort((a, b) => b.totalHits - a.totalHits || a.question.question_id - b.question.question_id);
};

/** Themes present in a result set, for the search filter chips. */
export const categoriesInResults = (results: SearchResult[]): string[] =>
  themes.map((theme) => theme.category).filter((category) => results.some((r) => r.question.category === category));

/**
 * Every indexed excerpt for one interview, deduped and time-ordered. The drawer
 * falls back to these when the full transcript cannot be loaded.
 */
export const excerptsForInterview = (interviewTitle: string): EvidenceClip[] => {
  const seen = new Set<string>();
  const lines: EvidenceClip[] = [];

  for (const question of evidenceQuestions) {
    for (const clip of clipsFor(question, interviewTitle)) {
      const key = `${clip.start}|${clip.quote.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(clip);
    }
  }

  return lines.sort((a, b) => a.start - b.start);
};
