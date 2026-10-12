/**
 * Design tokens for the Explore section.
 *
 * Colours come from the portal's config-driven theme (config.json -> lib/theme)
 * so Explore matches the rest of the app; the layout roles below are the ones
 * the Explore design uses, mapped onto that palette. Only the type scale and
 * spacing rhythm are local to this section.
 */

import { colors } from '@/lib/theme';

/** Permanente brand blue. */
const PERMANENTE_BLUE = '#0078b3';

export const t = {
  paper: colors.background.mainPage,
  surface: colors.background.paper,
  surfaceHover: colors.background.subtle,
  rule: colors.common.border,
  ruleSoft: colors.common.divider,
  fieldBorder: colors.grey[300],
  ink: colors.text.primary,
  // Three de-emphasis steps, all at or above 4.5:1 on both the page (#f0f0f0)
  // and card (#fff) backgrounds. The design's lighter greys measured 2.4:1.
  ink2: colors.grey[800],
  muted: colors.grey[700],
  muted2: colors.grey[700],
  muted3: colors.grey[700],
  muted4: '#6b6b6b',
  /**
   * Permanente blue. #0078b3 itself measures 4.25:1 on the page background, so
   * link and label text uses one step darker to clear AA; the brand value is
   * kept for rails, dots and fills, where the bar is 3:1.
   */
  accent: '#006ea5',
  accentHover: '#00567f',
  /** Blue text sitting on the `wash` tint, which lifts the background too far
   *  for `accent` to clear AA (4.40:1 there). */
  accentOnWash: '#00567f',
  accentFill: PERMANENTE_BLUE,
  /** Rail accents and "present" chips. */
  rail: PERMANENTE_BLUE,
  /** Selected-row / hover tint. */
  wash: 'rgba(0, 120, 179, 0.08)',
  avatarBg: colors.grey[200],
  avatarFg: '#006ea5',
  // Coverage dots carry meaning, so the empty outline clears the 3:1 bar for
  // non-text UI rather than sitting at the palette's decorative grey.
  dotEmpty: colors.grey[600],
  dim: '#6b6b6b',
  selection: 'rgba(0, 120, 179, 0.18)',
} as const;

/**
 * How well an excerpt answers the question. Tuned for legibility at chip size
 * on a light surface rather than taken raw from the palette's fill tones.
 */
export const CONFIDENCE = {
  high: { label: 'Direct', bg: '#e8f5e9', fg: '#2a722e', bd: '#c8e6c9' },
  medium: { label: 'Partial', bg: '#fff8e1', fg: '#9a5b00', bd: '#ffe0b2' },
  low: { label: 'Tangential', bg: colors.grey[100], fg: colors.grey[700], bd: colors.grey[300] },
} as const;

/** Content column shared by every Explore view. */
export const shell = {
  maxWidth: 1240,
  mx: 'auto',
  px: { xs: 3, md: 5 },
} as const;

/** Mono eyebrow — uppercase, tracked, used for every small label in the design. */
export const mono = (size: number, tracking = 0.12) => ({
  fontFamily: 'var(--explore-mono), ui-monospace, monospace',
  fontSize: `${size}px`,
  letterSpacing: `${tracking}em`,
  textTransform: 'uppercase' as const,
});

/** Mono without the uppercase transform — counts, timestamps, chips. */
export const monoPlain = (size: number, tracking = 0) => ({
  fontFamily: 'var(--explore-mono), ui-monospace, monospace',
  fontSize: `${size}px`,
  ...(tracking ? { letterSpacing: `${tracking}em` } : {}),
});

export const serif = (size: number, lineHeight: number, weight: 400 | 600 = 400) => ({
  fontFamily: 'var(--explore-serif), Georgia, serif',
  fontSize: `${size}px`,
  lineHeight,
  fontWeight: weight,
});

/**
 * The system map ("The loops they describe"). Green strengthens, red-orange undermines; both clear
 * 4.5:1 on the card so a selected arrow's colour also reads in its panel tag.
 */
export const loop = {
  strengthens: '#1b7550',
  undermines: '#bf4317',
  strengthensWash: 'rgba(27, 117, 80, 0.09)',
  underminesWash: 'rgba(191, 67, 23, 0.08)',
  /** Arrows no selected narrator made, and factors none of them named. */
  ghost: colors.grey[300],
  /** Halo behind arrows that are part of a contradiction. */
  contradiction: 'rgba(232, 163, 60, 0.45)',
  pillBorder: colors.grey[400],
  pillSelected: 'rgba(0, 120, 179, 0.12)',
  /** Labels of factors outside the selection: legible (3:1+) but clearly receded. */
  dimText: '#8a8a8a',
} as const;

/**
 * Narrator colours: every narrator has their own, fixed by registry order, so a person keeps the same
 * colour in every section whatever is selected. All clear 4.2:1 on white; neighbours in the registry
 * get contrasting hues. 16 leaves room for new narrators before colours repeat.
 */
export const NARRATOR_PALETTE = [
  '#1f5fa8',
  '#c0392b',
  '#2e7d32',
  '#b8651b',
  '#6b46b3',
  '#0a7f9e',
  '#b03a6f',
  '#5d6b1f',
  '#8a4b2a',
  '#3949ab',
  '#0f7a6b',
  '#9c27b0',
  '#546e7a',
  '#827717',
  '#d84315',
  '#00695c',
] as const;
