import { describe, it, expect } from 'vitest';
import { createLlmConnection } from '../src/vendor/kit-obsidian/llm-connection';
import type { SseTransport } from '../src/vendor/kit-obsidian/chat-client';
import { CIPHER_MAX_TOKENS, MODE } from '../src/llm/cipherRequest';
import {
  DEFAULT_REQUEST_SETTINGS, type BackendId, type FamilyId, type FieldId, type ThinkingLevel,
} from '../src/vendor/kit/sampling-profiles';

/* Golden requests: what CIPHER actually sends, per model family × backend. They run through
   the kit connection the plugin builds (`createLlmConnection` with the plugin's fixed mode
   `companion` and token budget) and read the body off the wire — not `resolveRequestParams`
   directly; that would test the kit's table instead of the plugin's wiring. The expected values
   are the profile table for `companion` (temperature 0.7, thinking off), checked against the
   table's sources, not copied from a run. */

/** A model name per family that the kit's name guess maps to that family. */
const MODEL: Record<string, string> = {
  'qwen3.8': 'qwen/qwen3.8-27b',
  'qwen3.6': 'qwen/qwen3.6-35b-a3b',
  gemma4: 'google/gemma-4-26b',
  'gpt-oss': 'openai/gpt-oss-20b',
  null: 'mystery-model-7b',
};

const SAMPLING_FIELDS: FieldId[] = ['temperature', 'top_p', 'top_k', 'min_p', 'presence_penalty', 'reasoning_effort', 'max_tokens'];

/** One CIPHER request through the connection; returns the sampling fields that went over the wire. */
async function sent(input: {
  family: FamilyId | null; backend: BackendId; thinking: ThinkingLevel;
  overrides?: Partial<Record<FieldId, number | string>>;
}): Promise<Record<string, unknown>> {
  const request = structuredClone(DEFAULT_REQUEST_SETTINGS);
  request.thinking[MODE] = input.thinking;
  if (input.overrides) request.overrides[MODE] = { [input.family ?? 'unknown']: input.overrides };
  let body: Record<string, unknown> = {};
  const http: SseTransport = {
    async postStream(_url, b, _headers, onChunk) {
      body = b as Record<string, unknown>;
      onChunk(`data: ${JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] })}\n`);
      return 200;
    },
  };
  const conn = createLlmConnection({
    app: { plugins: { plugins: {} } } as never, pluginId: 'neurovim', caller: 'neurovim', capability: 'chat',
    mode: MODE, maxTokens: CIPHER_MAX_TOKENS, truncated: 'error',
    getSettings: () => ({ endpoints: [{ url: 'http://127.0.0.1:1234', model: MODEL[String(input.family)] }], request }),
    persist: () => Promise.resolve(),
    probe: () => Promise.resolve(true),
    backendOf: () => Promise.resolve(input.backend),
    transports: { http, fallback: 'none' },
    // The default clock needs `window`; vitest runs in node.
    clock: { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number, clearTimeout: (id) => clearTimeout(id) },
  });
  const r = await conn.complete({ messages: [{ role: 'user', content: 'hi' }] });
  expect(r.ok).toBe(true);
  return Object.fromEntries(SAMPLING_FIELDS.flatMap((f) => (f in body ? [[f, body[f]]] : [])));
}

type Family = FamilyId | null;
const FAMILIES: Family[] = ['qwen3.8', 'qwen3.6', 'gemma4', 'gpt-oss', null];
const BACKENDS: BackendId[] = ['lmstudio', 'openwebui', 'unknown'];

