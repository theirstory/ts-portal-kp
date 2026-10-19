/**
 * Colors for excerpt keywords, one per topic family in json/insights/keyword_vocabulary.json, so a
 * keyword's color says at a glance what kind of topic it is. Each pair keeps the text at 4.5:1 or
 * better on its tint; `solid` is the selected fill, under white text.
 */
import vocabulary from '@/json/insights/keyword_vocabulary.json';

export type KeywordColor = { fg: string; bg: string; border: string; solid: string };

const PALETTE: KeywordColor[] = [
  { fg: '#7a4a00', bg: '#fdf1dc', border: '#efd3a0', solid: '#8a5300' }, // amber
  { fg: '#0b4f8a', bg: '#e5f0fb', border: '#b9d4f0', solid: '#0b5aa0' }, // blue
  { fg: '#5b2a91', bg: '#f1e9fb', border: '#d7c3f0', solid: '#6a32a8' }, // purple
  { fg: '#1d6631', bg: '#e6f4e9', border: '#bfe0c7', solid: '#237a3b' }, // green
  { fg: '#005f66', bg: '#dff3f4', border: '#addfe2', solid: '#006c74' }, // teal
  { fg: '#982043', bg: '#fce8ee', border: '#f2c2d0', solid: '#a8244b' }, // rose
  { fg: '#9a3a00', bg: '#ffeadb', border: '#f5c6a5', solid: '#a84000' }, // orange
];

const NEUTRAL: KeywordColor = { fg: '#4a4a4a', bg: '#f2f2f2', border: '#d6d6d6', solid: '#555555' };

type Group = { name: string; keywords: string[] };
const groups: Group[] = (vocabulary as { groups?: Group[] }).groups ?? [];

export const KEYWORD_GROUPS = groups.map((group, i) => ({
  name: group.name,
  color: PALETTE[i % PALETTE.length],
}));

const byKeyword = new Map<string, { group: string; color: KeywordColor }>();
groups.forEach((group, i) =>
  group.keywords.forEach((k) => byKeyword.set(k, { group: group.name, color: PALETTE[i % PALETTE.length] })),
);

export const keywordColor = (keyword: string): KeywordColor => byKeyword.get(keyword)?.color ?? NEUTRAL;

export const keywordGroup = (keyword: string): string | undefined => byKeyword.get(keyword)?.group;
