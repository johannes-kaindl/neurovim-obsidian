import { describe, it, expect } from 'vitest';
import { parseSSE } from '../src/vendor/kit/sse';
import { ThinkSplitter } from '../src/vendor/kit/think';
import { normalizeEndpoint } from '../src/vendor/kit/endpoint';
import { classifyEndpointStatus, ENDPOINT_PRESETS, validateEndpointInput } from '../src/vendor/kit/endpoint_diagnostics';
import { resolveCollapsed } from '../src/vendor/kit/collapsible';
import { suppressParams, isAlwaysOnThinker } from '../src/vendor/kit/reasoning';
import { parseLmStudioContext, parseOllamaContext } from '../src/vendor/kit/model-context';

describe('vendored kit modules', () => {
  it('parseSSE accumulates content deltas and detects [DONE]', () => {
    const buf =
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n' +
      'data: {"choices":[{"delta":{"content":" there"}}]}\n' +
      'data: [DONE]\n';
    const r = parseSSE(buf);
    expect(r.content).toEqual(['Hi', ' there']);
    expect(r.done).toBe(true);
    expect(r.rest).toBe('');
  });

  it('ThinkSplitter routes <think> spans to reasoning, even across pushes', () => {
    const s = new ThinkSplitter();
    const a = s.push('<thi');
    const b = s.push('nk>plan</think>answer');
    expect(a.content + b.content).toBe('answer');
    expect(a.reasoning + b.reasoning).toBe('plan');
  });

  it('normalizeEndpoint strips trailing slashes and /v1', () => {
    expect(normalizeEndpoint('http://localhost:1234/v1/')).toBe('http://localhost:1234');
  });
});

describe('vendored endpoint_diagnostics', () => {
  it('classifies a model-list response as ok', () => {
    const s = classifyEndpointStatus({ kind: 'response', status: 200, body: { data: [] } });
    expect(s.reachable).toBe(true);
    expect(s.kind).toBe('ok');
  });

  it('classifies ECONNREFUSED as refused and timeout as timeout', () => {
    expect(classifyEndpointStatus({ kind: 'error', message: 'ECONNREFUSED' }).kind).toBe('refused');
    expect(classifyEndpointStatus({ kind: 'timeout' }).kind).toBe('timeout');
  });

  it('ships LM Studio and Ollama presets and warns on a missing scheme', () => {
    expect(ENDPOINT_PRESETS.map((p) => p.label)).toEqual(['LM Studio', 'Ollama']);
    expect(validateEndpointInput('localhost:1234').map((w) => w.rule)).toContain('scheme');
  });
});

describe('vendored collapsible', () => {
  it('resolveCollapsed prefers a stored value over the default', () => {
    const storage = { getCollapsed: () => false, setCollapsed: () => {} };
    expect(resolveCollapsed('cipher', true, storage)).toBe(false);
  });

  it('resolveCollapsed falls back to the default without a stored value', () => {
    const storage = { getCollapsed: () => undefined, setCollapsed: () => {} };
    expect(resolveCollapsed('cipher', true, storage)).toBe(true);
    expect(resolveCollapsed('cipher', false, undefined)).toBe(false);
  });
});

describe('vendored reasoning', () => {
  it('suppressParams is empty when not suppressing and a union of params when it is', () => {
    expect(suppressParams(false)).toEqual({});
    expect(suppressParams(true)).toEqual({
      reasoning_effort: 'none',
      chat_template_kwargs: { enable_thinking: false },
      reasoning_budget: 0,
    });
  });

  it('isAlwaysOnThinker matches gpt-oss and harmony only', () => {
    expect(isAlwaysOnThinker('gpt-oss-20b')).toBe(true);
    expect(isAlwaysOnThinker('qwen3-8b')).toBe(false);
  });
});

describe('vendored model-context', () => {
  it('parseLmStudioContext reads per-model context lengths', () => {
    const json = { data: [{ id: 'qwen3-8b', max_context_length: 32768, loaded_context_length: 8192 }] };
    expect(parseLmStudioContext(json, 'qwen3-8b')).toEqual({ maxContextLength: 32768, loadedContextLength: 8192 });
    expect(parseLmStudioContext(json, 'other')).toBeNull();
  });

  it('parseOllamaContext finds the arch-prefixed context_length', () => {
    expect(parseOllamaContext({ model_info: { 'qwen3.context_length': 40960 } })).toEqual({ maxContextLength: 40960 });
    expect(parseOllamaContext({ model_info: {} })).toBeNull();
  });
});
