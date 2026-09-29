import { dirname, join, resolve } from 'node:path';

export type PortalSyncConfig = {
  /** False when PORTAL_PUBLISHER_URL / PORTAL_SYNC_TOKEN are missing: the service idles. */
  enabled: boolean;
  disabledReason: string;
  publisherUrl: string;
  token: string;
  intervalMinutes: number;
  port: number;
  postProcessCommand: string;
  postProcessTimeoutMs: number;
  interviewsDir: string;
  stateFile: string;
  lockFile: string;
  /** Inventory bookkeeping, next to the state file. */
  inventoryFile: string;
  /** Read by the frontend (lib/data-version.ts); same env var on both sides. */
  dataVersionFile: string;
  weaviateUrl: string;
  weaviateApiKey: string;
  nlpUrl: string;
  nlpTimeoutMs: number;
  /** Who finds entities: the portal's configured LLM (default), the NLP processor's GLiNER, or nobody. */
  nerMode: NerMode;
  /** Find Explore excerpts for new recordings with the configured LLM. */
  excerpts: boolean;
  /** The reviewed evidence bank: its questions are what excerpts are matched against. */
  evidenceBankFile: string;
  /** Generated excerpts, read by the frontend (lib/insights/loadEvidenceBank.ts); same env var on both sides. */
  evidenceAdditionsFile: string;
  /** Per-story LLM results, so a retry or a metadata-only change doesn't pay for the same calls again. */
  llmCacheDir: string;
  portalVersion: string;
};

export type NerMode = 'llm' | 'gliner' | 'off';

function nerModeEnv(): NerMode {
  const raw = (process.env.PORTAL_SYNC_NER ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'llm') return 'llm';
  if (raw === 'gliner' || raw === 'off') return raw;
  throw new Error(`PORTAL_SYNC_NER must be llm, gliner or off (got "${raw}")`);
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  if (raw === '') return fallback;
  if (['1', 'true', 'on', 'yes'].includes(raw)) return true;
  if (['0', 'false', 'off', 'no'].includes(raw)) return false;
  throw new Error(`${name} must be on or off (got "${raw}")`);
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number (got "${raw}")`);
  }
  return value;
}

function buildWeaviateUrl(): string {
  const host = process.env.WEAVIATE_HOST_URL ?? 'weaviate';
  const port = process.env.WEAVIATE_PORT ?? '8080';
  const secure = process.env.WEAVIATE_SECURE === 'true';
  // WEAVIATE_HOST_URL is sometimes given with a scheme (cloud / local docs); respect it.
  if (/^https?:\/\//.test(host)) return host.replace(/\/+$/, '');
  return `${secure ? 'https' : 'http'}://${host}:${port}`;
}

function buildNlpUrl(): string {
  const host = process.env.NLP_HOST ?? 'nlp-processor';
  const port = process.env.NLP_PORT ?? '7070';
  const secure = process.env.NLP_SECURE === 'true';
  return `${secure ? 'https' : 'http'}://${host}:${port}`;
}

export function loadConfig(portalVersion: string): PortalSyncConfig {
  const publisherUrl = (process.env.PORTAL_PUBLISHER_URL ?? '').trim().replace(/\/+$/, '');
  const token = (process.env.PORTAL_SYNC_TOKEN ?? '').trim();

  const missing = [!publisherUrl && 'PORTAL_PUBLISHER_URL', !token && 'PORTAL_SYNC_TOKEN'].filter(Boolean);
  const stateFile = resolve(process.env.PORTAL_SYNC_STATE_FILE ?? './json/.portal-sync/state.json');

  return {
    enabled: missing.length === 0,
    disabledReason: missing.length ? `${missing.join(' and ')} not set` : '',
    publisherUrl,
    token,
    intervalMinutes: intEnv('PORTAL_SYNC_INTERVAL_MINUTES', 15),
    port: intEnv('PORTAL_SYNC_PORT', 7171),
    postProcessCommand: (process.env.PORTAL_SYNC_POST_PROCESS_COMMAND ?? '').trim(),
    postProcessTimeoutMs: intEnv('PORTAL_SYNC_POST_PROCESS_TIMEOUT_MINUTES', 60) * 60_000,
    interviewsDir: resolve(process.env.INTERVIEWS_DIR ?? './json/interviews'),
    stateFile,
    lockFile: `${stateFile}.lock`,
    inventoryFile: join(dirname(stateFile), 'inventory.json'),
    dataVersionFile: resolve(process.env.PORTAL_SYNC_DATA_VERSION_FILE ?? './json/.portal-sync/data-version.json'),
    weaviateUrl: buildWeaviateUrl(),
    weaviateApiKey: (process.env.WEAVIATE_ADMIN_KEY ?? '').trim(),
    nlpUrl: buildNlpUrl(),
    nlpTimeoutMs: intEnv('PORTAL_SYNC_NLP_TIMEOUT_MINUTES', 30) * 60_000,
    nerMode: nerModeEnv(),
    excerpts: boolEnv('PORTAL_SYNC_EXCERPTS', true),
    evidenceBankFile: resolve(process.env.EVIDENCE_BANK_FILE ?? './json/insights/kp_evidence_bank.json'),
    evidenceAdditionsFile: resolve(
      process.env.PORTAL_SYNC_EVIDENCE_ADDITIONS_FILE ?? './json/.portal-sync/evidence-additions.json',
    ),
    llmCacheDir: join(dirname(stateFile), 'llm-cache'),
    portalVersion: (process.env.PORTAL_VERSION ?? '').trim() || portalVersion,
  };
}
