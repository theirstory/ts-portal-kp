/**
 * The LLM enrichment steps of a sync, built from config: entities before the NLP step (so the
 * processor attaches them to the Testimony and its chunks) and Explore excerpts after it.
 */
import type { EvidenceBank } from '@/types/insights';
import type { PortalSyncConfig } from './config';
import { extractExcerpts, loadBaseBank, removeExcerpts } from './excerpts';
import { createLlm } from './llm';
import type { Llm } from './llm';
import { extractEntities } from './llm-ner';
import type { TimedEntity } from './llm-ner';
import { log } from './log';
import { paragraphsFromPayload } from './transcript';

export type Enricher = {
  /** Entities for the story; undefined means "let the NLP processor decide" (GLiNER or none). */
  entities?(storyId: string, payload: any): Promise<TimedEntity[]>;
  excerpts?(storyId: string, payload: any): Promise<void>;
  /** The story is gone: drop anything generated for it. */
  forget(storyId: string): Promise<void>;
};

export async function createEnricher(config: PortalSyncConfig): Promise<Enricher> {
  const wantsLlm = config.nerMode === 'llm' || config.excerpts;
  let bank: EvidenceBank | null = null;
  if (config.excerpts) {
    bank = await loadBaseBank(config.evidenceBankFile);
    if (!bank) log.warn(`No evidence bank at ${config.evidenceBankFile}; Explore excerpts are off`);
  }

  // Resolved lazily so a portal with sync off (or nothing to sync) never needs an API key,
  // but a sync that needs the LLM fails its items loudly when none is configured.
  let llm: Llm | null = null;
  const getLlm = () => (llm ??= createLlm());
  if (wantsLlm) {
    try {
      log.info(`LLM enrichment via ${getLlm().id} (ner=${config.nerMode}, excerpts=${bank ? 'on' : 'off'})`);
    } catch (error) {
      log.warn(`LLM enrichment is configured but unavailable: ${(error as Error).message}`);
    }
  }

  return {
    entities:
      config.nerMode === 'llm'
        ? (storyId, payload) => extractEntities(getLlm(), storyId, paragraphsFromPayload(payload), config.llmCacheDir)
        : undefined,
    excerpts: bank
      ? async (storyId, payload) => {
          const title = String(payload?.story?.title ?? '').trim();
          if (!title) throw new Error('story has no title; Explore needs one to list the interview');
          await extractExcerpts({
            llm: getLlm(),
            storyId,
            title,
            paragraphs: paragraphsFromPayload(payload),
            bank: bank!,
            additionsFile: config.evidenceAdditionsFile,
          });
        }
      : undefined,
    async forget(storyId) {
      if (await removeExcerpts(config.evidenceAdditionsFile, storyId)) {
        log.info(`${storyId}: removed its generated Explore excerpts`);
      }
    },
  };
}
