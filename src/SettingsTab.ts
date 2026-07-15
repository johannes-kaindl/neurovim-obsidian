import { App, PluginSettingTab, Setting } from 'obsidian';
import type NeuroVimPlugin from './main';
import type { HudPlacement } from './hudPlacement';
import { ENDPOINT_PRESETS, validateEndpointInput } from './vendor/kit/endpoint_diagnostics';
import { endpointStatusEn, endpointWarningEn } from './llm/endpointText';
import { probeEndpoint } from './llm/endpointProbe';

export class NeuroVimSettingTab extends PluginSettingTab {
  /** Result of the last "Test connection" run — survives display() re-renders. */
  private probeText: string | null = null;
  private probeOk = false;
  private models: string[] = [];

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

    let warningsEl: HTMLElement;
    const renderWarnings = (): void => {
      warningsEl.empty();
      for (const w of validateEndpointInput(this.plugin.settings.llmEndpoint)) {
        warningsEl.createEl('div', { text: `⚠ ${endpointWarningEn(w.rule)}`, cls: 'nv-setting-warning' });
      }
    };

    const endpointSetting = new Setting(containerEl)
      .setName('LLM endpoint')
      .setDesc('Base URL, e.g. http://localhost:1234 — a trailing /v1 is handled either way.')
      .addText((t) =>
        t.setPlaceholder('http://localhost:1234')
          .setValue(this.plugin.settings.llmEndpoint)
          .onChange(async (v) => {
            this.plugin.settings.llmEndpoint = v.trim();
            renderWarnings();
            await this.plugin.saveSettings();
          }),
      );
    ENDPOINT_PRESETS.forEach((preset) => {
      endpointSetting.addButton((b) =>
        b.setButtonText(preset.label)
          .setTooltip(`Use ${preset.url}`)
          .onClick(async () => {
            this.plugin.settings.llmEndpoint = preset.url;
            await this.plugin.saveSettings();
            this.display();
          }),
      );
    });
    warningsEl = containerEl.createEl('div', { cls: 'nv-setting-warnings' });
    renderWarnings();

    new Setting(containerEl)
      .setName('Connection')
      .setDesc('Check the endpoint and load its model list.')
      .addButton((b) =>
        b.setButtonText('Test connection').onClick(async () => {
          b.setButtonText('Testing…');
          b.setDisabled(true);
          const r = await probeEndpoint(this.plugin.settings.llmEndpoint, this.plugin.settings.llmApiKey);
          this.probeOk = r.status.reachable;
          this.probeText = endpointStatusEn(r.status.kind, r.status.raw)
            + (r.models.length ? ` ${r.models.length} models found.` : '');
          this.models = r.models;
          this.display();
        }),
      );
    if (this.probeText !== null) {
      containerEl.createEl('div', {
        text: `${this.probeOk ? '✓' : '✗'} ${this.probeText}`,
        cls: `nv-setting-probe ${this.probeOk ? 'is-ok' : 'is-bad'}`,
      });
    }

    const modelSetting = new Setting(containerEl).setName('Model');
    if (this.models.length > 0) {
      modelSetting
        .setDesc('Pick one of the models the endpoint reports.')
        .addDropdown((d) => {
          const current = this.plugin.settings.llmModel;
          if (current && !this.models.includes(current)) d.addOption(current, `${current} (saved)`);
          for (const id of this.models) d.addOption(id, id);
          d.setValue(current || this.models[0]);
          // A dropdown has no empty state: adopt the shown value so the visible
          // selection and the saved setting can't drift apart.
          if (!current) {
            this.plugin.settings.llmModel = this.models[0];
            void this.plugin.saveSettings();
          }
          d.onChange(async (v) => {
            this.plugin.settings.llmModel = v;
            await this.plugin.saveSettings();
          });
        });
    } else {
      modelSetting
        .setDesc('Model id to request from the endpoint, e.g. qwen3-8b — or run "Test connection" to pick from a list.')
        .addText((t) =>
          t.setPlaceholder('qwen3-8b')
            .setValue(this.plugin.settings.llmModel)
            .onChange(async (v) => {
              this.plugin.settings.llmModel = v.trim();
              await this.plugin.saveSettings();
            }),
        );
    }

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
