import { App, PluginSettingTab, Setting } from 'obsidian';
import type { SettingControl, SettingDefinition, SettingDefinitionGroup, SettingDefinitionItem } from 'obsidian';
import type NeuroVimPlugin from './main';
import { buildEndpointList, type EndpointListStrings } from './vendor/kit-obsidian/endpoint-list';
import { createModelListCache } from './vendor/kit/model-list-cache';
import { effectiveModel, resolveActiveEndpointConfig, type EndpointConfig } from './vendor/kit/endpoint_config';
import type { EndpointStatus } from './vendor/kit/endpoint_diagnostics';
import { endpointStatusEn, endpointWarningEn } from './llm/endpointText';
import { probeEndpoint } from './llm/endpointProbe';
import { thinkToggleState } from './llm/thinkToggle';
import { probeModelContext } from './llm/modelContext';

/** Every user-visible string of the kit's endpoint-list editor. The kit deliberately
 *  phrases nothing itself — wording and language belong to the consumer. */
const ENDPOINT_STRINGS: EndpointListStrings = {
  addPlaceholder: 'http://localhost:1234',
  apiKeyPlaceholder: 'API key (optional)',
  modelPlaceholder: 'qwen3-8b',
  ariaUrl: 'Endpoint URL',
  ariaAdd: 'Add endpoint URL',
  ariaApiKey: (url) => `API key for ${url}`,
  ariaModel: (url) => `Model override for ${url}`,
  emptyModelLabel: (globalModel) => `— use global model${globalModel ? ` (${globalModel})` : ''} —`,
  modelHint: (key) => (key === 'unreachable' ? 'Endpoint unreachable — last known value shown.'
    : key === 'no-list' ? 'Endpoint doesn’t report a model list — type the model id.' : ''),
  savedSuffix: '(saved)',
  refreshModels: 'Refresh model list',
  moveToFront: 'Use first',
  remove: 'Remove',
  thirdParty: 'This endpoint has an API key — requests leave your machine.',
  probing: 'Testing…',
  statusTooltip: (status) => endpointStatusEn(status.kind, status.raw),
  role: (role) => (role.kind === 'active' ? 'Active'
    : role.kind === 'unreachable' ? 'Unreachable'
    : role.kind === 'skipped-model' ? 'Reachable, but skipped (model mismatch)'
    : `Standby — position ${role.position}`),
  warnings: (ws) => ws.map((w) => endpointWarningEn(w.rule)).join(' · '),
  presetTooltip: (preset) => `Add ${preset.url}`,
  presetLabel: (preset) => preset.label,
  checkConnection: 'Test all',
  saveFailed: 'Could not save — settings reverted, try again.',
};

export class NeuroVimSettingTab extends PluginSettingTab {
  /** Model lists per endpoint + generation counter. Belongs to the lifetime of the
   *  settings tab (survives every rebuild) — cleared in hide(). */
  private readonly modelCache = createModelListCache();
  /** Endpoint (by normalized url) resolved to active by the last buildEndpointList reconnect —
   *  drives both `renderContext`'s active-endpoint lookup and the row-active highlight. */
  private activeEndpointUrl: string | null = null;
  /** Context length of the selected model in tokens, null = endpoint doesn't report it. */
  private contextLength: number | null = null;
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
    // A text control hands back a string; store a non-negative number and fall back to the
    // default on anything unparseable rather than writing NaN into data.json.
    else if (key === 'pausedBannerMinutes') {
      const n = Number.parseInt(String(value), 10);
      s.pausedBannerMinutes = Number.isFinite(n) && n >= 0 ? n : 5;
    }
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
      { name: 'Paused reminder after',
        desc: 'Minutes a mission may stay paused before a floating reminder appears over the workspace. A paused mission always shows in the status bar; this is the extra nudge. Set to 0 to disable it.',
        control: { type: 'text', key: 'pausedBannerMinutes', placeholder: '5' } },
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
   *  is a `render` hatch. The endpoint editor itself is the kit's `buildEndpointList`;
   *  the rows' names/descs still feed Obsidian's settings search. */
  private cipherGroup(): SettingDefinitionGroup {
    return { type: 'group', heading: 'CIPHER uplink (experimental)', items: [
      { name: 'CIPHER uplink', desc: 'Ask CIPHER for Vim advice via any OpenAI-compatible endpoint.', render: this.renderCipherIntro },
      { name: 'Endpoints', desc: 'Ordered fallback list — the first reachable one is used. Each row may set its own API key and model override.', render: this.renderEndpointList },
      { name: 'Context', desc: 'Context window of the selected model.', render: this.renderContext },
      { name: 'Model thinking', desc: 'Whether the model is asked not to think before answering.', render: this.renderThinking },
    ] };
  }

