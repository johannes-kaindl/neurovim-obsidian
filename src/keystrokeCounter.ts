const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Meta', 'Shift', 'CapsLock']);

/** True if a keydown's `key` should count as a mission keystroke (everything but bare modifiers). */
export function countsAsKeystroke(key: string): boolean {
  return !MODIFIER_KEYS.has(key);
}

/**
 * True if the keydown happened inside a CodeMirror editor (`.cm-editor`). Used to count only
 * editor keystrokes and ignore keys pressed in the command palette, quick switcher, or other
 * panes while a mission is active.
 */
export function isEditorKeydownTarget(target: EventTarget | null): boolean {
  const el = target as { closest?: (sel: string) => unknown } | null;
  return !!el && typeof el.closest === 'function' && el.closest('.cm-editor') != null;
}

/**
 * The single guard both keystroke counting and trace recording sit behind: a countable
 * key pressed inside a CodeMirror editor. Consolidating them guarantees recording can
 * never have a wider scope than counting. The active-mission guard is applied separately
 * at the call site (it is runtime state, not derivable from the event).
 */
export function isMissionEditorKeystroke(key: string, target: EventTarget | null): boolean {
  return countsAsKeystroke(key) && isEditorKeydownTarget(target);
}
