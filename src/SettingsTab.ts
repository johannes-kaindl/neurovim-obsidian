import { App, PluginSettingTab, Setting } from 'obsidian';
import type NeuroVimPlugin from './main';
import type { HudPlacement } from './hudPlacement';

export class NeuroVimSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: NeuroVimPlugin) { super(app, plugin); }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName('Mission folder')
      .setDesc('Where throwaway mission notes are materialized. Safe to delete anytime — deleting a note or the whole folder loses no progress (XP/best times live in the plugin).')
      .addText((t) =>
        t.setPlaceholder('NeuroVim/')
          .setValue(this.plugin.settings.missionFolder)
          .onChange(async (v) => {
            this.plugin.settings.missionFolder = v.trim() || 'NeuroVim/';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('HUD placement')
      .setDesc('Where mission-control (timer, submit/reset/abort) appears during a mission. The floating box can also be dismissed per mission with its × button.')
      .addDropdown((d) =>
        d
          .addOption('auto', 'Auto — sidebar when open, else floating box')
          .addOption('sidebar', 'Sidebar only')
          .addOption('box', 'Floating box only')
          .setValue(this.plugin.settings.hudPlacement)
          .onChange(async (v) => {
            this.plugin.settings.hudPlacement = v as HudPlacement;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('CRT color scheme')
      .setDesc('On: fixed cyberpunk look (dark background, phosphor green) — theme-independent, always legible. Off: adaptive Obsidian-theme colors that blend into your light/dark theme.')
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.colorScheme === 'crt')
          .onChange(async (v) => {
            this.plugin.settings.colorScheme = v ? 'crt' : 'native';
            await this.plugin.saveSettings();
          }),
      );
  }
}
