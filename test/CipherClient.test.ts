import { describe, it, expect } from 'vitest';
import { createChatClient, type SseTransport } from '../src/vendor/kit-obsidian/chat-client';
import { CipherClient } from '../src/llm/CipherClient';
import type { ClockPort } from '../src/vendor/kit-obsidian/clock';

/* Was der Kit-Client selbst kann (Abbruch, Fristen, Fehlerkoerper, Fallback ohne Stream) ist im
   Kit abgedeckt (MIGRATION 0.42.0, Punkt 5). Hier steht, was DIESES Plugin daraus macht: die
   Parameter unveraendert auf den Draht, den Client je Endpunkt und die Form des Ergebnisses samt
   Antwort-Fakten fuer die Pruefung. Welche Parameter es sind, entscheidet `buildCipherParams`
   (request-golden.test.ts). */

const CFG = { endpoint: { url: 'http://localhost:1234/v1/', apiKey: '' }, sentModel: 'test-model', params: { temperature: 0.7, max_tokens: 1024 } };
const MSGS = [{ role: 'user' as const, content: 'q' }];

/** Node's own timers — the kit's default clock uses `window`, which doesn't exist in this
 *  Vitest node environment. */
const fakeClock: ClockPort = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id as unknown as NodeJS.Timeout),
};

type Call = { url: string; body: Record<string, unknown>; headers: Record<string, string> };

/** Fake transport: replays fixture chunks, records url/body/headers. */
function fakeTransport(chunks: string[], status = 200): SseTransport & { calls: Call[] } {
  const t = {
    calls: [] as Call[],
    postStream(url: string, body: unknown, headers: Record<string, string>, onChunk: (raw: string) => void): Promise<number> {
      t.calls.push({ url, body: body as Record<string, unknown>, headers });
      for (const c of chunks) onChunk(c);
      return Promise.resolve(status);
    },
  };
  return t;
}

const clientOver = (t: SseTransport, idleTimeoutMs?: number): CipherClient =>
  new CipherClient(() => createChatClient({ transport: t, clock: fakeClock, ...(idleTimeoutMs !== undefined ? { idleTimeoutMs } : {}) }));

const sse = (content: string): string => `data: {"choices":[{"delta":{"content":${JSON.stringify(content)}}}]}\n`;
const sseReasoning = (r: string): string => `data: {"choices":[{"delta":{"reasoning_content":${JSON.stringify(r)}}}]}\n`;
const run = (c: CipherClient, cfg = CFG, tokens: string[] = [], signal = new AbortController().signal) =>
  c.stream(cfg, MSGS, (tok) => tokens.push(tok), signal);

