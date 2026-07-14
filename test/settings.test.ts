import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, isLlmConfigured } from '../src/settings';

describe('LLM settings', () => {
  it('defaults to unconfigured (feature off)', () => {
    expect(DEFAULT_SETTINGS.llmEndpoint).toBe('');
    expect(DEFAULT_SETTINGS.llmApiKey).toBe('');
    expect(DEFAULT_SETTINGS.llmModel).toBe('');
    expect(isLlmConfigured(DEFAULT_SETTINGS)).toBe(false);
  });

  it('requires both endpoint and model (whitespace does not count)', () => {
    expect(isLlmConfigured({ llmEndpoint: 'http://localhost:1234', llmModel: '' })).toBe(false);
    expect(isLlmConfigured({ llmEndpoint: '   ', llmModel: 'qwen3' })).toBe(false);
    expect(isLlmConfigured({ llmEndpoint: 'http://localhost:1234', llmModel: 'qwen3' })).toBe(true);
  });
});
