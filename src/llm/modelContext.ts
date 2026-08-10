/** Best-effort context-length probe for the selected model: LM Studio first, Ollama as a
 *  fallback. Purely informational — never throws, and a null result simply means "this
 *  endpoint doesn't report it" (many OpenAI-compatible servers don't).
 *  Probe order mirrors vault-crews' local-llm-client. */
import { requestUrl } from 'obsidian';
import { normalizeEndpoint } from '../vendor/kit/endpoint';
import { authHeaders, type EndpointConfig } from '../vendor/kit/endpoint_config';
import { parseLmStudioContext, parseOllamaContext } from '../vendor/kit/model-context';
import { withTimeout } from '../vendor/kit/timeout';
import { realClock, type ClockPort } from '../vendor/kit-obsidian/clock';

const PROBE_TIMEOUT_MS = 5_000;

function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

/** Max usable context of `model` in tokens, or null if the endpoint can't tell us. */
export async function probeModelContext(
  cfg: EndpointConfig,
  model: string,
  clock: ClockPort = realClock,
): Promise<number | null> {
  const base = normalizeEndpoint(cfg.url);
  const headers = authHeaders(cfg.apiKey);

  try {
    const lm = await withTimeout(
      requestUrl({ url: `${base}/api/v0/models`, method: 'GET', headers, throw: false }),
      PROBE_TIMEOUT_MS,
      clock,
    );
    if (!lm.timedOut && lm.value.status >= 200 && lm.value.status < 300) {
      const ctx = parseLmStudioContext(parseJson(lm.value.text), model);
      if (ctx) return ctx.loadedContextLength ?? ctx.maxContextLength ?? null;
    }
  } catch { /* fall through to Ollama */ }

  try {
    const oll = await withTimeout(
      requestUrl({
        url: `${base}/api/show`,
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
        throw: false,
      }),
      PROBE_TIMEOUT_MS,
      clock,
    );
    if (!oll.timedOut && oll.value.status >= 200 && oll.value.status < 300) {
      const ctx = parseOllamaContext(parseJson(oll.value.text));
      if (ctx) return ctx.maxContextLength ?? null;
    }
  } catch { /* nothing reports a context length */ }

  return null;
}
