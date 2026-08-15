import { App, Component, MarkdownRenderer, Modal } from 'obsidian';
import type { ColorScheme } from '../settings';

/** Shows one lore artifact as rendered Obsidian markdown. Read-only: never touches game state. */
export class LoreModal extends Modal {
  private comp = new Component();

  constructor(
    app: App,
    private artifactId: string,
    private artifactTitle: string,
    private body: string,
    private scheme: ColorScheme,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass('nv-lore-modal', `nv-${this.scheme}`);
    this.comp.load();
    const { contentEl } = this;
    contentEl.addClass('nv-lore');
    contentEl.createDiv({
      cls: 'nv-lore-title',
      text: `>_ ${this.artifactId} — ${this.artifactTitle}`,
    });
    // nv-md-surface: shared with BriefingModal — see styles.css § Rendered markdown.
    // Without it the reader rendered in the theme's colours instead of the CRT
    // palette, and the ASCII headers wrapped (smoke test 2026-08-15, step 3).
    const md = contentEl.createDiv({ cls: 'nv-lore-body nv-md-surface' });
    // Empty body is the fallback for a missing artifact — see main.ts openLore().
    void MarkdownRenderer.render(
      this.app,
      this.body.trim() || '_No data on file._',
      md,
      '',
      this.comp,
    );
    const actions = contentEl.createDiv({ cls: 'nv-lore-actions' });
    const btn = actions.createEl('button', { cls: 'nv-btn', text: '← ARCHIVE' });
    btn.onclick = () => this.close();
  }

  onClose(): void {
    this.comp.unload();
    this.contentEl.empty();
  }
}
