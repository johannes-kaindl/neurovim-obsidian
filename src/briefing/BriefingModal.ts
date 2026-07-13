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
    const md = contentEl.createDiv({ cls: 'nv-briefing-body' });
    void MarkdownRenderer.render(this.app, stripTransmissionLink(this.body), md, '', this.comp);
    const actions = contentEl.createDiv({ cls: 'nv-briefing-actions' });
    const btn = actions.createEl('button', { cls: 'nv-btn nv-btn-begin', text: '▶ MISSION BEGINNEN' });
    btn.onclick = () => { this.close(); this.onBegin(); };
  }

  onClose(): void {
    this.comp.unload();
    this.contentEl.empty();
  }
}
