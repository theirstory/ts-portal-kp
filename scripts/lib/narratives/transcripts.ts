/**
 * Shared by the Memory Map pipelines (system map, journeys & canon): the narrator registry, each
 * recording's timed words grouped into paragraphs, and the normalized text the extraction agents read.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { testimonyUuid } from '../testimony-ids';
import { paragraphsFromPayload } from '../../portal-sync/transcript';
import type { Paragraph } from '../../portal-sync/transcript';

export const ROOT = resolve(process.cwd());
/** Narrator registry: recordings, regions, join year, excluded segments. Shared by every section. */
export const NARRATORS_FILE = join(ROOT, 'data/narrators.json');
/** Normalized transcripts for extraction agents (gitignored; `yarn narratives:normalize`). */
export const TRANSCRIPTS_DIR = join(ROOT, 'data/transcripts');
export const INTERVIEWS_DIR = resolve(process.env.INTERVIEWS_DIR ?? join(ROOT, 'json/interviews'));
export const COLLECTION_ID = 'oral-histories';

export type ExcludedSegment = { part: number; start: number; end: number; reason: string };

export type Narrator = {
  slug: string;
  name: string;
  region: string | null;
  era: string | null;
  recordings: { part: number; story_id: string }[];
  excluded_segments: ExcludedSegment[];
};

export type Recording = {
  slug: string;
  part: number;
  storyId: string;
  storyUuid: string;
  title: string;
  /** ISO date the interview was recorded (story.record_date), or '' when missing. */
  recordDate: string;
  paragraphs: Paragraph[];
};

export function loadNarrators(): Narrator[] {
  return JSON.parse(readFileSync(NARRATORS_FILE, 'utf-8')).narrators;
}

export function loadRecording(slug: string, part: number, storyId: string): Recording {
  const file = join(INTERVIEWS_DIR, COLLECTION_ID, `${storyId}.json`);
  const payload = JSON.parse(readFileSync(file, 'utf-8'));
  return {
    slug,
    part,
    storyId,
    storyUuid: testimonyUuid(COLLECTION_ID, storyId),
    title: String(payload?.story?.title ?? ''),
    recordDate: String(payload?.story?.record_date ?? ''),
    paragraphs: paragraphsFromPayload(payload),
  };
}

/** A paragraph's words exactly as quotes must reproduce them: the word texts joined by single spaces. */
export const paragraphText = (p: Paragraph): string => p.words.map((w) => w.text).join(' ');

export const stamp = (seconds: number): string => {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

/** Max words per line in the normalized transcript, so every line carries a nearby timestamp. */
const LINE_WORDS = 45;

/**
 * `[seconds mm:ss] Speaker: text`, one paragraph per block, long paragraphs split into lines that
 * each start with their first word's time. Speaker labels are copied as diarized (often wrong).
 */
export function normalizedTranscript(recording: Recording): string {
  const blocks = recording.paragraphs.map((p) => {
    const lines: string[] = [];
    for (let i = 0; i < p.words.length; i += LINE_WORDS) {
      const words = p.words.slice(i, i + LINE_WORDS);
      const t = words[0].start;
      lines.push(`[${t.toFixed(2)} ${stamp(t)}] ${p.speaker || 'Unknown'}: ${words.map((w) => w.text).join(' ')}`);
    }
    return lines.join('\n');
  });
  return blocks.join('\n\n') + '\n';
}
