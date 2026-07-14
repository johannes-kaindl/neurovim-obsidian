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

    new Setting(containerEl)
      .setName('Auto Vim mode')
      .setDesc("Turn Obsidian's Vim mode on while a mission is active and restore your previous setting when it ends. Changes your global editor Vim setting for the duration.")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.autoVim)
          .onChange(async (v) => {
            this.plugin.settings.autoVim = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Open pane on startup')
      .setDesc('Open the NeuroVim pane automatically when Obsidian starts. Off by default — open it anytime via the ribbon icon or the "Open NeuroVim" command.')
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.openPaneOnStartup)
          .onChange(async (v) => {
            this.plugin.settings.openPaneOnStartup = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl).setName('CIPHER uplink (experimental)').setHeading();
    containerEl.createEl('p', {
      text:
        'Ask CIPHER for Vim advice via any OpenAI-compatible endpoint (LM Studio, Ollama, ' +
        'OpenRouter, …). Privacy: your questions plus the active mission\'s metadata ' +
        '(title, category, goal) are sent to the endpoint you configure — never any ' +
        'other vault content. Leave endpoint or model empty to disable the feature.',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('LLM endpoint')
      .setDesc('Base URL, e.g. http://localhost:1234 — a trailing /v1 is handled either way.')
      .addText((t) =>
        t.setPlaceholder('http://localhost:1234')
          .setValue(this.plugin.settings.llmEndpoint)
          .onChange(async (v) => {
            this.plugin.settings.llmEndpoint = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Model')
      .setDesc('Model id to request from the endpoint, e.g. qwen3-8b.')
      .addText((t) =>
        t.setPlaceholder('qwen3-8b')
          .setValue(this.plugin.settings.llmModel)
          .onChange(async (v) => {
            this.plugin.settings.llmModel = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('API key (optional)')
      .setDesc('Bearer token for endpoints that need one. Local servers usually don\'t.')
      .addText((t) => {
        t.inputEl.type = 'password';
        t.setValue(this.plugin.settings.llmApiKey)
          .onChange(async (v) => {
            this.plugin.settings.llmApiKey = v.trim();
            await this.plugin.saveSettings();
          });
      });
  }
}
