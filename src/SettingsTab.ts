import { App, PluginSettingTab, Setting } from 'obsidian';
import type { SettingControl, SettingDefinition, SettingDefinitionGroup, SettingDefinitionItem } from 'obsidian';
import type NeuroVimPlugin from './main';
import type { HudPlacement } from './hudPlacement';
import { ENDPOINT_PRESETS, validateEndpointInput, type EndpointStatusKind } from './vendor/kit/endpoint_diagnostics';
import { endpointStatusEn, endpointWarningEn } from './llm/endpointText';
import { probeEndpoint } from './llm/endpointProbe';
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
   *  `renderEndpoints()`) to match `activeIndexFromStatuses`' index-based contract.
   *  Survives re-renders. */
  private statuses: Map<string, EndpointStatusKind> = new Map();
  /** Models reported by the active (first reachable) endpoint. */
  private models: string[] = [];
  /** Context length of the selected model in tokens, null = endpoint doesn't report it. */
  private contextLength: number | null = null;
  /** Bumped by every commitEndpoints() call. Async probes (refreshContext, "Test all")
   *  capture this before their await and compare it after: if it moved, the endpoint
   *  list was edited while the probe was in flight, so the result is for a configuration
   *  that no longer exists and must be discarded rather than written back. */
  private endpointGeneration = 0;
  // Cleanup functions a render-hatch may return (the declarative render contract; on 1.13
  // the framework runs them before tearing a row down). The imperative fallback must honor
  // the same contract — runRowCleanups() runs them before each rebuild and on hide().
  private rowCleanups: Array<() => void> = [];

  constructor(app: App, private readonly plugin: NeuroVimPlugin) { super(app, plugin); }

  // ── Declarative settings API (Obsidian 1.13) ────────────────────────────
  // One truth for both render paths: getSettingDefinitions() returns the structure; simple
  // rows are `control` defs read/written via get/setControlValue (with coercion), the
  // stateful CIPHER rows are `render` hatches that keep the original imperative logic.

  getControlValue(key: string): unknown {
    const s = this.plugin.settings as unknown as Record<string, unknown>;
    // colorScheme is stored as 'crt' | 'native' but surfaced as a toggle (crt = on) — the
    // rest of the plugin reads the string directly, only this control view is boolean.
    if (key === 'colorScheme') return this.plugin.settings.colorScheme === 'crt';
    return s[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const s = this.plugin.settings as unknown as Record<string, unknown>;
    if (key === 'colorScheme') s.colorScheme = (value as boolean) ? 'crt' : 'native';
    // An empty mission folder falls back to the default rather than materializing notes at
    // the vault root — same coercion the old onChange did inline.
    else if (key === 'missionFolder') s.missionFolder = (value as string).trim() || '_neurovim/';
    else s[key] = value;
    await this.plugin.saveSettings();
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [this.missionsGroup(), this.appearanceGroup(), this.cipherGroup()];
  }

  private missionsGroup(): SettingDefinitionGroup {
    return { type: 'group', heading: 'Missions', items: [
      { name: 'Mission folder',
        desc: 'Where throwaway mission notes are materialized. Safe to delete anytime — deleting a note or the whole folder loses no progress (XP/best times live in the plugin).',
        control: { type: 'text', key: 'missionFolder', placeholder: '_neurovim/' } },
      { name: 'Auto Vim mode',
        desc: "Turn Obsidian's Vim mode on while a mission is active and restore your previous setting when it ends. Changes your global editor Vim setting for the duration.",
        control: { type: 'toggle', key: 'autoVim' } },
      { name: 'Open pane on startup',
        desc: 'Open the NeuroVim pane automatically when Obsidian starts. Off by default — open it anytime via the ribbon icon or the "Open NeuroVim" command.',
        control: { type: 'toggle', key: 'openPaneOnStartup' } },
      { name: 'Record run traces',
        desc: 'Save the keystroke sequence of each successful mission to a local file (traces.jsonl in the plugin folder). Powers CIPHER debriefs and offline balance analysis. Stored locally, never sent automatically. On by default.',
        control: { type: 'toggle', key: 'recordTraces' } },
    ] };
  }

  private appearanceGroup(): SettingDefinitionGroup {
    return { type: 'group', heading: 'Appearance', items: [
      { name: 'HUD placement',
        desc: 'Where mission-control (timer, submit/reset/abort) appears during a mission. The floating box can also be dismissed per mission with its × button.',
        control: { type: 'dropdown', key: 'hudPlacement', options: {
          auto: 'Auto — sidebar when open, else floating box',
          sidebar: 'Sidebar only',
          box: 'Floating box only',
        } } },
      { name: 'CRT color scheme',
        desc: 'On: fixed cyberpunk look (dark background, phosphor green) — theme-independent, always legible. Off: adaptive Obsidian-theme colors that blend into your light/dark theme.',
        control: { type: 'toggle', key: 'colorScheme' } },
    ] };
  }

  /** The CIPHER uplink section is stateful throughout (async endpoint probing, dynamic
   *  model dropdown, model-coupled context line, forced thinking toggle) — every row here
   *  is a `render` hatch that keeps the original imperative logic intact. Their names/descs
   *  still feed Obsidian's settings search. */
  private cipherGroup(): SettingDefinitionGroup {
    return { type: 'group', heading: 'CIPHER uplink (experimental)', items: [
      { name: 'CIPHER uplink', desc: 'Ask CIPHER for Vim advice via any OpenAI-compatible endpoint.', render: this.renderCipherIntro },
      { name: 'Endpoints', desc: 'Ordered fallback list — the first reachable one is used.', render: this.renderEndpoints },
      { name: 'Connection', desc: 'Test every endpoint and load the model list from the first reachable one.', render: this.renderConnection },
      { name: 'Model', desc: 'Pick or type the model id to request from the endpoint.', render: this.renderModel },
      { name: 'Context', desc: 'Context window of the selected model.', render: this.renderContext },
      { name: 'Model thinking', desc: 'Whether the model is asked not to think before answering.', render: this.renderThinking },
      { name: 'API key (optional)', desc: 'Bearer token for endpoints that need one. Local servers usually don\'t.', render: this.renderApiKey },
    ] };
  }

  /** Commits a new endpoint list. No explicit status reset needed: `statuses` is keyed
   *  by endpoint value, so a removed or replaced entry simply stops resolving to a
   *  status once the index-parallel view is re-derived on the next render.
   *  `models` and `contextLength`, however, are stale the moment the list changes:
   *  both were probed against whichever endpoint used to be active, and any edit here
   *  (blur commit, trash, preset) can change which endpoint that is or remove it
   *  outright. Since neither is keyed by endpoint value, they must be cleared rather
   *  than carried over — otherwise the UI would keep showing a model list and a context
   *  token count for a configuration that no longer exists. */
  private commitEndpoints(next: string[]): void {
    this.plugin.settings.llmEndpoints = next;
    this.models = [];
    this.contextLength = null;
    this.endpointGeneration++;
    void this.plugin.saveSettings().then(() => this.refreshUi());
  }

  /** Refreshes the context length for the active endpoint + selected model, then
   *  re-renders. The active endpoint is derived the same way `renderEndpoints()` derives it:
   *  `statuses` is keyed by endpoint value, so it's projected to an index-parallel list
   *  before handing it to `activeIndexFromStatuses`' index-based contract. */
  private async refreshContext(): Promise<void> {
    // Captured before the await below: if commitEndpoints() runs while probeModelContext
    // is in flight (a row edited or removed mid-probe), the generation moves and the
    // result we're about to get back describes an endpoint/model pairing that's already
    // gone. commitEndpoints() already cleared contextLength and re-rendered, so in that
    // case we discard the late result instead of writing stale data back over it.
    // The model is captured alongside it for the same reason: endpointGeneration only
    // bumps on endpoint-list edits, not on a plain model-dropdown switch, so a second
    // refreshContext() for a different model wouldn't move it. Without also comparing
    // the model, a slow first probe (e.g. an LM Studio timeout followed by an Ollama
    // fallback) could resolve after a faster second probe for a different model and
    // overwrite that model's correct result with a value that belongs to neither the
    // dropdown's current selection nor llmModel.
    const generation = this.endpointGeneration;
    const model = this.plugin.settings.llmModel;
    const endpoints = this.plugin.settings.llmEndpoints;
    const statusList = endpoints.map((ep) => this.statuses.get(ep) ?? null);
    const active = activeIndexFromStatuses(statusList);
    const endpoint = active >= 0 ? endpoints[active] : undefined;
    const contextLength = endpoint && model
      ? await probeModelContext(endpoint, this.plugin.settings.llmApiKey, model)
      : null;
    if (generation !== this.endpointGeneration || this.plugin.settings.llmModel !== model) return;
    this.contextLength = contextLength;
    this.refreshUi();
  }

  // ── Imperative fallback (Obsidian < 1.13) ───────────────────────────────
  // On 1.13+ the host calls getSettingDefinitions() and display() is never called; on
  // ≤1.12 getSettingDefinitions is not a render path, so the host calls display() instead.
  // renderImperative() reads the SAME structure and draws it with the classic Setting API —
  // one truth, no second definition tree.
  display(): void { this.renderImperative(); }

  private renderImperative(): void {
    // Run last pass's cleanups before tearing the rows down (mirrors the 1.13 framework
    // contract) — a hatch that returned a cleanup must have it invoked before its DOM goes.
    this.runRowCleanups();
    this.containerEl.empty();
    for (const item of this.getSettingDefinitions()) this.renderDefinitionItem(this.containerEl, item);
  }

  /** Runs and clears all collected row cleanups, guarded so one throwing cleanup can't
   *  abort the rest (which would leave later rows leaking or the old UI duplicated). */
  private runRowCleanups(): void {
    for (const c of this.rowCleanups) {
      try { c(); } catch { /* cleanup is best-effort — one failure must not block the rest */ }
    }
    this.rowCleanups = [];
  }

  /** Re-render the tab. On 1.13 the declarative framework exposes update(); on the <1.13
   *  fallback that method doesn't exist → run renderImperative() again. The cast to an
   *  anonymous type keeps `obsidianmd/no-unsupported-api` blind to SettingTab.update (1.13-only). */
  private refreshUi(): void {
    const self = this as unknown as { update?: () => void };
    if (typeof self.update === 'function') self.update();
    else this.renderImperative();
  }

  private renderDefinitionItem(containerEl: HTMLElement, item: SettingDefinitionItem): void {
    if ((item as SettingDefinitionGroup).type === 'group') {
      const g = item as SettingDefinitionGroup;
      if (g.heading) new Setting(containerEl).setName(g.heading).setHeading();
      for (const sub of g.items ?? []) this.renderDefinitionItem(containerEl, sub);
      return;
    }
    const def = item as SettingDefinition & { render?: unknown; action?: unknown; control?: SettingControl };
    const s = new Setting(containerEl);
    if (def.name) s.setName(def.name);
    if (def.desc) s.setDesc(def.desc);
    if (typeof def.render === 'function') {
      const cleanup = (def.render as (s: Setting) => void | (() => void))(s);
      if (typeof cleanup === 'function') this.rowCleanups.push(cleanup);
      return;
    }
    if (typeof def.action === 'function') {
      const action = def.action as (el: HTMLElement, index: number) => void;
      s.addButton((b) => b.setButtonText(def.name).onClick(() => action(s.settingEl, 0)));
      return;
    }
    if (def.control) this.renderControl(s, def.name, def.control);
    // empty: name/desc only (already set)
  }

  /** Draws a single declarative control with the classic Setting API (fallback path). */
  private renderControl(s: Setting, name: string, c: SettingControl): void {
    const key = c.key;
    const cur = this.getControlValue(key);
    const save = (v: unknown): void => { void this.setControlValue(key, v); };
    switch (c.type) {
      case 'toggle':
        s.addToggle((t) => t.setValue(cur as boolean).onChange(save));
        break;
      case 'dropdown':
        s.addDropdown((d) => { for (const [k, v] of Object.entries(c.options)) d.addOption(k, v); d.setValue(cur as string).onChange(save); });
        break;
      case 'text':
      default:
        s.addText((t) => t.setPlaceholder((c as { placeholder?: string }).placeholder ?? '').setValue(cur as string).onChange(save));
        break;
    }
  }

  /** Turns the Setting row the API hands us into a neutral block container: render hatches
   *  that draw several rows must not sit inside the two-column .setting-item. Empties
   *  settingEl → the hatch redraws any name/desc it needs. */
  private hostFor(setting: Setting): HTMLElement {
    setting.settingEl.empty();
    setting.settingEl.removeClass('setting-item');
    return setting.settingEl;
  }

  // ── CIPHER render hatches (stateful rows) ────────────────────────────────

  private renderCipherIntro = (setting: Setting): void => {
    const host = this.hostFor(setting);
    host.createEl('p', {
      text:
        'Ask CIPHER for Vim advice via any OpenAI-compatible endpoint (LM Studio, Ollama, ' +
        'OpenRouter, …). Privacy: your questions plus the active mission\'s metadata ' +
        '(title, category, goal) are sent to the endpoint you configure — never any ' +
        'other vault content. Leave endpoint or model empty to disable the feature.',
      cls: 'setting-item-description',
    });
    host.createEl('p', {
      text: 'Endpoints are tried in order — the first reachable one is used. Handy when the '
        + 'same server is localhost at your desk and a LAN IP on the road.',
      cls: 'setting-item-description',
    });
  };

  private renderEndpoints = (setting: Setting): void => {
    const cipherEl = this.hostFor(setting);

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
            if (!isAdder && i === -1) { this.refreshUi(); return; }
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
            if (i === -1) { this.refreshUi(); return; }
            this.commitEndpoints(applyEndpointEdit(list, i, '', false));
          }),
        );
        for (const w of validateEndpointInput(value)) {
          row.descEl.createDiv({ text: `⚠ ${endpointWarningEn(w.rule)}`, cls: 'nv-setting-warning' });
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
  };

  private renderConnection = (setting: Setting): void => {
    const host = this.hostFor(setting);
    new Setting(host)
      .setName('Connection')
      .setDesc('Test every endpoint and load the model list from the first reachable one.')
      .addButton((b) =>
        b.setButtonText('Test all').onClick(async () => {
          b.setButtonText('Testing…');
          b.setDisabled(true);
          // Captured before the await below, same reasoning as refreshContext(): if the
          // endpoint list is edited while these probes (up to 5s each, 10s for an Ollama
          // fallback) are in flight, commitEndpoints() has already cleared/re-rendered
          // state for the new list, and writing these results in on top would resurrect
          // stale data for endpoints that no longer apply.
          const generation = this.endpointGeneration;
          const endpoints = this.plugin.settings.llmEndpoints;
          const results = await Promise.all(
            endpoints.map((ep) => probeEndpoint(ep, this.plugin.settings.llmApiKey)),
          );
          if (generation !== this.endpointGeneration) return;
          // Rebuild from scratch, keyed by value — "Test all" freshly probes every
          // current endpoint, so there's nothing to carry over from the old map.
          const nextStatuses = new Map<string, EndpointStatusKind>();
          results.forEach((r, i) => nextStatuses.set(endpoints[i], r.status.kind));
          this.statuses = nextStatuses;
          const statusList = endpoints.map((ep) => nextStatuses.get(ep) ?? null);
          const active = activeIndexFromStatuses(statusList);
          this.models = active >= 0 ? results[active].models : [];
          // refreshContext() re-captures the generation itself at this point, so its own
          // guard checks against edits made during *its* await, not this one.
          await this.refreshContext();
        }),
      );
  };

  private renderModel = (setting: Setting): void => {
    const host = this.hostFor(setting);
    const modelSetting = new Setting(host).setName('Model');
    if (this.models.length > 0) {
      modelSetting
        .setDesc('Pick one of the models the endpoint reports.')
        .addDropdown((d) => {
          const current = this.plugin.settings.llmModel;
          if (current && !this.models.includes(current)) d.addOption(current, `${current} (saved)`);
          for (const id of this.models) d.addOption(id, id);
          d.setValue(current || this.models[0]);
          // A dropdown has no empty state: adopt the shown value so the visible
          // selection and the saved setting can't drift apart. Also (re-)probe context
          // length for the adopted model: on a fresh config, "Test all" ran refreshContext()
          // before llmModel was set, so it probed with an empty model and left
          // contextLength null. Without this, the context line would never appear until a
          // second "Test all" or a manual dropdown change. Safe from a render loop:
          // refreshContext() ends in refreshUi(), but by then `current` is the just-adopted
          // model, so this branch doesn't fire again on that re-render.
          if (!current) {
            this.plugin.settings.llmModel = this.models[0];
            void this.plugin.saveSettings();
            void this.refreshContext();
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
  };

  private renderContext = (setting: Setting): void => {
    const host = this.hostFor(setting);
    if (this.contextLength !== null) {
      host.createDiv({
        text: `Context: ${this.contextLength.toLocaleString('en-US')} tokens`,
        cls: 'setting-item-description',
      });
    }
  };

  private renderThinking = (setting: Setting): void => {
    const host = this.hostFor(setting);
    const think = thinkToggleState(this.plugin.settings.llmModel, this.plugin.settings.llmSuppressThinking);
    new Setting(host)
      .setName('Model thinking')
      .setDesc(think.desc)
      .addToggle((t) =>
        t
          // When disabled, the model always thinks regardless of llmSuppressThinking (see
          // effectiveSuppress) — force the switch to ON so its position matches actual
          // request behaviour instead of echoing a suppress flag the request ignores.
          .setValue(think.disabled || !this.plugin.settings.llmSuppressThinking)
          .setDisabled(think.disabled)
          .onChange(async (v) => {
            this.plugin.settings.llmSuppressThinking = !v;
            await this.plugin.saveSettings();
            this.refreshUi();
          }),
      );
  };

  private renderApiKey = (setting: Setting): void => {
    const host = this.hostFor(setting);
    new Setting(host)
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
  };

  hide(): void {
    this.runRowCleanups();
    super.hide();
  }
}
