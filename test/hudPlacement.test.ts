import { describe, it, expect } from 'vitest';
import { resolveHudTarget } from '../src/hudPlacement';

describe('resolveHudTarget', () => {
  describe("placement 'sidebar' — only ever in the pane", () => {
    it('shows in the pane when the pane is visible', () => {
      expect(resolveHudTarget('sidebar', true, false)).toBe('sidebar');
    });
    it('shows nothing when the pane is hidden (no fallback box)', () => {
      expect(resolveHudTarget('sidebar', false, false)).toBe('none');
    });
    it('ignores the box-dismissed flag', () => {
      expect(resolveHudTarget('sidebar', true, true)).toBe('sidebar');
    });
  });

  describe("placement 'box' — always the floating box", () => {
    it('shows the box regardless of pane visibility', () => {
      expect(resolveHudTarget('box', true, false)).toBe('box');
      expect(resolveHudTarget('box', false, false)).toBe('box');
    });
    it('shows nothing once the box was dismissed', () => {
      expect(resolveHudTarget('box', false, true)).toBe('none');
    });
  });

  describe("placement 'auto' — pane when open, box otherwise", () => {
    it('prefers the pane when it is visible', () => {
      expect(resolveHudTarget('auto', true, false)).toBe('sidebar');
    });
    it('falls back to the box when the pane is hidden', () => {
      expect(resolveHudTarget('auto', false, false)).toBe('box');
    });
    it('shows nothing when the pane is hidden and the box was dismissed', () => {
      expect(resolveHudTarget('auto', false, true)).toBe('none');
    });
    it('still uses the pane even if the box was dismissed', () => {
      expect(resolveHudTarget('auto', true, true)).toBe('sidebar');
    });
  });
});