describe('CipherClient.stream', () => {
  it('happy path: accumulates deltas, emits tokens, normalizes the endpoint url', async () => {
    const t = fakeTransport([sse('Hel'), sse('lo'), 'data: [DONE]\n']);
    const tokens: string[] = [];
    const r = await run(clientOver(t), CFG, tokens);
    expect(r).toMatchObject({ ok: true, content: 'Hello' });
    expect(tokens.join('')).toBe('Hello');
    expect(t.calls[0].url).toBe('http://localhost:1234/v1/chat/completions');
    expect(t.calls[0].body.model).toBe('test-model');
    expect(t.calls[0].body.stream).toBe(true);
  });

  it('puts the resolved params flat into the request body, unchanged', async () => {
    const t = fakeTransport(['data: [DONE]\n']);
    await run(clientOver(t), { ...CFG, params: { temperature: 0.2, top_k: 20, reasoning_effort: 'none' } });
    expect(t.calls[0].body).toMatchObject({ model: 'test-model', temperature: 0.2, top_k: 20, reasoning_effort: 'none' });
  });

  it('suppresses <think> spans and never shows reasoning', async () => {
    const t = fakeTransport([sseReasoning('deliberate'), sse('<think>secret plan</think>'), sse('visible'), 'data: [DONE]\n']);
    const tokens: string[] = [];
    const r = await run(clientOver(t), CFG, tokens);
    expect(r).toMatchObject({ ok: true, content: 'visible' });
    expect(tokens.join('')).toBe('visible');
  });

  it('sends an Authorization header only when an api key is set', async () => {
    const t1 = fakeTransport(['data: [DONE]\n']);
    await run(clientOver(t1));
    expect(t1.calls[0].headers.Authorization).toBeUndefined();
    const t2 = fakeTransport(['data: [DONE]\n']);
    await run(clientOver(t2), { ...CFG, endpoint: { ...CFG.endpoint, apiKey: 'sk-x' } });
    expect(t2.calls[0].headers.Authorization).toBe('Bearer sk-x');
  });

  it('non-2xx status → { ok: false, kind: "http" } with the SERVER MESSAGE as detail', async () => {
    const t = fakeTransport(['{"error":{"message":"model not found"}}'], 404);
    const r = await run(clientOver(t));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('http');
      expect(r.detail).toContain('model not found');
    }
  });

  it('AbortError → kind "aborted", keeps partial content', async () => {
    const t: SseTransport = {
      postStream(_u, _b, _h, onChunk): Promise<number> {
        onChunk(sse('par'));
        const e = new Error('Aborted');
        e.name = 'AbortError';
        return Promise.reject(e);
      },
    };
    const r = await run(clientOver(t));
    expect(r).toMatchObject({ ok: false, kind: 'aborted', partial: 'par' });
  });

  it('other transport rejection → kind "network"', async () => {
    const t: SseTransport = { postStream: () => Promise.reject(new Error('ECONNREFUSED')) };
    const r = await run(clientOver(t));
    expect(r).toMatchObject({ ok: false, kind: 'network' });
  });

  it('pre-aborted caller signal → aborted, transport never called', async () => {
    const t = fakeTransport(['data: [DONE]\n']);
    const controller = new AbortController();
    controller.abort();
    const r = await run(clientOver(t), CFG, [], controller.signal);
    expect(r).toMatchObject({ ok: false, kind: 'aborted', partial: '' });
    expect(t.calls.length).toBe(0);
  });

  it('a silent server ends with kind "timeout" after the idle timeout', async () => {
    const t: SseTransport = {
      postStream(_u, _b, _h, _c, signal): Promise<number> {
        return new Promise((_res, reject) => {
          signal.addEventListener('abort', () => { const e = new Error('Aborted'); e.name = 'AbortError'; reject(e); });
        });
      },
    };
    const r = await run(clientOver(t, 20));
    expect(r).toMatchObject({ ok: false, kind: 'timeout' });
  });

  it('a healthy stream longer than the idle timeout does not time out', async () => {
    const t: SseTransport = {
      async postStream(_u, _b, _h, onChunk): Promise<number> {
        for (const p of ['a', 'b', 'c', 'd']) { onChunk(sse(p)); await new Promise((r) => setTimeout(r, 30)); }
        return 200;
      },
    };
    const r = await run(clientOver(t, 80));
    expect(r).toMatchObject({ ok: true, content: 'abcd' });
  });

  it('text cut off at the token limit is still delivered (valid answer)', async () => {
    const finish = 'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n';
    const r = await run(clientOver(fakeTransport([sse('cut'), finish, 'data: [DONE]\n'])));
    expect(r).toMatchObject({ ok: true, content: 'cut' });
  });

  it('cut off at the token limit WITHOUT text (thinking used the budget) → kind "truncated"', async () => {
    const finish = 'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n';
    const r = await run(clientOver(fakeTransport([sseReasoning('long'), finish, 'data: [DONE]\n'])));
    expect(r).toMatchObject({ ok: false, kind: 'truncated' });
  });

  it('builds a fresh kit client when the endpoint changes, and reuses it otherwise', async () => {
    let built = 0;
    const t = fakeTransport(['data: [DONE]\n']);
    const c = new CipherClient(() => { built += 1; return createChatClient({ transport: t, clock: fakeClock }); });
    await run(c);
    await run(c);
    expect(built).toBe(1);
    await run(c, { ...CFG, endpoint: { url: 'http://other:1234', apiKey: '' } });
    expect(built).toBe(2);
  });
});

describe('CipherClient response facts (input of checkResponse)', () => {
  it('a finished answer carries status 200, finish reason, content and the reasoning it never showed', async () => {
    const finish = 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n';
    const r = await run(clientOver(fakeTransport([sseReasoning('plan'), sse('hi'), finish, 'data: [DONE]\n'])));
    expect(r).toMatchObject({ ok: true, facts: { status: 200, finishReason: 'stop', content: 'hi', reasoning: 'plan' } });
  });

  it('an HTTP failure carries the status and the server message', async () => {
    const r = await run(clientOver(fakeTransport(['{"error":{"message":"bad param"}}'], 400)));
    expect(r).toMatchObject({ ok: false, kind: 'http', facts: { status: 400, errorText: expect.stringContaining('bad param') } });
  });

  it('thinking that used the whole budget (truncated, no text) is a 200 with finish reason length', async () => {
    const finish = 'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n';
    const r = await run(clientOver(fakeTransport([sseReasoning('long'), finish, 'data: [DONE]\n'])));
    expect(r).toMatchObject({ ok: false, kind: 'truncated', facts: { status: 200, finishReason: 'length', content: '', reasoning: 'long' } });
  });

  it.each(['network', 'aborted'] as const)('%s has no server answer, so no facts', async (kind) => {
    const t: SseTransport = {
      postStream: () => {
        const e = new Error(kind === 'aborted' ? 'Aborted' : 'ECONNREFUSED');
        if (kind === 'aborted') e.name = 'AbortError';
        return Promise.reject(e);
      },
    };
    expect(await run(clientOver(t))).toMatchObject({ ok: false, kind, facts: null });
  });
});
