import { App, PluginSettingTab, Setting } from 'obsidian';
import type NeuroVimPlugin from './main';
import type { HudPlacement } from './hudPlacement';
import { ENDPOINT_PRESETS, validateEndpointInput, type EndpointStatusKind } from './vendor/kit/endpoint_diagnostics';
import { endpointStatusEn, endpointWarningEn } from './llm/endpointText';
import { probeEndpoint } from './llm/endpointProbe';
import { collapsibleSection, type CollapsibleStorage } from './vendor/kit/collapsible';
import { applyEndpointEdit, activeIndexFromStatuses } from './llm/endpointEditor';
import { thinkToggleState } from './llm/thinkToggle';
import { probeModelContext } from './llm/modelContext';

export class NeuroVimSettingTab extends PluginSettingTab {
  /** Probe status per endpoint, keyed by endpoint *value* (its URL) rather than list
   *  position. Add/remove/replace anywhere in the list can shift every later index, but
   *  a value-keyed map means unrelated rows keep their status across such a reshape —
   *  only the row whose value actually changed loses its status (correctly: it's an
   *  unprobed value now). Two identical URLs in the list intentionally share one status
   *  entry — they're the same server. Rendered via a derived index-parallel list (see
   *  `display()`) to match `activeIndexFromStatuses`' index-based contract.
   *  Survives display() re-renders. */
  private statuses: Map<string, EndpointStatusKind> = new Map();
  /** Models reported by the active (first reachable) endpoint. */
  private models: string[] = [];
  /** Context length of the selected model in tokens, null = endpoint doesn't report it. */
  private contextLength: number | null = null;

  constructor(app: App, private readonly plugin: NeuroVimPlugin) { super(app, plugin); }

  /** Commits a new endpoint list. No explicit status reset needed: `statuses` is keyed
   *  by endpoint value, so a removed or replaced entry simply stops resolving to a
   *  status once the index-parallel view is re-derived on the next render. */
  private commitEndpoints(next: string[]): void {
    this.plugin.settings.llmEndpoints = next;
    void this.plugin.saveSettings().then(() => this.display());
  }

  /** Refreshes the context length for the active endpoint + selected model, then
   *  re-renders. The active endpoint is derived the same way `display()` derives it:
   *  `statuses` is keyed by endpoint value, so it's projected to an index-parallel list
   *  before handing it to `activeIndexFromStatuses`' index-based contract. */
  private async refreshContext(): Promise<void> {
    const endpoints = this.plugin.settings.llmEndpoints;
    const statusList = endpoints.map((ep) => this.statuses.get(ep) ?? null);
    const active = activeIndexFromStatuses(statusList);
    const endpoint = active >= 0 ? endpoints[active] : undefined;
    this.contextLength = endpoint && this.plugin.settings.llmModel
      ? await probeModelContext(endpoint, this.plugin.settings.llmApiKey, this.plugin.settings.llmModel)
      : null;
    this.display();
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

    // Derived index-parallel view of the value-keyed status map, for
    // activeIndexFromStatuses' index-based contract and per-row status lookup below.
    const statusList = this.plugin.settings.llmEndpoints.map((ep) => this.statuses.get(ep) ?? null);

    const rows = [...this.plugin.settings.llmEndpoints, ''];
    rows.forEach((value, index) => {
      const isAdder = index === rows.length - 1;
      const status = isAdder ? null : (statusList[index] ?? null);
      const active = activeIndexFromStatuses(statusList) === index;

      const row = new Setting(cipherEl)
        .setName(isAdder ? 'Add endpoint' : `Endpoint ${index + 1}${active ? ' — active' : ''}`)
        .addText((t) => {
          t.setPlaceholder('http://localhost:1234').setValue(value);
          // Commit on blur, NOT onChange — onChange fires per keystroke, so the adder
          // would append every intermediate value ("h", "ht", "htt", …) and clearing a
          // row mid-edit would splice it away and shift every later index. Same wiring
          // as vault-crews' editor, for the same reason.
          t.inputEl.addEventListener('blur', () => {
            // Never reuse the render-time index: commitEndpoints mutates
            // settings.llmEndpoints synchronously but re-renders only after the async
            // save resolves, so another row's blur (e.g. tabbing through fields) can
            // reshape the list before this blur fires. Resolve this row by its
            // render-time value instead; if it's no longer in the list, another commit
            // already dealt with it — just re-render. The adder row is exempt:
            // applyEndpointEdit ignores the index entirely when isAdder is true.
            const list = this.plugin.settings.llmEndpoints;
            const i = isAdder ? list.length : list.indexOf(value);
            if (!isAdder && i === -1) { this.display(); return; }
            const next = applyEndpointEdit(list, i, t.getValue(), isAdder);
            if (next.length === list.length && next.every((e, k) => e === list[k])) return;
            this.commitEndpoints(next);
          });
        });

      if (!isAdder) {
        row.setDesc(status ? endpointStatusEn(status, undefined) : 'Not tested yet.');
        row.descEl.addClass(active ? 'nv-endpoint-active' : 'nv-endpoint-row');
        row.addExtraButton((b) =>
          b.setIcon('trash-2').setTooltip('Remove').onClick(() => {
            // Never reuse the render-time index: a blur commit from another row may have
            // reshaped the list between this row's render and this click. Find the row by
            // value instead; if it's already gone, just re-render.
            const list = this.plugin.settings.llmEndpoints;
            const i = list.indexOf(value);
            if (i === -1) { this.display(); return; }
            this.commitEndpoints(applyEndpointEdit(list, i, '', false));
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
          const endpoints = this.plugin.settings.llmEndpoints;
          const results = await Promise.all(
            endpoints.map((ep) => probeEndpoint(ep, this.plugin.settings.llmApiKey)),
          );
          // Rebuild from scratch, keyed by value — "Test all" freshly probes every
          // current endpoint, so there's nothing to carry over from the old map.
          const nextStatuses = new Map<string, EndpointStatusKind>();
          results.forEach((r, i) => nextStatuses.set(endpoints[i], r.status.kind));
          this.statuses = nextStatuses;
          const statusList = endpoints.map((ep) => nextStatuses.get(ep) ?? null);
          const active = activeIndexFromStatuses(statusList);
          this.models = active >= 0 ? results[active].models : [];
          await this.refreshContext();
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
            await this.refreshContext();
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

    if (this.contextLength !== null) {
      cipherEl.createEl('div', {
        text: `Context: ${this.contextLength.toLocaleString('en-US')} tokens`,
        cls: 'setting-item-description',
      });
    }

    const think = thinkToggleState(this.plugin.settings.llmModel, this.plugin.settings.llmSuppressThinking);
    new Setting(cipherEl)
      .setName('Model thinking')
      .setDesc(think.desc)
      .addToggle((t) =>
        t
          .setValue(!this.plugin.settings.llmSuppressThinking)
          .setDisabled(think.disabled)
          .onChange(async (v) => {
            this.plugin.settings.llmSuppressThinking = !v;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

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
