import { describe, it, expect } from 'vitest';
import { resolvePresence } from '../src/missionPresence';

describe('resolvePresence', () => {
  it('is focused when the active note is the mission note', () => {
    expect(resolvePresence('_neurovim/M-02.md', '_neurovim/M-02.md')).toBe('focused');
  });

  it('is away when another note is active', () => {
    expect(resolvePresence('Daily/2026-07-23.md', '_neurovim/M-02.md')).toBe('away');
  });

  it('is away when no note is active at all', () => {
    expect(resolvePresence(null, '_neurovim/M-02.md')).toBe('away');
  });

  it('is away when no mission is running', () => {
    expect(resolvePresence('Daily/2026-07-23.md', null)).toBe('away');
    expect(resolvePresence(null, null)).toBe('away');
  });
});
