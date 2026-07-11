import { Plugin, Notice, MarkdownView } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { loadPluginData } from './storage/loadPluginData';
import { ObsidianStorage } from './storage/ObsidianStorage';
import { BundledContent } from './content/BundledContent';
import { MissionSession } from './MissionSession';
import { ObsidianMissionApp } from './ObsidianMissionApp';
import { HubView, VIEW_TYPE_NEUROVIM } from './HubView';
import type { HubProps } from './HubView';
import { HudMount, type HudActive } from './HudMount';
import { ObsidianHudDom } from './ObsidianHudDom';
import { diffHighlightField, showDivergentLine, clearHighlight } from './diffHighlight';
import { NeuroVimSettingTab } from './SettingsTab';
import { DEFAULT_SETTINGS, type VimDojoSettings } from './settings';
import type { PluginData, MissionSummary } from '@neurovim/core';

/** data.json blob = PluginData plus our settings under a reserved key. */
type StoredBlob = Partial<PluginData> & { __settings?: Partial<VimDojoSettings> };

export default class NeuroVimPlugin extends Plugin {
  settings: VimDojoSettings = { ...DEFAULT_SETTINGS };
  private storage!: ObsidianStorage;
  private data!: PluginData;
  private content = new BundledContent();
  private missions: MissionSummary[] = [];
  private session!: MissionSession;
  private hud!: HudMount;
  private tick: number | null = null;

  async onload(): Promise<void> {
    this.storage = new ObsidianStorage(this);
    const blob = (await this.loadData()) as StoredBlob | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(blob?.__settings ?? {}) };
    this.data = await loadPluginData(this.storage);
    this.missions = await this.content.listMissions();

    this.session = new MissionSession({
      app: new ObsidianMissionApp(this.app),
      content: this.content,
      getFolder: () => this.settings.missionFolder,
      getData: () => this.data,
      setData: async (d) => { this.data = d; await this.persist(); },
    });

    this.hud = new HudMount(new ObsidianHudDom(this.app));
    this.registerEditorExtension([diffHighlightField]);
    this.registerEvent(this.app.workspace.on('layout-change', () => this.repaint()));

    this.registerView(VIEW_TYPE_NEUROVIM, (leaf) => new HubView(leaf));
    this.addRibbonIcon('terminal', 'NeuroVim', () => void this.activateView());

    this.addCommand({ id: 'open', name: 'Open NeuroVim', callback: () => void this.activateView() });
    this.addCommand({ id: 'submit', name: 'Submit mission', callback: () => void this.handleSubmit() });
    this.addCommand({ id: 'reset', name: 'Reset mission', callback: () => void this.handleReset() });

    this.registerDomEvent(document, 'keydown', (e: KeyboardEvent) => {
      if (!this.session.activeMissionId) return;
      if (['Control', 'Alt', 'Meta', 'Shift', 'CapsLock'].includes(e.key)) return;
      this.session.metrics.addKeystroke();
    });

    this.addSettingTab(new NeuroVimSettingTab(this.app, this));
    this.tick = window.setInterval(() => this.repaint(), 500);
    this.app.workspace.onLayoutReady(() => void this.activateView());
  }

  onunload(): void {
    if (this.tick !== null) window.clearInterval(this.tick);
    this.hud.detach();
  }

  /** CM6 EditorView of the active mission note, if it's open in a markdown leaf. */
  private missionEditorView(): EditorView | null {
    const path = this.session.notePath;
    if (!path) return null;
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === path) {
        const cm = (view.editor as unknown as { cm?: EditorView }).cm;
        if (cm) return cm;
      }
    }
    return null;
  }

  async saveSettings(): Promise<void> { await this.persist(); }

  /** Persist PluginData + settings under one data.json blob. */
  private async persist(): Promise<void> {
    const blob: StoredBlob = { ...this.data, __settings: this.settings };
    await this.saveData(blob);
  }

  private async handleStart(id: string): Promise<void> {
    try {
      await this.session.start(id);
      this.repaint();
    } catch (e) {
      new Notice(`NeuroVim: ${(e as Error).message}`);
    }
  }

  private async handleSubmit(): Promise<void> {
    if (!this.session.activeMissionId) return;
    const res = await this.session.submit();
    const cm = this.missionEditorView();
    if (res.ok) {
      if (cm) clearHighlight(cm);
      new Notice(`>_ Mission ${res.result.mission_id} restored — +${res.result.xp_earned} XP`);
      this.session.end();
    } else {
      if (cm) showDivergentLine(cm, res.diff.first_divergent_line);
      const off = res.diff.lines_off;
      new Notice(`>_ ${off} line${off !== 1 ? 's' : ''} differ — keep going`);
    }
    this.repaint();
  }

  private async handleReset(): Promise<void> {
    if (!this.session.activeMissionId) return;
    await this.session.reset();
    const cm = this.missionEditorView();
    if (cm) clearHighlight(cm);
    new Notice('>_ Transmission reset. Timer restarted.');
    this.repaint();
  }

  private handleAbandon(): void {
    const cm = this.missionEditorView();
    if (cm) clearHighlight(cm);
    this.session.end();
    new Notice('>_ Mission aborted.');
    this.repaint();
  }

  private async activateView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_NEUROVIM);
    if (existing.length) { workspace.revealLeaf(existing[0]); this.repaint(); return; }
    const leaf = workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_NEUROVIM, active: true });
    workspace.revealLeaf(leaf);
    this.repaint();
  }

  private repaint(): void {
    const id = this.session.activeMissionId;
    const vimActive = !!(this.app.vault as unknown as { getConfig?: (k: string) => unknown })
      .getConfig?.('vimMode');

    // Floating HUD: mission-control over the note (or hidden when no mission runs).
    const active: HudActive | null = id && this.session.notePath
      ? {
          notePath: this.session.notePath,
          props: {
            id,
            title: this.missions.find((m) => m.mission_id === id)?.title ?? id,
            elapsedMs: this.session.metrics.getElapsedMs(),
            keystrokes: this.session.metrics.getKeystrokes(),
            vimActive,
            onSubmit: () => void this.handleSubmit(),
            onReset: () => void this.handleReset(),
            onAbandon: () => this.handleAbandon(),
          },
        }
      : null;
    this.hud.sync(active);

    // Sidebar pane always shows the NEXUS mission list.
    const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_NEUROVIM)[0]?.view;
    if (view instanceof HubView) {
      view.setProps({
        missions: this.missions,
        data: this.data,
        onStart: (mid) => void this.handleStart(mid),
      });
    }
  }
}
