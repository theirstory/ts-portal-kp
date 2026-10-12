/**
 * Write each recording's normalized, timestamped transcript for the extraction agents:
 *   data/transcripts/{slug}-{part}.txt   (gitignored; derived from json/interviews)
 *
 *   yarn narratives:normalize
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadNarrators, loadRecording, normalizedTranscript, TRANSCRIPTS_DIR } from './transcripts';

const outDir = TRANSCRIPTS_DIR;
mkdirSync(outDir, { recursive: true });

for (const narrator of loadNarrators()) {
  for (const { part, story_id } of narrator.recordings) {
    const recording = loadRecording(narrator.slug, part, story_id);
    const file = join(outDir, `${narrator.slug}-${part}.txt`);
    const recorded = recording.recordDate ? recording.recordDate.slice(0, 10) : 'unknown';
    const header = `# ${narrator.name} — part ${part} — "${recording.title}" (story ${story_id}) — recorded ${recorded}\n\n`;
    writeFileSync(file, header + normalizedTranscript(recording));
    const words = recording.paragraphs.reduce((n, p) => n + p.words.length, 0);
    console.log(`${narrator.slug}-${part}: ${recording.paragraphs.length} paragraphs, ${words} words -> ${file}`);
  }
}
