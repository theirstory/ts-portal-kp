/**
 * Named-entity recognition with the portal's configured LLM, replacing GLiNER for synced stories.
 *
 * The transcript is read in windows of paragraphs. For each window the LLM names the distinct
 * entities it sees (surface form + label + the paragraphs they occur in); every occurrence is then
 * found in those paragraphs' word timings, so each entity carries the start/end time the story page,
 * progress bar and chunk filters use. Results are cached per transcript + model + label set.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config as orgConfig } from '@/config/organizationConfig';
import type { Llm } from './llm';
import { mapLimit } from './llm';
import { log } from './log';
import { writeFileAtomic } from './state';
import { findAll, paragraphText, renderParagraph, tokenize, transcriptHash } from './transcript';
import type { Paragraph } from './transcript';

export type TimedEntity = { text: string; label: string; start_time: number; end_time: number };

type LlmEntity = { text?: unknown; label?: unknown; paragraphs?: unknown };

const WINDOW_WORDS = 2500;
const CONCURRENCY = 3;
const PROMPT_VERSION = 'ner-v1';

const SYSTEM = `You extract named entities from oral-history interview transcripts for a searchable archive.
Return only JSON. Copy each entity's text exactly as it is written in the transcript (same words, same spelling), so it can be found again by string matching.`;

function labelGuide(): { ids: Set<string>; text: string } {
  const labels = orgConfig.ner?.labels ?? [];
  return {
    ids: new Set(labels.map((l) => l.id)),
    text: labels.map((l) => `- ${l.id}: ${l.displayName}`).join('\n'),
  };
}

function windows(paragraphs: Paragraph[]): Paragraph[][] {
  const out: Paragraph[][] = [];
  let current: Paragraph[] = [];
  let count = 0;
  for (const p of paragraphs) {
    if (current.length && count + p.words.length > WINDOW_WORDS) {
      out.push(current);
      current = [];
      count = 0;
    }
    current.push(p);
    count += p.words.length;
  }
  if (current.length) out.push(current);
  return out;
}

function prompt(window: Paragraph[], guide: string): string {
  return `Labels (use the id):
${guide}

Transcript excerpt. Each paragraph starts with its [number], a timestamp and the speaker:

${window.map(renderParagraph).join('\n\n')}

List every distinct named entity mentioned in this excerpt that fits one of the labels: specific people, organizations, places, dates and periods, events, publications, awards, languages, illnesses and conditions, medical terms, leadership concepts or roles, and technologies. Skip generic words ("the hospital", "my father") unless they are a proper name, and skip filler.

Reply with JSON only:
{"entities": [{"text": "<exact text as it appears>", "label": "<label id>", "paragraphs": [<paragraph numbers where it appears>]}]}`;
}

/** Every timed occurrence of the LLM's entities within the paragraphs it named. */
function place(window: Paragraph[], found: LlmEntity[], labelIds: Set<string>): TimedEntity[] {
  const byIndex = new Map(window.map((p) => [p.index, p]));
  const out: TimedEntity[] = [];
  for (const entity of found) {
    const text = typeof entity.text === 'string' ? entity.text.trim() : '';
    const label = typeof entity.label === 'string' ? entity.label.trim() : '';
    if (!text || !labelIds.has(label)) continue;
    const needle = tokenize(text);
    if (needle.length === 0) continue;

    const listed = Array.isArray(entity.paragraphs) ? entity.paragraphs.map(Number).filter((n) => byIndex.has(n)) : [];
    const scope = listed.length ? listed.map((n) => byIndex.get(n)!) : window;
    for (const paragraph of scope) {
      for (const [from, to] of findAll(paragraph.words, needle)) {
        out.push({
          text: paragraph.words
            .slice(from, to + 1)
            .map((w) => w.text)
            .join(' ')
            .replace(/[.,;:!?]+$/, ''),
          label,
          start_time: paragraph.words[from].start,
          end_time: paragraph.words[to].end,
        });
      }
    }
  }
  return out;
}

function dedupe(entities: TimedEntity[]): TimedEntity[] {
  const seen = new Set<string>();
  return entities
    .sort((a, b) => a.start_time - b.start_time || b.end_time - a.end_time)
    .filter((e) => {
      const key = `${e.label}|${e.start_time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function extractEntities(
  llm: Llm,
  storyId: string,
  paragraphs: Paragraph[],
  cacheDir: string,
): Promise<TimedEntity[]> {
  const guide = labelGuide();
  if (guide.ids.size === 0) throw new Error('config.json ner.labels is empty; nothing to extract');

  const key = transcriptHash(paragraphs, `${PROMPT_VERSION}|${llm.id}|${[...guide.ids].join(',')}`);
  const cacheFile = join(cacheDir, `ner-${storyId}.json`);
  try {
    const cached = JSON.parse(await readFile(cacheFile, 'utf-8'));
    if (cached?.key === key && Array.isArray(cached.entities)) {
      log.info(`${storyId}: LLM NER cached (${cached.entities.length} entities)`);
      return cached.entities;
    }
  } catch {
    // no cache yet
  }

  const spoken = paragraphs.filter((p) => paragraphText(p).trim());
  const parts = windows(spoken);
  log.info(`${storyId}: LLM NER with ${llm.id} over ${parts.length} window(s)`);

  const results = await mapLimit(parts, CONCURRENCY, async (window, i) => {
    const reply = await llm.json<{ entities?: LlmEntity[] }>({
      system: SYSTEM,
      prompt: prompt(window, guide.text),
      maxTokens: 8000,
      label: `${storyId} ner ${i + 1}/${parts.length}`,
    });
    if (!Array.isArray(reply?.entities)) throw new Error(`NER window ${i + 1}: reply had no "entities" array`);
    return place(window, reply.entities, guide.ids);
  });

  const entities = dedupe(results.flat());
  log.info(`${storyId}: LLM NER found ${entities.length} entity mention(s)`);
  await mkdir(cacheDir, { recursive: true });
  await writeFileAtomic(cacheFile, `${JSON.stringify({ key, model: llm.id, entities })}\n`);
  return entities;
}
