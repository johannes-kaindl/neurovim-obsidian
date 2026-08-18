import { countsAsKeystroke } from '@neurovim/core';

/**
 * True if the keydown happened inside a CodeMirror editor (`.cm-editor`). Used to count only
 * editor keystrokes and ignore keys pressed in the command palette, quick switcher, or other
 * panes while a mission is active. Stays here rather than in the core: it needs the DOM.
 */
export function isEditorKeydownTarget(target: EventTarget | null): boolean {
  const el = target as { closest?: (sel: string) => unknown } | null;
  return !!el && typeof el.closest === 'function' && el.closest('.cm-editor') != null;
}

/**
 * The single guard both keystroke counting and trace recording sit behind: a countable
 * key (core rule) pressed inside a CodeMirror editor (local rule). The active-mission
 * guard is applied separately at the call site — it is runtime state, not derivable
 * from the event.
 */
export function isMissionEditorKeystroke(key: string, target: EventTarget | null): boolean {
  return countsAsKeystroke(key) && isEditorKeydownTarget(target);
}
