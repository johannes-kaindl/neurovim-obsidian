import { Plugin, Notice } from 'obsidian';
import { loadPluginData } from './storage/loadPluginData';
import { ObsidianStorage } from './storage/ObsidianStorage';
import { BundledContent } from './content/BundledContent';
import { MissionSession } from './MissionSession';
import { ObsidianMissionApp } from './ObsidianMissionApp';
import { HubView, VIEW_TYPE_NEUROVIM } from './HubView';
import type { HubProps } from './HubView';
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
    if (res.ok) {
      new Notice(`>_ Mission ${res.result.mission_id} restored — +${res.result.xp_earned} XP`);
      this.session.end();
    } else {
      const off = res.diff.lines_off;
      new Notice(`>_ ${off} line${off !== 1 ? 's' : ''} differ — keep going`);
    }
    this.repaint();
  }

  private async handleReset(): Promise<void> {
    if (!this.session.activeMissionId) return;
    await this.session.reset();
    new Notice('>_ Transmission reset. Timer restarted.');
    this.repaint();
  }

  private handleAbandon(): void {
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
    const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_NEUROVIM)[0]?.view;
    if (!(view instanceof HubView)) return;
    const id = this.session.activeMissionId;
    const active = id
      ? {
          id,
          title: this.missions.find((m) => m.mission_id === id)?.title ?? id,
          elapsedMs: this.session.metrics.getElapsedMs(),
          keystrokes: this.session.metrics.getKeystrokes(),
        }
      : null;
    const props: HubProps = {
      missions: this.missions,
      data: this.data,
      active,
      onStart: (mid) => void this.handleStart(mid),
      onSubmit: () => void this.handleSubmit(),
      onReset: () => void this.handleReset(),
      onAbandon: () => this.handleAbandon(),
    };
    view.setProps(props);
  }
}
