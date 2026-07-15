import { describe, it, expect } from 'vitest';
import { parseSSE } from '../src/vendor/kit/sse';
import { ThinkSplitter } from '../src/vendor/kit/think';
import { normalizeEndpoint } from '../src/vendor/kit/endpoint';
import { classifyEndpointStatus, ENDPOINT_PRESETS, validateEndpointInput } from '../src/vendor/kit/endpoint_diagnostics';

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
