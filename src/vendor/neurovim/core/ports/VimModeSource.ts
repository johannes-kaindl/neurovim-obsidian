/**
 * VimModeSource — Vim mode and action event source (ADR-001 §P2 / Decisions D1).
 *
 * Decouples game logic + audio feedback from the question of WHERE the Vim editor runs.
 * - adapter-obsidian: `MarkdownView.editor.cm.on('vim-mode-change')` (from VimModeWatcher.ts)
 *   + keystroke classification (from CommandListener.ts).
 * - adapter-web:      CodeMirror 6 + `@replit/codemirror-vim` (emits the same
 *   'vim-mode-change' event). Regex flavor parity: see experiments/vim-regex-findings.md (D1).
 *
 * Generalizes two legacy sources:
 *  - VimModeWatcher  → mode changes (normal/insert/visual/command-line)
 *  - CommandListener → classified Vim actions (delete/yank/change/motion/paste/undo/…)
 */
export type VimMode = 'normal' | 'insert' | 'visual' | 'command-line';

export type VimAction =
  | 'delete' | 'yank' | 'change' | 'paste'
  | 'motion-forward' | 'motion-back' | 'goto-start' | 'goto-end'
  | 'undo' | 'redo';

export interface VimModeSource {
  /** Current Vim mode (pull). */
  getCurrentMode(): VimMode;

  /** Mode changes (push); returns an unsubscribe function. */
  onModeChange(cb: (mode: VimMode) => void): () => void;

  /**
   * Classified Vim actions (push) — basis for command sound cues.
   * Generalization of CommandListener; returns an unsubscribe function.
   */
  onAction(cb: (action: VimAction) => void): () => void;
}
