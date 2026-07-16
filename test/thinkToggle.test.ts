import { describe, it, expect } from 'vitest';
import { effectiveSuppress, thinkToggleState } from '../src/llm/thinkToggle';

describe('effectiveSuppress', () => {
  it('suppresses when the user asks for it and the model can be silenced', () => {
    expect(effectiveSuppress('qwen3-8b', true)).toBe(true);
  });

  it('never suppresses when the user does not ask for it', () => {
    expect(effectiveSuppress('qwen3-8b', false)).toBe(false);
  });

  it('never suppresses always-on thinkers (they reject reasoning_effort:none)', () => {
    expect(effectiveSuppress('gpt-oss-20b', true)).toBe(false);
    expect(effectiveSuppress('harmony-1', true)).toBe(false);
  });
});

describe('thinkToggleState', () => {
  it('disables the toggle for always-on thinkers and says so', () => {
    const s = thinkToggleState('gpt-oss-20b', true);
    expect(s.disabled).toBe(true);
    expect(s.desc).toContain('always');
  });

  it('stays enabled for silenceable models', () => {
    expect(thinkToggleState('qwen3-8b', true).disabled).toBe(false);
    expect(thinkToggleState('qwen3-8b', false).disabled).toBe(false);
  });
});
