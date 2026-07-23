import { describe, it, expect } from 'vitest';
import { countsAsKeystroke, isEditorKeydownTarget, isMissionEditorKeystroke } from '../src/keystrokeCounter';

describe('countsAsKeystroke', () => {
  it('counts printable, navigation, and command keys (incl. vim motions/operators)', () => {
    for (const k of ['h', 'j', 'k', 'l', 'w', 'b', 'd', 'x', 'i', 'a', '0', '$', 'Escape', 'Enter', 'Backspace', 'ArrowLeft', ' ']) {
      expect(countsAsKeystroke(k)).toBe(true);
    }
  });

  it('ignores bare modifier keys (they carry no edit intent on their own)', () => {
    for (const k of ['Control', 'Alt', 'Meta', 'Shift', 'CapsLock']) {
      expect(countsAsKeystroke(k)).toBe(false);
    }
  });
});

describe('isEditorKeydownTarget', () => {
  const fakeTarget = (matches: boolean) => ({
    closest: (sel: string) => (sel === '.cm-editor' && matches ? {} : null),
  });

  it('is true when the event target sits inside a .cm-editor', () => {
    expect(isEditorKeydownTarget(fakeTarget(true) as unknown as EventTarget)).toBe(true);
  });

  it('is false for targets outside any editor (command palette, other panes)', () => {
    expect(isEditorKeydownTarget(fakeTarget(false) as unknown as EventTarget)).toBe(false);
  });

  it('is false for null or non-element targets', () => {
    expect(isEditorKeydownTarget(null)).toBe(false);
    expect(isEditorKeydownTarget({} as EventTarget)).toBe(false);
  });
});

describe('isMissionEditorKeystroke (recording scope)', () => {
  const inEditor = { closest: (s: string) => (s === '.cm-editor' ? {} : null) };
  const outside = { closest: (_: string) => null };

  it('true for a real key inside the editor', () => {
    expect(isMissionEditorKeystroke('d', inEditor as unknown as EventTarget)).toBe(true);
  });
  it('false for a bare modifier (never recorded)', () => {
    expect(isMissionEditorKeystroke('Shift', inEditor as unknown as EventTarget)).toBe(false);
  });
  it('false outside the editor (never recorded)', () => {
    expect(isMissionEditorKeystroke('d', outside as unknown as EventTarget)).toBe(false);
  });
  it('false for a null target', () => {
    expect(isMissionEditorKeystroke('d', null)).toBe(false);
  });
});
