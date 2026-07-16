import { describe, it, expect, vi, beforeEach } from 'vitest';

const requestUrl = vi.fn();
vi.mock('obsidian', () => ({ requestUrl: (...a: unknown[]) => requestUrl(...a) }));

import { probeModelContext } from '../src/llm/modelContext';

beforeEach(() => { requestUrl.mockReset(); });

describe('probeModelContext', () => {
  it('reads the loaded context length from LM Studio', async () => {
    requestUrl.mockResolvedValueOnce({
      status: 200,
      text: JSON.stringify({ data: [{ id: 'qwen3-8b', max_context_length: 32768, loaded_context_length: 8192 }] }),
    });
    expect(await probeModelContext('http://localhost:1234', '', 'qwen3-8b')).toBe(8192);
    expect(requestUrl).toHaveBeenCalledTimes(1);
  });

  it('falls back to Ollama when LM Studio does not know the model', async () => {
    requestUrl
      .mockResolvedValueOnce({ status: 404, text: 'not found' })
      .mockResolvedValueOnce({ status: 200, text: JSON.stringify({ model_info: { 'qwen3.context_length': 40960 } }) });
    expect(await probeModelContext('http://localhost:11434', '', 'qwen3')).toBe(40960);
    expect(requestUrl).toHaveBeenCalledTimes(2);
  });

  it('returns null when neither endpoint reports a context length', async () => {
    requestUrl
      .mockResolvedValueOnce({ status: 404, text: '' })
      .mockResolvedValueOnce({ status: 404, text: '' });
    expect(await probeModelContext('http://x:1', '', 'm')).toBeNull();
  });

  it('never throws — a failing request maps to null', async () => {
    requestUrl.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await probeModelContext('http://x:1', '', 'm')).toBeNull();
  });
});
