import { describe, it, expect } from 'vitest';
import { extractModelIds } from '../src/llm/modelList';

describe('extractModelIds', () => {
  it('extracts ids from an OpenAI-style model list', () => {
    const body = { data: [{ id: 'qwen3-8b' }, { id: 'llama-3.1' }] };
    expect(extractModelIds(body)).toEqual(['qwen3-8b', 'llama-3.1']);
  });

  it('skips entries without a string id', () => {
    const body = { data: [{ id: 'ok' }, { id: 42 }, 'garbage', null, {}] };
    expect(extractModelIds(body)).toEqual(['ok']);
  });

  it('returns [] for malformed bodies', () => {
    expect(extractModelIds(null)).toEqual([]);
    expect(extractModelIds({})).toEqual([]);
    expect(extractModelIds({ data: 'nope' })).toEqual([]);
    expect(extractModelIds('html error page')).toEqual([]);
  });
});
