/**
 * JSON completions from the LLM the portal is configured with (config.json features.chat plus its
 * API key — the same provider /discover uses), for the enrichment steps portal-sync runs per story.
 */
import { createChatProvider, getChatProviderSettings } from '@/lib/ai/chatProvider';
import type { ChatProvider, ChatProviderSettings } from '@/lib/ai/chatProvider';
import { formatError, log } from './log';

export type Llm = {
  /** "provider/model", recorded next to what it produced. */
  readonly id: string;
  json<T>(input: { system: string; prompt: string; maxTokens: number; label: string }): Promise<T>;
};

const ATTEMPTS = 3;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The first top-level JSON object in a reply, tolerating ```json fences and prose around it. */
export function parseJsonReply(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('reply contained no JSON object');
  return JSON.parse(body.slice(start, end + 1));
}

/** Throws (with the reason) when no provider is configured, so a sync fails loudly instead of skipping NER. */
export function createLlm(): Llm {
  const settings: ChatProviderSettings = getChatProviderSettings();
  const provider: ChatProvider = createChatProvider(settings);
  const id = `${settings.provider}/${settings.model}`;

  return {
    id,
    async json<T>({
      system,
      prompt,
      maxTokens,
      label,
    }: {
      system: string;
      prompt: string;
      maxTokens: number;
      label: string;
    }) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        try {
          let text = '';
          for await (const delta of provider.streamText({
            model: settings.model,
            systemPrompt: system,
            messages: [{ role: 'user', content: prompt }],
            maxTokens,
          })) {
            text += delta;
          }
          return parseJsonReply(text) as T;
        } catch (error) {
          lastError = error;
          if (attempt < ATTEMPTS) {
            log.warn(`  [llm ${label}] attempt ${attempt} failed (${formatError(error)}); retrying`);
            await sleep(2000 * attempt);
          }
        }
      }
      throw new Error(`LLM ${id} failed for ${label}: ${formatError(lastError)}`);
    },
  };
}

/** Run `fn` over `items` with at most `limit` in flight, preserving order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
