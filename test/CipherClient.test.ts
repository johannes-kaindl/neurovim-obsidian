import { describe, it, expect } from 'vitest';
import { CipherClient, type SseTransport } from '../src/llm/CipherClient';
import type { ClockPort } from '../src/llm/clock';

const CFG = { endpoint: 'http://localhost:1234/v1/', apiKey: '', model: 'test-model', suppressThinking: false };
const MSGS = [{ role: 'user' as const, content: 'q' }];

/** Node's own timers — CipherClient's default clock uses `window`, which
 *  doesn't exist in this Vitest node environment. */
const fakeClock: ClockPort = {
  setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id as unknown as NodeJS.Timeout),
};

/** Fake transport: replays fixture chunks, records url/body/headers. */
function fakeTransport(chunks: string[], status = 200): SseTransport & { calls: { url: string; body: unknown; headers: Record<string, string> }[] } {
  const t = {
    calls: [] as { url: string; body: unknown; headers: Record<string, string> }[],
    postStream(url: string, body: unknown, headers: Record<string, string>, onChunk: (raw: string) => void, _signal: AbortSignal): Promise<number> {
      t.calls.push({ url, body, headers });
      for (const c of chunks) onChunk(c);
      return Promise.resolve(status);
    },
  };
  return t;
}

const sse = (content: string): string => `data: {"choices":[{"delta":{"content":${JSON.stringify(content)}}}]}\n`;

describe('CipherClient.stream', () => {
  it('happy path: accumulates deltas, emits tokens, normalizes the endpoint url', async () => {
    const t = fakeTransport([sse('Hel'), sse('lo'), 'data: [DONE]\n']);
    const tokens: string[] = [];
    const r = await new CipherClient(t, undefined, fakeClock).stream(CFG, MSGS, (tok) => tokens.push(tok), new AbortController().signal);
    expect(r).toEqual({ ok: true, content: 'Hello' });
    expect(tokens.join('')).toBe('Hello');
    expect(t.calls[0].url).toBe('http://localhost:1234/v1/chat/completions');
    const body = t.calls[0].body as Record<string, unknown>;
    expect(body.model).toBe('test-model');
    expect(body.stream).toBe(true);
  });

  it('handles SSE lines split across chunk boundaries (rest carry-over)', async () => {
    const line = sse('Hello');
    const t = fakeTransport([line.slice(0, 20), line.slice(20), 'data: [DONE]\n']);
    const r = await new CipherClient(t, undefined, fakeClock).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(r).toEqual({ ok: true, content: 'Hello' });
  });

  it('suppresses <think> spans from content and tokens', async () => {
    const t = fakeTransport([sse('<think>secret plan</think>'), sse('visible'), 'data: [DONE]\n']);
    const tokens: string[] = [];
    const r = await new CipherClient(t, undefined, fakeClock).stream(CFG, MSGS, (tok) => tokens.push(tok), new AbortController().signal);
    expect(r).toEqual({ ok: true, content: 'visible' });
    expect(tokens.join('')).toBe('visible');
  });

  it('sends an Authorization header only when an api key is set', async () => {
    const t1 = fakeTransport(['data: [DONE]\n']);
    await new CipherClient(t1, undefined, fakeClock).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(t1.calls[0].headers.Authorization).toBeUndefined();
    const t2 = fakeTransport(['data: [DONE]\n']);
    await new CipherClient(t2, undefined, fakeClock).stream({ ...CFG, apiKey: 'sk-x' }, MSGS, () => undefined, new AbortController().signal);
    expect(t2.calls[0].headers.Authorization).toBe('Bearer sk-x');
  });

  it('non-2xx status → { ok: false, kind: "http" } with body excerpt as detail', async () => {
    const t = fakeTransport(['{"error":{"message":"model not found"}}'], 404);
    const r = await new CipherClient(t, undefined, fakeClock).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('http');
      expect(r.detail).toContain('404');
      expect(r.detail).toContain('model not found');
    }
  });

  it('transport rejection with AbortError → kind "aborted", keeps partial content', async () => {
    const t: SseTransport = {
      postStream(_u, _b, _h, onChunk, _s): Promise<number> {
        onChunk(sse('par'));
        const e = new Error('Aborted');
        e.name = 'AbortError';
        return Promise.reject(e);
      },
    };
    const r = await new CipherClient(t, undefined, fakeClock).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('aborted');
      expect(r.partial).toBe('par');
    }
  });

  it('other transport rejection → kind "network"', async () => {
    const t: SseTransport = {
      postStream(): Promise<number> {
        const e = new Error('ECONNREFUSED');
        e.name = 'StreamNetworkError';
        return Promise.reject(e);
      },
    };
    const r = await new CipherClient(t, undefined, fakeClock).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('network');
  });

  it('garbage chunks without valid SSE data yield ok with empty content', async () => {
    const t = fakeTransport(['not sse at all\n', 'data: {broken json\n']);
    const r = await new CipherClient(t, undefined, fakeClock).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(r).toEqual({ ok: true, content: '' });
  });

  it('pre-aborted caller signal → returns aborted immediately, never calls the transport', async () => {
    const t = fakeTransport(['data: [DONE]\n']);
    const controller = new AbortController();
    controller.abort();
    const r = await new CipherClient(t, undefined, fakeClock).stream(CFG, MSGS, () => undefined, controller.signal);
    expect(r).toEqual({ ok: false, kind: 'aborted', detail: 'stream aborted', partial: '' });
    expect(t.calls.length).toBe(0);
  });

  it('drains the splitter tail on an error path so partial content is not dropped', async () => {
    // "<th" is a plausible prefix of "<think>" in Vim-syntax-heavy content; it must
    // survive into `partial` via splitter.flush() even though the stream then errors.
    const t: SseTransport = {
      postStream(_u, _b, _h, onChunk, _s): Promise<number> {
        onChunk(sse('leading <th'));
        const e = new Error('Aborted');
        e.name = 'AbortError';
        return Promise.reject(e);
      },
    };
    const r = await new CipherClient(t, undefined, fakeClock).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('aborted');
      expect(r.partial.endsWith('<th')).toBe(true);
    }
  });

  it('timeout: transport never resolves but honors signal abort → kind "timeout"', async () => {
    const t: SseTransport = {
      postStream(_u, _b, _h, _onChunk, signal): Promise<number> {
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const e = new Error('Aborted');
            e.name = 'AbortError';
            reject(e);
          });
        });
      },
    };
    const r = await new CipherClient(t, 10, fakeClock).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('timeout');
      expect(r.detail).toContain('0.01s'); // timeoutMs=10 → 10/1000 = 0.01s
    }
  });

  it('caller abort() after first token forwards to the inner controller → kind "aborted"', async () => {
    const controller = new AbortController();
    const t: SseTransport = {
      postStream(_u, _b, _h, onChunk, signal): Promise<number> {
        // Register the abort listener *before* emitting the token — onToken below
        // calls controller.abort() synchronously, which must be observed by this
        // listener (it dispatches ctrl.signal's 'abort' event synchronously too).
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const e = new Error('Aborted');
            e.name = 'AbortError';
            reject(e);
          });
          onChunk(sse('par'));
        });
      },
    };
    const r = await new CipherClient(t, undefined, fakeClock).stream(CFG, MSGS, () => controller.abort(), controller.signal);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('aborted');
      expect(r.partial).toBe('par');
    }
  });
});

