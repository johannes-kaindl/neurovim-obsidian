import { describe, it, expect } from 'vitest';
import { buildCipherParams, CIPHER_MAX_TOKENS } from '../src/llm/CipherClient';
import type { BackendId, FamilyId } from '../src/vendor/kit/sampling-profiles';

/* Golden requests: what CIPHER actually sends, per model family × backend. They run against
   `buildCipherParams` — the plugin's own wrapper with its fixed mode (`companion`) and token
   budget — not against `resolveRequestParams` directly; that would test the kit instead of the
   plugin. The expected values are the kit's profile table for `companion` (temperature 0.7,
   thinking off) and were checked against the table's sources, not copied from a run. */

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
  it.each(cases)('%s on %s', (family, backend) => {
    const { params } = buildCipherParams({ family, backend, thinking: 'off' });
    expect(params).toEqual(OFF[`${family}|${backend}`]);
  });
});

describe('golden requests — CIPHER, thinking on', () => {
  it('qwen3.8 on LM Studio, medium: thinking sampling set, budget raised to the family reserve', () => {
    expect(buildCipherParams({ family: 'qwen3.8', backend: 'lmstudio', thinking: 'medium' }).params)
      .toEqual({ temperature: 0.7, top_p: 0.95, top_k: 20, min_p: 0, reasoning_effort: 'medium', max_tokens: 2048 });
  });
  it('gpt-oss on LM Studio, medium', () => {
    expect(buildCipherParams({ family: 'gpt-oss', backend: 'lmstudio', thinking: 'medium' }).params)
      .toEqual({ temperature: 0.7, top_p: 1, reasoning_effort: 'medium', max_tokens: 2048 });
  });
  it('unknown model, medium: the level still goes out where the backend understands it, the budget stays the plugin\'s', () => {
    expect(buildCipherParams({ family: null, backend: 'lmstudio', thinking: 'medium' }).params)
      .toEqual({ temperature: 0.7, reasoning_effort: 'medium', max_tokens: CIPHER_MAX_TOKENS });
  });
});

describe('golden requests — overrides and the always-on thinker guard', () => {
  it('a user override for the family wins over the profile value', () => {
    const { params } = buildCipherParams({ family: 'gemma4', backend: 'lmstudio', thinking: 'off', overrides: { temperature: 0.3, top_k: 40 } });
    expect(params).toMatchObject({ temperature: 0.3, top_k: 40 });
  });
  it('never asks gpt-oss to think "none" (the server rejects it; this used to be a CipherClient test)', () => {
    for (const backend of BACKENDS) {
      const { params } = buildCipherParams({ family: 'gpt-oss', backend, thinking: 'off' });
      expect(params.reasoning_effort).not.toBe('none');
    }
  });
});
