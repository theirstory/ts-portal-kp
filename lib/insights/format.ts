/**
 * Presentation helpers shared by the Explore views: how an interview is labelled,
 * how a timestamp reads, how a long question is trimmed for a list.
 */

/** Interview title in the evidence bank -> the label shown to a reader. */
const DISPLAY_NAMES: Record<string, string> = {
  'Mary Wilson, MD': 'Mary Wilson, MD',
  'Chris Grant': 'Chris Grant',
  'Dr Ed Ellison - Part 1': 'Ed Ellison, MD · I',
  'Dr Ed Ellison - Part 2': 'Ed Ellison, MD · II',
  'Dr Jay Crosson': 'Jay Crosson, MD',
  'Dr Margaret Ferguson': 'Margaret Ferguson, MD',
  'Dr Oliver Goldsmith': 'Oliver Goldsmith, MD',
  'Dr Stephen Tarnoff': 'Stephen Tarnoff, MD',
};

/**
 * Label for a recording title nobody curated (one portal-sync added): drop the recording boilerplate
 * ("TheirStory Interview With …", "Oral History Recording – Org (…)") and write "Dr X" as "X, MD",
 * matching the curated names above.
 */
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
const PART_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'];

export const cleanTitle = (title: string): string => {
  let name = title.trim();
  const parenthesized = name.match(/\(([^()]+)\)\s*$/);
  if (parenthesized && /oral history|recording/i.test(name)) name = parenthesized[1];
  name = name
    .replace(/^theirstory\s+/i, '')
    .replace(/^(oral history\s+)?(interview|recording)\s+with\s+/i, '')
    .replace(/\s+(for\s+)?theirstory(\s+interview)?$/i, '')
    .replace(/\s+(oral history\s+)?interview$/i, '')
    .trim();
  const part = name.match(/^(.+?)\s*[-–—:]\s*part\s+(\d+|\w+)$/i);
  const partNumber = part ? Number(part[2]) || PART_WORDS.indexOf(part[2].toLowerCase()) : 0;
  if (part && partNumber > 0) name = part[1];
  const doctor = name.match(/^dr\.?\s+(.+)$/i);
  if (doctor && !/,/.test(doctor[1])) name = `${doctor[1]}, MD`;
  // "Mary Wilson MD" -> "Mary Wilson, MD"
  name = name.replace(/([^,])\s+(MD|DO|RN|PhD)$/, '$1, $2');
  if (part && partNumber > 0) name = `${name} · ${ROMAN[partNumber] ?? partNumber}`;
  return name || title;
};

export const displayName = (interviewTitle: string): string =>
  DISPLAY_NAMES[interviewTitle] ?? cleanTitle(interviewTitle);

/** First letters of the first two capitalised words, ignoring any suffix after a comma. */
export const initials = (name: string): string =>
  name
    .replace(/,.*$/, '')
    .split(/\s+/)
    .filter((word) => /^[A-Z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0])
    .join('');

/**
 * mm:ss, rolling over to h:mm:ss past an hour — these interviews run to 2.5
 * hours, where the design's flat mm:ss would read as "153:18".
 */
export const stamp = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
};

/** Trim to a length without cutting mid-word. */
export const shorten = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max).replace(/[\s,;:]+\S*$/, '')}…` : text;

export const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;

/** URL-safe slug for a theme name, used by /explore/[category]. */
export const categorySlug = (category: string): string =>
  category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** "A, B and C" — used for the "not on the record here" line. */
export const joinNames = (names: string[]): string => {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};
