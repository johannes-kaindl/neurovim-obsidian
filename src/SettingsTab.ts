import { App, PluginSettingTab, Setting } from 'obsidian';
import type { SettingDefinitionGroup, SettingDefinitionItem } from 'obsidian';
import type NeuroVimPlugin from './main';
import { githubHelpUrls, helpSettingDefinition, HELP_SETTING_TEXTS_EN } from './vendor/kit-obsidian/help-setting';
import { installTabRefreshOnOpen, renderSettingDefinitions, settingBodyHost } from './vendor/kit-obsidian/settings_walker';
import { probeModelContext } from './llm/modelContext';

export class NeuroVimSettingTab extends PluginSettingTab {
  /** Context length per `url|model`, null = the endpoint doesn't report it. Lives as long as
   *  the open tab (cleared in hide()): a closed tab may come back to a moved or restarted server. */
  private readonly contextCache = new Map<string, number | null>();
  // The kit walker bundles every render-hatch cleanup from one renderSettingDefinitions()
  // call into a single function — run it before the next rebuild and on hide().
  private cleanupPrevious: () => void = () => {};

  constructor(app: App, private readonly plugin: NeuroVimPlugin) {
    super(app, plugin);
    // "Last request" and the deviation list live in the plugin session, not in the tab — reopen
    // must redraw them, or the section shows the state from when the tab was last built.
    // Installed once for the tab's lifetime and NOT undone in hide(): Obsidian keeps one tab
    // instance per plugin and reopens that same instance, so an uninstall on close would leave
    // every later open without the refresh.
    installTabRefreshOnOpen(this, () => this.renderImperative());
  }

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
    // UI-STANDARD §8 help row: first item, before every heading. This plugin's settings are English
    // only (store plugin, no i18n layer), so the row carries the English texts only.
    return [
      helpSettingDefinition({ ...githubHelpUrls('neurovim-obsidian'), texts: HELP_SETTING_TEXTS_EN }),
      this.missionsGroup(), this.appearanceGroup(), this.cipherGroup(),
    ];
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

  /** The CIPHER uplink section is stateful throughout — every row is a `render` hatch. Endpoint
   *  source, endpoint list and the "Request" section are the kit connection's (`renderSettings`),
   *  drawn in one hatch with a host of its own; the rows' names/descs still feed Obsidian's
   *  settings search. */
  private cipherGroup(): SettingDefinitionGroup {
    return { type: 'group', heading: 'CIPHER uplink (experimental)', items: [
      { name: 'CIPHER uplink', desc: 'Ask CIPHER for Vim advice via any OpenAI-compatible endpoint.', render: this.renderCipherIntro },
      { name: 'Endpoints and request', desc: 'Ordered fallback list — the first reachable one is used; each row sets its own model and optionally its own API key. Below it: what CIPHER sends with each question (sampling values and thinking level, per model family).', render: this.renderConnection },
      { name: 'Context', desc: 'Context window of the selected model.', render: this.renderContext },
    ] };
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

  /** The kit connection draws source, list and request section. `renderSettings` empties its
   *  container when it redraws, so it gets a host of its own — never the tab. */
  private renderConnection = (setting: Setting): void => {
    this.plugin.llm.renderSettings(settingBodyHost(setting).createDiv());
  };

  /** Context window of the model the connection resolves to. The kit draws the endpoint rows in
   *  its own host and does not tell the tab about edits, so this row asks again whenever the tab
   *  redraws (open, or after a setting change) — answers are cached per `url|model`. */
  private renderContext = (setting: Setting): void => {
    const host = settingBodyHost(setting);
    void (async () => {
      const src = await this.plugin.llm.resolve();
      const model = src.sentModel.trim();
      if (src.config === null || model === '') return;
      const key = `${src.config.url}|${model}`;
      if (!this.contextCache.has(key)) this.contextCache.set(key, await probeModelContext(src.config, model));
      const tokens = this.contextCache.get(key) ?? null;
      if (tokens !== null && host.isConnected) {
        host.createDiv({ text: `Context: ${tokens.toLocaleString('en-US')} tokens`, cls: 'setting-item-description' });
      }
    })();
  };

  hide(): void {
    // Drops the connection's model lists: they hold promises and outlive every tab rebuild,
    // so an endpoint that failed one probe would stay "unreachable" for the rest of the session.
    this.plugin.llm.hideSettings();
    this.contextCache.clear();
    this.cleanupPrevious();
    super.hide();
  }
}
