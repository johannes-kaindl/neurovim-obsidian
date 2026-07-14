/**
 * Thin streaming client for one OpenAI-compatible /v1/chat/completions call.
 * Transport is injected (Obsidian's requestUrl can't stream; the real transport
 * is XHR-based — see XhrSseTransport). Pure enough to test with a fake transport.
 */
import { parseSSE } from '../vendor/kit/sse';
import { ThinkSplitter } from '../vendor/kit/think';
import { normalizeEndpoint } from '../vendor/kit/endpoint';
import type { LlmMessage } from './cipherPrompt';

export interface SseTransport {
  postStream(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    onChunk: (raw: string) => void,
    signal: AbortSignal,
  ): Promise<number>;
}

export interface CipherConfig { endpoint: string; apiKey: string; model: string }

export type StreamOutcome =
  | { ok: true; content: string }
  | { ok: false; kind: 'aborted' | 'http' | 'network' | 'timeout'; detail: string; partial: string };

const ERROR_BODY_CAP = 2048;
const DEFAULT_TIMEOUT_MS = 120_000;

export class CipherClient {
  constructor(
    private readonly transport: SseTransport,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async stream(
    cfg: CipherConfig,
    messages: LlmMessage[],
    onToken: (t: string) => void,
    signal: AbortSignal,
  ): Promise<StreamOutcome> {
    const url = `${normalizeEndpoint(cfg.endpoint)}/v1/chat/completions`;
    const headers: Record<string, string> = {};
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    const body = { model: cfg.model, messages, stream: true, temperature: 0.7, max_tokens: 1024 };

    // Inner controller: fired by caller abort OR the hard timeout.
    const ctrl = new AbortController();
    let timedOut = false;
    const onCallerAbort = (): void => ctrl.abort();
    signal.addEventListener('abort', onCallerAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, this.timeoutMs);

    const splitter = new ThinkSplitter();
    let content = '';
    let rest = '';
    let rawBody = '';

    const emit = (piece: string): void => {
      const parts = splitter.push(piece);
      if (parts.content !== '') {
        content += parts.content;
        onToken(parts.content);
      }
      // Reasoning (think spans + reasoning_content) is dropped by design.
    };

    let status: number;
    try {
      status = await this.transport.postStream(url, body, headers, (raw) => {
        if (rawBody.length < ERROR_BODY_CAP) rawBody += raw;
        const parsed = parseSSE(rest + raw);
        rest = parsed.rest;
        for (const delta of parsed.content) emit(delta);
      }, ctrl.signal);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('unknown stream error');
      if (err.name === 'AbortError') {
        return timedOut
          ? { ok: false, kind: 'timeout', detail: `no answer within ${this.timeoutMs / 1000}s`, partial: content }
          : { ok: false, kind: 'aborted', detail: 'stream aborted', partial: content };
      }
      return { ok: false, kind: 'network', detail: err.message, partial: content };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onCallerAbort);
    }

    const tail = splitter.flush();
    if (tail.content !== '') { content += tail.content; onToken(tail.content); }

    if (status < 200 || status >= 300) {
      return { ok: false, kind: 'http', detail: `HTTP ${status}: ${rawBody.slice(0, ERROR_BODY_CAP)}`, partial: content };
    }
    return { ok: true, content };
  }
}
