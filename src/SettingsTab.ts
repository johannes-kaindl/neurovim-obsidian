import { App, PluginSettingTab, Setting } from 'obsidian';
import type NeuroVimPlugin from './main';

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
  }
}
