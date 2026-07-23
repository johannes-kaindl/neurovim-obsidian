/**
 * Thin wrapper over Obsidian's status-bar element. No logic — the text is computed by the
 * caller. Not unit-tested (no DOM in the vitest node env); verified in the smoke test,
 * same as ObsidianHudDom.
 */
export class StatusBarItem {
  constructor(private readonly el: HTMLElement) {
    this.el.addClass('nv-statusbar');
  }

  /** Set the text, or pass null to show nothing. */
  set(text: string | null): void {
    if (text === null) {
      this.el.setText('');
      this.el.toggleClass('is-hidden', true);
      return;
    }
    this.el.toggleClass('is-hidden', false);
    this.el.setText(text);
  }
}
