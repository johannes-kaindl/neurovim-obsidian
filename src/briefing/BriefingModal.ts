import { App, Component, MarkdownRenderer, Modal } from 'obsidian';
import type { ColorScheme } from '../settings';
import { stripTransmissionLink } from './briefingText';

/** Shows a mission briefing (rendered Obsidian markdown) before the transmission opens. */
export class BriefingModal extends Modal {
  private comp = new Component();

  constructor(
    app: App,
    private title: string,
    private body: string,
    private scheme: ColorScheme,
    private onBegin: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass('nv-briefing-modal', `nv-${this.scheme}`);
    this.comp.load();
    const { contentEl } = this;
    contentEl.addClass('nv-briefing');
    contentEl.createDiv({ cls: 'nv-briefing-title', text: `>_ MISSION BRIEFING — ${this.title}` });
    // nv-md-surface carries the shared CRT rules for Obsidian-rendered markdown
    // (palette remap, callout blending, per-element hardening, ASCII scroll).
    // The lore reader wears the same class — see styles.css § Rendered markdown.
    const md = contentEl.createDiv({ cls: 'nv-briefing-body nv-md-surface' });
    void MarkdownRenderer.render(this.app, stripTransmissionLink(this.body), md, '', this.comp);
    const actions = contentEl.createDiv({ cls: 'nv-briefing-actions' });
    const btn = actions.createEl('button', { cls: 'nv-btn nv-btn-begin', text: '▶ BEGIN MISSION' });
    btn.onclick = () => { this.close(); this.onBegin(); };
  }

  onClose(): void {
    this.comp.unload();
    this.contentEl.empty();
  }
}
