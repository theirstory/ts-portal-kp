/**
 * Server-side: the evidence bank Explore renders — the reviewed bank shipped with the app, plus the
 * excerpts portal-sync generated for recordings synced since (json/.portal-sync/evidence-additions.json,
 * see scripts/portal-sync/excerpts.ts). Re-read when the portal's data version changes.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import bankData from '@/json/insights/kp_evidence_bank.json';
import { getDataVersion } from '@/lib/data-version';
import type { EvidenceAdditions, EvidenceBank } from '@/types/insights';
import { indexEvidenceBank } from './evidenceBank';
import type { EvidenceIndex } from './evidenceBank';

const reviewed = bankData as EvidenceBank;

type Memo = { version: string; bank: EvidenceBank; index: EvidenceIndex };
const globalMemo = globalThis as typeof globalThis & { __evidenceBank?: Memo };

export function evidenceAdditionsFile(): string {
  return resolve(process.env.PORTAL_SYNC_EVIDENCE_ADDITIONS_FILE || './json/.portal-sync/evidence-additions.json');
}

function readAdditions(): EvidenceAdditions | null {
  try {
    const parsed = JSON.parse(readFileSync(evidenceAdditionsFile(), 'utf-8'));
    return parsed && typeof parsed.interviews === 'object' ? (parsed as EvidenceAdditions) : null;
  } catch {
    // Missing (nothing generated yet, or the directory isn't mounted) or mid-write: reviewed bank only.
    return null;
  }
}

/** The bank without interviews unpublished from the portal (additions.removed). */
function withoutRemoved(base: EvidenceBank, removed: string[]): EvidenceBank {
  const gone = base.interviews.filter((i) => removed.includes(i.interview_id));
  if (gone.length === 0) return base;
  const goneTitles = new Set(gone.map((i) => i.interview_title));
  return {
    ...base,
    interviews: base.interviews.filter((i) => !goneTitles.has(i.interview_title)),
    questions: base.questions.map((q) => ({
      ...q,
      by_interview: Object.fromEntries(Object.entries(q.by_interview).filter(([title]) => !goneTitles.has(title))),
    })),
  };
}

/**
 * Reviewed interviews first (their order is curated), then generated ones by title. Interviews
 * unpublished from the portal are left out of both.
 */
export function mergeEvidence(reviewedBank: EvidenceBank, additions: EvidenceAdditions | null): EvidenceBank {
  const removed = additions?.removed ?? [];
  const base = withoutRemoved(reviewedBank, removed);
  const reviewedIds = new Set(base.interviews.map((i) => i.interview_id));
  const reviewedTitles = new Set(base.interviews.map((i) => i.interview_title));
  const generated = Object.values(additions?.interviews ?? {})
    .filter(
      (g) =>
        !removed.includes(g.interview_id) && !reviewedIds.has(g.interview_id) && !reviewedTitles.has(g.interview_title),
    )
    .sort((a, b) => a.interview_title.localeCompare(b.interview_title));
  if (generated.length === 0) return base;

  return {
    ...base,
    interviews: [
      ...base.interviews,
      ...generated.map((g) => ({
        interview_title: g.interview_title,
        interview_id: g.interview_id,
        source_file: '',
        generated: true,
      })),
    ],
    questions: base.questions.map((q) => {
      const byInterview = { ...q.by_interview };
      for (const g of generated) byInterview[g.interview_title] = g.by_question[String(q.question_id)] ?? [];
      return { ...q, by_interview: byInterview };
    }),
  };
}

function current(): Memo {
  const version = getDataVersion();
  const memo = globalMemo.__evidenceBank;
  if (memo && memo.version === version) return memo;
  const bank = mergeEvidence(reviewed, readAdditions());
  const next = { version, bank, index: indexEvidenceBank(bank) };
  globalMemo.__evidenceBank = next;
  return next;
}

/** The merged bank, for handing to the client (EvidenceProvider). */
export const loadEvidenceBank = (): EvidenceBank => current().bank;

/** The merged bank's selectors, for server components. */
export const loadEvidenceIndex = (): EvidenceIndex => current().index;
