/**
 * Best-effort context-length probe for the selected model: LM Studio first, Ollama as a
 * fallback. Purely informational — never throws, and a null result simply means "this
 * endpoint doesn't report it" (many OpenAI-compatible servers don't).
 * Probe order mirrors vault-crews' local-llm-client.
 */
import { requestUrl } from 'obsidian';
import { normalizeEndpoint } from '../vendor/kit/endpoint';
import { parseLmStudioContext, parseOllamaContext } from '../vendor/kit/model-context';

const PROBE_TIMEOUT_MS = 5_000;

function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

/** Max usable context of `model` in tokens, or null if the endpoint can't tell us. */
export async function probeModelContext(endpoint: string, apiKey: string, model: string): Promise<number | null> {
  const base = normalizeEndpoint(endpoint);
  const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const timeout = new Promise<'timeout'>((res) => window.setTimeout(() => res('timeout'), PROBE_TIMEOUT_MS));

  try {
    const lm = await Promise.race([
      requestUrl({ url: `${base}/api/v0/models`, method: 'GET', headers, throw: false }),
      timeout,
    ]);
    if (lm !== 'timeout' && lm.status >= 200 && lm.status < 300) {
      const ctx = parseLmStudioContext(parseJson(lm.text), model);
      if (ctx) return ctx.loadedContextLength ?? ctx.maxContextLength ?? null;
    }
  } catch { /* fall through to Ollama */ }

  try {
    const oll = await Promise.race([
      requestUrl({
        url: `${base}/api/show`,
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
        throw: false,
      }),
      timeout,
    ]);
    if (oll !== 'timeout' && oll.status >= 200 && oll.status < 300) {
      const ctx = parseOllamaContext(parseJson(oll.text));
      if (ctx) return ctx.maxContextLength ?? null;
    }
  } catch { /* nothing reports a context length */ }

  return null;
}