  /** Re-derives the active endpoint from the current list via the SAME kit primitive
   *  EndpointResolver uses (first reachable wins) — no reason to hand-roll a second copy of
   *  that loop just because this caller doesn't want caching. Refreshes the context-length
   *  line for whatever comes back. Called by buildEndpointList after every save that can
   *  change which endpoint is active. */
  private async reconnect(): Promise<void> {
    const active = await resolveActiveEndpointConfig(
      this.plugin.settings.llmEndpoints,
      (cfg) => probeEndpoint(cfg).then((r) => r.status.reachable),
    );
    this.activeEndpointUrl = active ? active.url : null;
    const model = active ? effectiveModel(active, this.plugin.settings.llmModel) : '';
    this.contextLength = active && model ? await probeModelContext(active, model) : null;
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
      const action = def.action;
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

  private renderEndpointList = (setting: Setting): void => {
    const host = this.hostFor(setting);
    buildEndpointList({
      containerEl: host,
      label: 'Endpoints',
      desc: 'Ordered fallback list — the first reachable one is used.',
      placeholder: 'http://localhost:1234',
      strings: ENDPOINT_STRINGS,
      cache: this.modelCache,
      get: () => this.plugin.settings.llmEndpoints,
      set: (eps) => { this.plugin.settings.llmEndpoints = eps; },
      active: () => this.activeEndpointUrl,
      // probeEndpoint() already returns BOTH status and models in one round trip. buildEndpointList
      // calls .probe() (status icon) and .listModels() (model dropdown, via the cache) as two
      // separate calls on the object this factory returns — without memoizing here, each row would
      // hit the network twice for what is actually one probe. clientFor(cfg) is called once per row
      // per render, so a closure-scoped memo is enough; no need for anything longer-lived.
      clientFor: (cfg: EndpointConfig) => {
        let inFlight: ReturnType<typeof probeEndpoint> | null = null;
        const probeOnce = (): ReturnType<typeof probeEndpoint> => (inFlight ??= probeEndpoint(cfg));
        return {
          // Return type spelled out on purpose: `clientFor`'s declared type is an INTERSECTION
          // of two `probe()` signatures ({ probe(): Promise<EndpointStatus> } & ModelListClient,
          // whose probe() only promises { reachable }). Contextually typing an object literal
          // against that intersection makes TS infer .then()'s result as the UNION of both
          // returns, which then satisfies neither member. The kit's own callers hand back class
          // instances (vault-rag: ChatClient/EmbeddingClient) whose declared methods sidestep
          // this; a literal has to say which one it means.
          probe: (): Promise<EndpointStatus> => probeOnce().then((r) => r.status),
          listModels: (): Promise<string[]> => probeOnce().then((r) => r.models),
        };
      },
      globalModel: () => this.plugin.settings.llmModel,
      save: () => this.plugin.saveSettings(),
      reconnect: () => this.reconnect(),
      rerender: () => this.refreshUi(),
    });
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

  hide(): void {
    // Mandatory per the kit's MIGRATION.md: the model-list cache holds promises and
    // deliberately outlives every tab rebuild. Without clearing it here, an endpoint that
    // failed one probe stays "unreachable" for the rest of the session — a user who then
    // starts their LLM server and reopens settings would keep seeing the stale state.
    this.modelCache.clear();
    this.runRowCleanups();
    super.hide();
  }
}
