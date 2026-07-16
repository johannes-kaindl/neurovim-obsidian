import { App, PluginSettingTab, Setting } from 'obsidian';
import type NeuroVimPlugin from './main';
import type { HudPlacement } from './hudPlacement';
import { ENDPOINT_PRESETS, validateEndpointInput, type EndpointStatusKind } from './vendor/kit/endpoint_diagnostics';
import { endpointStatusEn, endpointWarningEn } from './llm/endpointText';
import { probeEndpoint } from './llm/endpointProbe';
import { collapsibleSection, type CollapsibleStorage } from './vendor/kit/collapsible';
import { applyEndpointEdit, activeIndexFromStatuses } from './llm/endpointEditor';

export class NeuroVimSettingTab extends PluginSettingTab {
  /** Probe status per endpoint row — index-parallel to settings.llmEndpoints.
   *  `null` = not probed yet. Survives display() re-renders. */
  private statuses: (EndpointStatusKind | null)[] = [];
  /** Models reported by the active (first reachable) endpoint. */
  private models: string[] = [];

  constructor(app: App, private readonly plugin: NeuroVimPlugin) { super(app, plugin); }

  /** Commits a new endpoint list. Any add/remove/replace can shift every later index, so
   *  trying to remap `this.statuses` (probe results, index-parallel to llmEndpoints) across
   *  the change would risk sticking a stale status onto the wrong row. Simplest correct
   *  option: the edit already invalidated those probe results anyway, so reset to
   *  "not probed" rather than guess at a remap. */
  private commitEndpoints(next: string[]): void {
    this.plugin.settings.llmEndpoints = next;
    this.statuses = [];
    void this.plugin.saveSettings().then(() => this.display());
  }

  /** Wires the kit's storage-agnostic collapsible state to our own settings blob. */
  private collapsibleStorage(): CollapsibleStorage {
    return {
      getCollapsed: (key) => this.plugin.settings.uiCollapsed[key],
      setCollapsed: (key, collapsed) => {
        this.plugin.settings.uiCollapsed[key] = collapsed;
        void this.plugin.saveSettings();
      },
    };
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const storage = this.collapsibleStorage();
    const missionsEl = collapsibleSection(containerEl, {
      title: 'Missions', key: 'missions', storage, defaultCollapsed: false,
    });
    const appearanceEl = collapsibleSection(containerEl, { title: 'Appearance', key: 'appearance', storage });
    const cipherEl = collapsibleSection(containerEl, {
      title: 'CIPHER uplink (experimental)', key: 'cipher', storage,
    });

    new Setting(missionsEl)
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

    new Setting(appearanceEl)
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

    new Setting(appearanceEl)
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

    new Setting(missionsEl)
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

    new Setting(missionsEl)
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

    cipherEl.createEl('p', {
      text:
        'Ask CIPHER for Vim advice via any OpenAI-compatible endpoint (LM Studio, Ollama, ' +
        'OpenRouter, …). Privacy: your questions plus the active mission\'s metadata ' +
        '(title, category, goal) are sent to the endpoint you configure — never any ' +
        'other vault content. Leave endpoint or model empty to disable the feature.',
      cls: 'setting-item-description',
    });

    cipherEl.createEl('p', {
      text: 'Endpoints are tried in order — the first reachable one is used. Handy when the '
        + 'same server is localhost at your desk and a LAN IP on the road.',
      cls: 'setting-item-description',
    });

    const rows = [...this.plugin.settings.llmEndpoints, ''];
    rows.forEach((value, index) => {
      const isAdder = index === rows.length - 1;
      const status = isAdder ? null : (this.statuses[index] ?? null);
      const active = activeIndexFromStatuses(this.statuses) === index;

      const row = new Setting(cipherEl)
        .setName(isAdder ? 'Add endpoint' : `Endpoint ${index + 1}${active ? ' — active' : ''}`)
        .addText((t) => {
          t.setPlaceholder('http://localhost:1234').setValue(value);
          // Commit on blur, NOT onChange — onChange fires per keystroke, so the adder
          // would append every intermediate value ("h", "ht", "htt", …) and clearing a
          // row mid-edit would splice it away and shift every later index. Same wiring
          // as vault-crews' editor, for the same reason.
          t.inputEl.addEventListener('blur', () => {
            const next = applyEndpointEdit(this.plugin.settings.llmEndpoints, index, t.getValue(), isAdder);
            const list = this.plugin.settings.llmEndpoints;
            if (next.length === list.length && next.every((e, k) => e === list[k])) return;
            this.commitEndpoints(next);
          });
        });

      if (!isAdder) {
        row.setDesc(status ? endpointStatusEn(status, undefined) : 'Not tested yet.');
        row.descEl.addClass(active ? 'nv-endpoint-active' : 'nv-endpoint-row');
        row.addExtraButton((b) =>
          b.setIcon('trash-2').setTooltip('Remove').onClick(() => {
            this.commitEndpoints(applyEndpointEdit(this.plugin.settings.llmEndpoints, index, '', false));
          }),
        );
        for (const w of validateEndpointInput(value)) {
          row.descEl.createEl('div', { text: `⚠ ${endpointWarningEn(w.rule)}`, cls: 'nv-setting-warning' });
        }
      } else {
        ENDPOINT_PRESETS.forEach((preset) => {
          row.addButton((b) =>
            b.setButtonText(preset.label).setTooltip(`Add ${preset.url}`).onClick(() => {
              this.commitEndpoints(applyEndpointEdit(this.plugin.settings.llmEndpoints, index, preset.url, true));
            }),
          );
        });
      }
    });

    new Setting(cipherEl)
      .setName('Connection')
      .setDesc('Test every endpoint and load the model list from the first reachable one.')
      .addButton((b) =>
        b.setButtonText('Test all').onClick(async () => {
          b.setButtonText('Testing…');
          b.setDisabled(true);
          const results = await Promise.all(
            this.plugin.settings.llmEndpoints.map((ep) => probeEndpoint(ep, this.plugin.settings.llmApiKey)),
          );
          this.statuses = results.map((r) => r.status.kind);
          const active = activeIndexFromStatuses(this.statuses);
          this.models = active >= 0 ? results[active].models : [];
          this.display();
        }),
      );

    const modelSetting = new Setting(cipherEl).setName('Model');
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
        .setDesc('Model id to request from the endpoint, e.g. qwen3-8b — or run "Test all" to pick from a list.')
        .addText((t) =>
          t.setPlaceholder('qwen3-8b')
            .setValue(this.plugin.settings.llmModel)
            .onChange(async (v) => {
              this.plugin.settings.llmModel = v.trim();
              await this.plugin.saveSettings();
            }),
        );
    }

    new Setting(cipherEl)
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
