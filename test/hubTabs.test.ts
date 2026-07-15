import { describe, it, expect } from 'vitest';
import { effectiveTab } from '../src/hubTabs';

describe('effectiveTab', () => {
  it('keeps the active tab when it is available', () => {
    expect(effectiveTab('guide', false)).toBe('guide');
    expect(effectiveTab('uplink', true)).toBe('uplink');
  });
  it('falls back to nexus when uplink is selected but not visible', () => {
    expect(effectiveTab('uplink', false)).toBe('nexus');
  });
});
