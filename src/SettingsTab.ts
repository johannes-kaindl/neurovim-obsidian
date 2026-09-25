import { App, PluginSettingTab, Setting } from 'obsidian';
import type { SettingDefinitionGroup, SettingDefinitionItem } from 'obsidian';
import type NeuroVimPlugin from './main';
import { buildEndpointList, type EndpointListStrings } from './vendor/kit-obsidian/endpoint-list';
import { renderSettingDefinitions, refreshSettingsTab, settingBodyHost } from './vendor/kit-obsidian/settings_walker';
import { createModelListCache } from './vendor/kit/model-list-cache';
import type { EndpointConfig } from './vendor/kit/endpoint_config';
import { buildEndpointSourceSection, findEndpointManager } from './vendor/kit-obsidian/endpoint-source';
import { ENDPOINT_CALLER } from './llm/endpointResolver';
import { normalizeEndpoint } from './vendor/kit/endpoint';
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
  // No global model any more (0.9.0) — the vendored kit still calls this with one (always
  // empty, see the `globalModel` wiring below), hence the unused parameter stays typed but
  // ignored rather than removed.
  emptyModelLabel: () => '— no model set —',
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
  /** Endpoint (by normalized url) resolved to active by the last reconnect() — drives the
   *  row-active highlight, the context line, and `renderThinking`'s effective-model lookup. */
  private activeEndpointUrl: string | null = null;
  /** Context length of the selected model in tokens, null = endpoint doesn't report it. */
  private contextLength: number | null = null;
  /** Model the resolver picked with the active endpoint — the local row's own model, or the
   *  manager's choice/default. Empty while nothing is resolved. */
  private activeModel = '';
  /** One-shot latch for the reconnect() bootstrap in renderEndpointList. buildEndpointList only
   *  reaches reconnect() through its own commit chains (blur, trash, "Use first", preset) — its
   *  "Test all" button just re-renders — so without a kick-off on first render, activeEndpointUrl
   *  and contextLength would stay null until the user happened to edit a row. Reset in hide(),
   *  so the next tab-open probes afresh. */
  private hasReconnectedThisOpen = false;
  // The kit walker bundles every render-hatch cleanup from one renderSettingDefinitions()
  // call into a single function — run it before the next rebuild and on hide().
  private cleanupPrevious: () => void = () => {};

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
    // Both the folder path and the toggle change what the explorer should show — re-derive
    // the adopted stylesheet from the (possibly just-changed) current settings either way.
    if (key === 'missionFolder' || key === 'hideMissionFolder') this.plugin.applyMissionFolderVisibility();
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [this.missionsGroup(), this.appearanceGroup(), this.cipherGroup()];
  }

  private missionsGroup(): SettingDefinitionGroup {
    return { type: 'group', heading: 'Missions', items: [
      { name: 'Mission folder',
        desc: 'Where throwaway mission notes are materialized. Safe to delete anytime — deleting a note or the whole folder loses no progress (XP/best times live in the plugin).',
        control: { type: 'text', key: 'missionFolder', placeholder: '_neurovim/' } },
      { name: 'Hide mission folder',
        desc: 'Hide the mission folder in the file explorer (display only — the folder still exists and still syncs).',
        control: { type: 'toggle', key: 'hideMissionFolder' } },
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
      { name: 'Endpoints', desc: 'Ordered fallback list — the first reachable one is used. Each row sets its own model (and optionally its own API key).', render: this.renderEndpointList },
      { name: 'Context', desc: 'Context window of the selected model.', render: this.renderContext },
      { name: 'Model thinking', desc: 'Whether the model is asked not to think before answering.', render: this.renderThinking },
    ] };
  }

  /** Re-derives the active endpoint through the SAME resolver the CIPHER requests use
   *  (manager first, else the local list, first reachable wins) — no second copy of that
   *  logic just because this caller wants a fresh answer. Refreshes the context-length line
   *  for whatever comes back. Called by buildEndpointList after every save that can change
   *  which endpoint is active, and by the manager section after a choice change. */
  private async reconnect(): Promise<void> {
    const active = await this.plugin.resolveEndpointFresh();
    this.activeEndpointUrl = active ? active.url : null;
    const model = active?.model?.trim() ?? '';
    this.activeModel = model;
    this.contextLength = active && model ? await probeModelContext(active, model) : null;
  }

  // ── Imperative fallback (Obsidian < 1.13) ───────────────────────────────
  // On 1.13+ the host calls getSettingDefinitions() and display() is never called; on
  // ≤1.12 getSettingDefinitions is not a render path, so the host calls display() instead.
  // renderImperative() reads the SAME structure and draws it with the kit's walker (classic
  // Setting API) — one truth, no second definition tree, no second copy of the walker.
  display(): void { this.renderImperative(); }

  private renderImperative(): void {
    // Run last pass's cleanups before tearing the rows down (mirrors the 1.13 framework
    // contract) — a hatch that returned a cleanup must have it invoked before its DOM goes.
    this.cleanupPrevious();
    this.containerEl.empty();
    this.cleanupPrevious = renderSettingDefinitions(this.containerEl, this.getSettingDefinitions(), this, this.app);
  }

  /** Re-render the tab. On 1.13 the declarative framework exposes update(); on the <1.13
   *  fallback that method doesn't exist → renderSettingsTab falls back to renderImperative(). */
  private refreshUi(): void {
    refreshSettingsTab(this, () => this.renderImperative());
  }

  // ── CIPHER render hatches (stateful rows) ────────────────────────────────

  private renderCipherIntro = (setting: Setting): void => {
    const host = settingBodyHost(setting);
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
    const host = settingBodyHost(setting);
    // Bootstrap: buildEndpointList reaches reconnect() ONLY through its own commit chains (url/
    // apiKey/model blur, trash, "Use first", preset) — its "Test all" button merely re-renders.
    // Without this kick-off, a freshly opened tab would leave activeEndpointUrl null (every row
    // reading "Standby — position N" while the kit's own status icons already show them
    // reachable) and contextLength null (blank Context row) until the user edited something.
    // The latch is raised BEFORE the call, not after: the .then() below re-enters this very
    // hatch via refreshUi(). Raise it after that refreshUi() and the re-entry still reads false
    // and starts a second reconnect — measured: two reconnects and four endpoint probes per
    // tab-open instead of one and two. It converges rather than looping forever (the latch does
    // get raised once the first refreshUi() returns), so the symptom is a doubled probe storm on
    // every open, not a hang — quiet enough to survive review, which is why it's pinned here.
    if (!this.hasReconnectedThisOpen) {
      this.hasReconnectedThisOpen = true;
      void this.reconnect().then(() => this.refreshUi());
    }
    buildEndpointSourceSection({
      app: this.app, containerEl: host, capability: 'chat', caller: ENDPOINT_CALLER,
      choice: () => this.plugin.settings.choice,
      setChoice: async (c) => { this.plugin.settings.choice = c; await this.plugin.saveSettings(); await this.reconnect(); },
      local: () => this.plugin.settings.llmEndpoints,
      strings: {
        managed: 'Endpoints come from the LLM Endpoint Manager',
        managedDesc: 'This plugin uses the endpoints configured in the LLM Endpoint Manager plugin. Your local list stays as a fallback.',
        openManager: 'Open manager settings',
        pickEndpoint: 'Endpoint',
        automatic: 'automatic (first reachable)',
        model: 'Model',
        importLocal: 'Copy local endpoints into the manager',
        imported: (r) => `Copied: ${r.added.length} new, ${r.merged.length} merged.`,
        importFailed: 'Copying failed.',
        modelHint: (key) => ENDPOINT_STRINGS.modelHint(key),
        savedSuffix: ENDPOINT_STRINGS.savedSuffix,
        refreshModels: ENDPOINT_STRINGS.refreshModels,
        saveFailed: 'Could not save the endpoint choice.',
      },
      renderLocalList: () => { this.renderLocalEndpointList(host); },
      rerender: () => this.refreshUi(),
    });
  };

  /** The local list editor — only shown while no LLM Endpoint Manager is installed. */
  private renderLocalEndpointList(host: HTMLElement): void {
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
      // probeEndpoint() already returns BOTH status and models in one round trip, so a client
      // handed out here memoizes its single in-flight probe and serves .probe()/.listModels()
      // from it. What that saves is precise: buildEndpointList calls clientFor(cfg) TWICE per row
      // (once for the model-list cache, once for the status icon) and each call gets its own fresh
      // closure — the memo does NOT dedupe across those two. It dedupes INSIDE the cache's load(),
      // which calls listModels() on the client and then, when the list comes back empty, probe()
      // on that same object; without the memo that pair would be two round trips.
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
      // No global model any more (0.9.0) — the vendored kit's EndpointListOptions still
      // requires this callback (obsidian-kit@0.27.0 predates the optional-globalModel
      // change), so it stays wired but always answers empty.
      globalModel: () => '',
      save: () => this.plugin.saveSettings(),
      reconnect: () => this.reconnect(),
      rerender: () => this.refreshUi(),
    });
  }

  private renderContext = (setting: Setting): void => {
    const host = settingBodyHost(setting);
    if (this.contextLength !== null) {
      host.createDiv({
        text: `Context: ${this.contextLength.toLocaleString('en-US')} tokens`,
        cls: 'setting-item-description',
      });
    }
  };

  private renderThinking = (setting: Setting): void => {
    const host = settingBodyHost(setting);
    // The toggle must reason about the model the REQUEST will use: main.ts asks with the
    // active endpoint's own model — there is no global fallback any more (0.9.0). Look the
    // active entry up FRESH in the list (the kit's own applyRole does the same, for the same
    // reason: after a model commit only the list carries the new value) and compare
    // normalized urls, since activeEndpointUrl comes back normalized from the resolver while
    // the stored entry keeps whatever was typed. No active endpoint (nothing reachable, or
    // the probe hasn't landed yet) → no model to reason about.
    // With the manager the model is its choice/default, not a list entry — use what the
    // resolver reported.
    const active = this.plugin.settings.llmEndpoints.find(
      (ep) => normalizeEndpoint(ep.url) === this.activeEndpointUrl,
    );
    const model = findEndpointManager(this.app) ? this.activeModel
      : active?.model?.trim() ?? '';
    const think = thinkToggleState(model, this.plugin.settings.llmSuppressThinking);
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
    // Latch down with the cache: the next tab-open must re-probe which endpoint is active, for
    // the same reason the cache is dropped — the world may have changed while settings were shut.
    this.hasReconnectedThisOpen = false;
    this.cleanupPrevious();
    super.hide();
  }
}