describe('CipherClient thinking suppression', () => {
  it('sends suppress params when asked', async () => {
    const t = fakeTransport(['data: [DONE]\n']);
    await new CipherClient(t, undefined, fakeClock).stream(
      { ...CFG, model: 'qwen3-8b', suppressThinking: true },
      MSGS,
      () => undefined,
      new AbortController().signal,
    );
    const sent = t.calls[0].body as Record<string, unknown>;
    expect(sent.reasoning_effort).toBe('none');
    expect(sent.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it('sends no suppress params when thinking is allowed', async () => {
    const t = fakeTransport(['data: [DONE]\n']);
    await new CipherClient(t, undefined, fakeClock).stream(
      { ...CFG, model: 'qwen3-8b', suppressThinking: false },
      MSGS,
      () => undefined,
      new AbortController().signal,
    );
    const sent = t.calls[0].body as Record<string, unknown>;
    expect(sent.reasoning_effort).toBeUndefined();
  });

  it('never suppresses an always-on thinker even when asked', async () => {
    const t = fakeTransport(['data: [DONE]\n']);
    await new CipherClient(t, undefined, fakeClock).stream(
      { ...CFG, model: 'gpt-oss-20b', suppressThinking: true },
      MSGS,
      () => undefined,
      new AbortController().signal,
    );
    const sent = t.calls[0].body as Record<string, unknown>;
    expect(sent.reasoning_effort).toBeUndefined();
  });
});