/** Thinking OFF (the mode's default). `null` family = unknown model. */
const OFF: Record<string, Record<string, number | string>> = {
  // Qwen 3.8 model card, no-thinking set; top_k/min_p/presence_penalty only where the backend carries them.
  'qwen3.8|lmstudio': { temperature: 0.7, top_p: 0.8, top_k: 20, min_p: 0, reasoning_effort: 'none', max_tokens: 1024 },
  'qwen3.8|openwebui': { temperature: 0.7, top_p: 0.8, top_k: 20, min_p: 0, presence_penalty: 1.5, reasoning_effort: 'none', max_tokens: 1024 },
  'qwen3.8|unknown': { temperature: 0.7, top_p: 0.8, reasoning_effort: 'none', max_tokens: 1024 },
  'qwen3.6|lmstudio': { temperature: 0.7, top_p: 0.95, top_k: 20, reasoning_effort: 'none', max_tokens: 1024 },
  'qwen3.6|openwebui': { temperature: 0.7, top_p: 0.95, top_k: 20, reasoning_effort: 'none', max_tokens: 1024 },
  'qwen3.6|unknown': { temperature: 0.7, top_p: 0.95, reasoning_effort: 'none', max_tokens: 1024 },
  'gemma4|lmstudio': { temperature: 0.7, top_p: 0.95, top_k: 64, reasoning_effort: 'none', max_tokens: 1024 },
  'gemma4|openwebui': { temperature: 0.7, top_p: 0.95, top_k: 64, reasoning_effort: 'none', max_tokens: 1024 },
  'gemma4|unknown': { temperature: 0.7, top_p: 0.95, reasoning_effort: 'none', max_tokens: 1024 },
  // gpt-oss cannot be switched off: the lowest level is "minimal", never "none".
  'gpt-oss|lmstudio': { temperature: 0.7, top_p: 1, reasoning_effort: 'minimal', max_tokens: 1024 },
  'gpt-oss|openwebui': { temperature: 0.7, top_p: 1, reasoning_effort: 'minimal', max_tokens: 1024 },
  'gpt-oss|unknown': { temperature: 0.7, top_p: 1, reasoning_effort: 'minimal', max_tokens: 1024 },
  // Unknown family: only the mode's temperature (plus what the backend alone can carry) and the budget.
  'null|lmstudio': { temperature: 0.7, reasoning_effort: 'none', max_tokens: 1024 },
  'null|openwebui': { temperature: 0.7, reasoning_effort: 'none', max_tokens: 1024 },
  'null|unknown': { temperature: 0.7, max_tokens: 1024 },
};

describe('golden requests — CIPHER, thinking off (default)', () => {
  const cases = FAMILIES.flatMap((f) => BACKENDS.map((b) => [f, b] as const));
  it('covers every family × backend', () => {
    expect(Object.keys(OFF).sort()).toEqual(cases.map(([f, b]) => `${f}|${b}`).sort());
  });
  it.each(cases)('%s on %s', async (family, backend) => {
    expect(await sent({ family, backend, thinking: 'off' })).toEqual(OFF[`${family}|${backend}`]);
  });
});

describe('golden requests — CIPHER, thinking on', () => {
  it('qwen3.8 on LM Studio, medium: thinking sampling set, budget raised to the family reserve', async () => {
    expect(await sent({ family: 'qwen3.8', backend: 'lmstudio', thinking: 'medium' }))
      .toEqual({ temperature: 0.7, top_p: 0.95, top_k: 20, min_p: 0, reasoning_effort: 'medium', max_tokens: 2048 });
  });
  it('gpt-oss on LM Studio, medium', async () => {
    expect(await sent({ family: 'gpt-oss', backend: 'lmstudio', thinking: 'medium' }))
      .toEqual({ temperature: 0.7, top_p: 1, reasoning_effort: 'medium', max_tokens: 2048 });
  });
  it('unknown model, medium: the level still goes out where the backend understands it, the budget stays the plugin\'s', async () => {
    expect(await sent({ family: null, backend: 'lmstudio', thinking: 'medium' }))
      .toEqual({ temperature: 0.7, reasoning_effort: 'medium', max_tokens: CIPHER_MAX_TOKENS });
  });
});

describe('golden requests — overrides and the always-on thinker guard', () => {
  it('a user override for the family wins over the profile value', async () => {
    expect(await sent({ family: 'gemma4', backend: 'lmstudio', thinking: 'off', overrides: { temperature: 0.3, top_k: 40 } }))
      .toMatchObject({ temperature: 0.3, top_k: 40 });
  });
  it('never asks gpt-oss to think "none" (the server rejects it)', async () => {
    for (const backend of BACKENDS) {
      expect((await sent({ family: 'gpt-oss', backend, thinking: 'off' })).reasoning_effort).not.toBe('none');
    }
  });
});
