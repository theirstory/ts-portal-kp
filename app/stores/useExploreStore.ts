import { create } from 'zustand';

/**
 * Explore's view state. Excerpt playback is not here — that goes through the
 * portal's shared side panel (useChatStore), the same one Discover uses.
 */
type ExploreState = {
  /** Theme page: browse the theme's questions, or read every excerpt in it. */
  themeMode: 'questions' | 'excerpts';
  /** Question ids collapsed in the theme page's all-excerpts mode. */
  collapsedQuestions: number[];
  /** Question view: cards side by side, or one column to read through. */
  layout: 'compare' | 'read';
  /** Display names selected in the "who answered" panel; [] means unfiltered. */
  speakers: string[];

  setThemeMode: (mode: 'questions' | 'excerpts') => void;
  toggleQuestionCollapsed: (questionId: number) => void;
  collapseQuestions: (questionIds: number[]) => void;
  expandAllQuestions: () => void;
  setLayout: (layout: 'compare' | 'read') => void;
  toggleSpeaker: (name: string) => void;
  setSpeakers: (names: string[]) => void;
  clearSpeakers: () => void;
};

export const useExploreStore = create<ExploreState>((set) => ({
  themeMode: 'questions',
  collapsedQuestions: [],
  layout: 'compare',
  speakers: [],

  setThemeMode: (themeMode) => set({ themeMode }),
  toggleQuestionCollapsed: (questionId) =>
    set((state) => ({
      collapsedQuestions: state.collapsedQuestions.includes(questionId)
        ? state.collapsedQuestions.filter((id) => id !== questionId)
        : [...state.collapsedQuestions, questionId],
    })),
  collapseQuestions: (collapsedQuestions) => set({ collapsedQuestions }),
  expandAllQuestions: () => set({ collapsedQuestions: [] }),
  setLayout: (layout) => set({ layout }),
  toggleSpeaker: (name) =>
    set((state) => ({
      speakers: state.speakers.includes(name)
        ? state.speakers.filter((n) => n !== name)
        : [...state.speakers, name],
    })),
  setSpeakers: (speakers) => set({ speakers }),
  clearSpeakers: () => set({ speakers: [] }),
}));
