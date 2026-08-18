import { Plugin, Notice, MarkdownView } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { loadPluginData } from './storage/loadPluginData';
import { ObsidianStorage } from './storage/ObsidianStorage';
import { BundledContent } from './content/BundledContent';
import { MissionSession } from './MissionSession';
import { ObsidianMissionApp } from './ObsidianMissionApp';
import { HubView, VIEW_TYPE_NEUROVIM } from './HubView';
import { HudMount, type HudActive, type HudRenderProps } from './HudMount';
import { ObsidianHudDom } from './ObsidianHudDom';
import { resolveHudTarget } from './hudPlacement';
import { diffHighlightField, showDivergentLines, clearHighlight } from './diffHighlight';
import { resolvePresence } from './missionPresence';
import { shouldShowPausedBanner, type LineProgress } from './missionProgress';
import { StatusBarItem } from './StatusBarItem';
import { PausedBanner } from './PausedBanner';
import { isMissionEditorKeystroke } from './keystrokeCounter';
import { NeuroVimSettingTab } from './SettingsTab';
import { buildResultView } from './result/resultView';
import { ResultModal } from './result/ResultModal';
import { BriefingModal } from './briefing/BriefingModal';
import { LoreModal } from './lore/LoreModal';
import { CipherClient } from './llm/CipherClient';
import { XhrSseTransport } from './llm/XhrSseTransport';
import { CorePortAdapter } from './llm/CorePortAdapter';
import { EndpointResolver } from './llm/endpointResolver';
import { probeEndpoint } from './llm/endpointProbe';
import { effectiveModel, type EndpointConfig } from './vendor/kit/endpoint_config';
import { DEFAULT_SETTINGS, isLlmConfigured, mergeStoredSettings, type VimDojoSettings } from './settings';
import {
  buildRunTrace, TraceStore, CipherUplink, ChatSession, buildKnowledge, quickReference,
  type RunTrace, type LlmResult, type MissionContext,
} from '@neurovim/core';
import { ENTRIES } from '@neurovim/content';
import { realClock } from './vendor/kit-obsidian/clock';
import type { HubTab } from './hubTabs';
import type { PluginData, MissionSummary } from '@neurovim/core';

/** data.json blob = PluginData plus our settings under a reserved key. */
type StoredBlob = Partial<PluginData> & { __settings?: Partial<VimDojoSettings> };

export default class NeuroVimPlugin extends Plugin {
  settings: VimDojoSettings = { ...DEFAULT_SETTINGS };
  private storage!: ObsidianStorage;
  private data!: PluginData;
  private content = new BundledContent();
  private missions: MissionSummary[] = [];
  private session!: MissionSession;
  private hud!: HudMount;
  private statusBar!: StatusBarItem;
  private banner!: PausedBanner;
  /** Lines reported divergent by the last failed submit. The live highlight is the
   *  intersection of these with the currently divergent ones, so a corrected line clears
   *  immediately while never revealing a line the player has not submitted against yet. */
  private revealedLines: number[] = [];
  /** Last known line progress; kept when the note is closed so the HUD does not flicker. */
  private progress: LineProgress | null = null;
  /** Line set currently dispatched to the editor, so the 500ms tick only sends a CM6
   *  transaction when the highlight actually changed — the player is typing in that
   *  editor, and a redundant dispatch twice a second is pure noise. */
  private highlighted = '';
  private boxDismissed = false;
  /** Hint text for the first divergent line — set on failed submit, cleared on success/reset. */
  private hint: string | null = null;
  private vimRestore: boolean | null = null;
  private tick: number | null = null;
  private cipherSession = new ChatSession();
  private cipherClient = new CipherClient(new XhrSseTransport());
  private traceStore: TraceStore | null = null;
  private cipherUplink: CipherUplink | null = null;
  private endpointResolver = new EndpointResolver(
    () => this.settings.llmEndpoints,
    async (cfg) => (await probeEndpoint(cfg)).status.reachable,
  );
  /** Active hub tab + guide search query — session-local UI state, not persisted. */
  private hubTab: HubTab = 'nexus';
  private guideQuery = '';

  async onload(): Promise<void> {
    this.storage = new ObsidianStorage(this);
    const blob = (await this.loadData()) as StoredBlob | null;
    // mergeStoredSettings migrates the 0.4.x `llmEndpoint` field into `llmEndpoints` and
    // drops it — the legacy field is neither read nor written after this point. See
    // src/settings.ts for why a plain spread of the raw blob would resurrect it.
    this.settings = mergeStoredSettings(blob?.__settings);
    this.data = await loadPluginData(this.storage);
    this.missions = await this.content.listMissions();

    this.session = new MissionSession({
      app: new ObsidianMissionApp(this.app),
      content: this.content,
      getFolder: () => this.settings.missionFolder,
      getData: () => this.data,
      setData: async (d) => { this.data = d; await this.persist(); },
      clock: realClock,
    });

    // Only wire the store when we have a plugin dir — never fall back to the vault root
    // (a "undefined/traces.jsonl" folder there would break the never-touch-vault-content
    // invariant). dir is populated for every loaded plugin in practice; this is a guard.
    if (this.manifest.dir) {
      this.traceStore = new TraceStore(this.app.vault.adapter, `${this.manifest.dir}/traces.jsonl`);
    }

    this.hud = new HudMount(new ObsidianHudDom(this.app));
    this.statusBar = new StatusBarItem(this.addStatusBarItem());
    this.banner = new PausedBanner(this.app.workspace.containerEl);
    this.registerEditorExtension([diffHighlightField]);
    this.registerEvent(this.app.workspace.on('layout-change', () => this.repaint()));
    // The mission pauses the moment the player's cursor leaves the mission note —
    // Obsidian's Vim mode is global, so staying "active" elsewhere is what broke typing.
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.syncPresence()));

    this.registerView(VIEW_TYPE_NEUROVIM, (leaf) => new HubView(leaf));
    this.addRibbonIcon('terminal', 'NeuroVim', () => void this.activateView());

    this.addCommand({ id: 'open', name: 'Open', callback: () => void this.activateView() });
    this.addCommand({ id: 'submit', name: 'Submit mission', callback: () => void this.handleSubmit() });
    this.addCommand({ id: 'reset', name: 'Reset mission', callback: () => void this.handleReset() });

    // Count keystrokes in the capture phase so Vim normal-mode commands and navigation
    // (h/j/k/l, motions, operators) are seen before CodeMirror/Vim consumes them — a bubble
    // or in-editor keydown handler never fires for those. Scoped to editor targets only.
    this.registerDomEvent(activeDocument, 'keydown', (e: KeyboardEvent) => {
      // 'active' rather than "a mission exists": a paused mission must not count keys
      // typed in another note. This is the structural fix for the KEYSTROKES 0 run.
      if (this.session.state !== 'active') return;
      if (!isMissionEditorKeystroke(e.key, e.target)) return;
      // Record only keystrokes typed into the mission note's OWN editor — not another note
      // open in a split during the run. The trace is persisted and can be sent to the LLM,
      // so it must never capture a different note's content. Counting keeps the wider
      // any-editor scope: omitting the key argument counts without recording.
      // Vim mode is deferred (best-effort, CM internals): the tracker supports `mode`,
      // wiring passes undefined for v1. CIPHER reads the raw key sequence fine without it.
      const record = this.settings.recordTraces && this.isMissionNoteKeydown(e.target);
      this.session.metrics.addKeystroke(record ? e.key : undefined);
    }, { capture: true });

    this.addSettingTab(new NeuroVimSettingTab(this.app, this));
    this.tick = window.setInterval(() => { this.syncPresence(); this.repaint(); }, 500);
    // Only auto-open the pane on startup if the user opted in (default off) — otherwise the
    // pane still opens on demand via the ribbon icon or the "Open NeuroVim" command.
    if (this.settings.openPaneOnStartup) {
      this.app.workspace.onLayoutReady(() => void this.activateView());
    }
  }

  onunload(): void {
    if (this.tick !== null) window.clearInterval(this.tick);
    this.hud.detach();
    this.banner.hide();
    // reset() disowns the turn, so a resumed continuation fails the uplink's identity
    // check instead of calling repaint() and re-creating the HUD after teardown.
    this.cipherUplink?.reset(this.cipherSession);
    this.restoreVim();
  }

  /** Read Obsidian's Vim-mode editor config. */
  private vimEnabled(): boolean {
    return !!(this.app.vault as unknown as { getConfig?: (k: string) => unknown })
      .getConfig?.('vimMode');
  }

  /** Set Obsidian's Vim mode and apply it live to open editors. */
  private setVim(on: boolean): void {
    const vault = this.app.vault as unknown as { setConfig?: (k: string, v: unknown) => void };
    vault.setConfig?.('vimMode', on);
    this.app.workspace.updateOptions();
  }

  /** On mission start (if autoVim): remember the current Vim state and turn it on. */
  private enterAutoVim(): void {
    if (!this.settings.autoVim || this.vimRestore !== null) return;
    this.vimRestore = this.vimEnabled();
    if (!this.vimRestore) this.setVim(true);
  }

  /** On mission end: restore the Vim state we found before the mission. */
  private restoreVim(): void {
    if (this.vimRestore === null) return;
    const restore = this.vimRestore;
    this.vimRestore = null;
    if (!restore) this.setVim(false);
  }

  /** Path of the note the player is currently in, or null. */
  private activeNotePath(): string | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path ?? null;
  }

  /**
   * Reconcile mission state against where the player actually is. Called from
   * active-leaf-change and from the 500ms tick as a safety net for cases that fire no
   * event. Both pause/resume and the Vim latch are idempotent, so repeated calls are free.
   */
  private syncPresence(): void {
    if (this.session.state === 'idle') return;
    const presence = resolvePresence(this.activeNotePath(), this.session.notePath);
    if (presence === 'away' && this.session.state === 'active') {
      this.session.pause();
      this.restoreVim();
      new Notice('>_ Mission paused — Vim restored.');
    } else if (presence === 'focused' && this.session.state === 'paused') {
      this.session.resume();
      this.enterAutoVim();
    } else {
      return; // nothing changed — the caller's own repaint covers the steady state
    }
    this.repaint();
  }

  /** Open the mission note again; presence sync then resumes the run. If the note is still
   *  open in some leaf, reveal that one rather than duplicating it; otherwise open it in a
   *  NEW tab so the note the player is currently working in stays put. */
  private async returnToMission(): Promise<void> {
    const path = this.session.notePath;
    if (!path) return;
    const file = this.app.vault.getFileByPath(path);
    if (!file) return;
    const open = this.app.workspace.getLeavesOfType('markdown').find(
      (leaf) => leaf.view instanceof MarkdownView && leaf.view.file?.path === path,
    );
    if (open) await this.app.workspace.revealLeaf(open);
    else await this.app.workspace.getLeaf('tab').openFile(file);
    this.syncPresence();
  }

  /** True if a NeuroVim pane leaf is currently rendered (not in a collapsed sidebar). */
  private isPaneVisible(): boolean {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE_NEUROVIM).some((leaf) => {
      const el = (leaf.view as unknown as { containerEl?: HTMLElement }).containerEl;
      return !!el && el.offsetParent !== null;
    });
  }

  /** CM6 EditorView of the active mission note, if it's open in a markdown leaf. */
  /** True if a keydown target sits inside the mission note's own CM editor (not another
   *  editor open in a split). Recording is confined to the mission editor because the
   *  trace is persisted and LLM-shippable. */
  private isMissionNoteKeydown(target: EventTarget | null): boolean {
    const cm = this.missionEditorView();
    return !!cm && target instanceof Node && cm.dom.contains(target);
  }

  private missionEditorView(): EditorView | null {
    const path = this.session.notePath;
    if (!path) return null;
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === path) {
        const cm = (view.editor as unknown as { cm?: EditorView }).cm;
        if (cm) return cm;
      }
    }
    return null;
  }

  /** Every settings write goes through here — the settings tab's declarative controls, the
   *  kit's endpoint-list commits and the thinking toggle all call it. The resolver caches the
   *  WHOLE EndpointConfig (url + per-endpoint key + model override), so a saved edit to a key
   *  or a model would otherwise not reach the next CIPHER request: the only other invalidation
   *  is a `kind === 'network'` stream failure, and a 401 or a wrong-model answer is an `http`
   *  failure, not a network one — the stale config would survive until Obsidian restarts. */
  async saveSettings(): Promise<void> {
    this.endpointResolver.invalidate();
    await this.persist();
    this.repaint();
  }

  /** Persist PluginData + settings under one data.json blob. */
  private async persist(): Promise<void> {
    const blob: StoredBlob = { ...this.data, __settings: this.settings };
    await this.saveData(blob);
  }

  /** Opens one archive artifact. Title comes from the index the click originated in,
   *  so a lookup failure still yields a titled modal instead of a dead end. */
  private async openLore(id: string, title: string): Promise<void> {
    let body = '';
    try {
      body = (await this.content.getLore(id)).body;
    } catch {
      body = ''; // LoreModal renders "_No data on file._"
    }
    new LoreModal(this.app, id, title, body, this.settings.colorScheme).open();
  }

  private async handleStart(id: string): Promise<void> {
    let doc;
    try {
      doc = await this.content.getMission(id);
    } catch (e) {
      new Notice(`NeuroVim: ${(e as Error).message}`);
      return;
    }
    if (doc.briefingBody) {
      new BriefingModal(
        this.app, doc.title, doc.briefingBody, this.settings.colorScheme,
        () => void this.beginMission(id),
      ).open();
    } else {
      await this.beginMission(id);
    }
  }

  /** Actually start the mission: materialize + open the transmission, start the timer. */
  private async beginMission(id: string): Promise<void> {
    try {
      await this.session.start(id);
      this.boxDismissed = false;
      this.hint = null;
      this.enterAutoVim();
      const m = this.missions.find((x) => x.mission_id === id);
      this.cipherSession.setMission(m
        ? { id: m.mission_id, title: m.title, category: m.category, why: m.why, parKeystrokes: m.par_keystrokes }
        : null);
      this.repaint();
    } catch (e) {
      new Notice(`NeuroVim: ${(e as Error).message}`);
    }
  }

  private async handleSubmit(): Promise<void> {
    if (!this.session.activeMissionId) return;
    const res = await this.session.submit();
    const cm = this.missionEditorView();
    if (res.ok) {
      if (cm) clearHighlight(cm);
      this.hint = null;
      this.revealedLines = [];
      this.highlighted = '';
      // end() hands the trace out as it tears the run down — the tracker holds the events
      // and resetting it drops them, so this is the last moment they exist.
      const events = this.session.end();
      this.restoreVim();
      this.cipherSession.setMission(null);

      const m = this.missions.find((x) => x.mission_id === res.result.mission_id);
      const par = m?.par_keystrokes ?? null;
      const trace = buildRunTrace(res.result, events, par, new Date().toISOString());
      if (this.settings.recordTraces) void this.traceStore?.append(trace);

      const runDebrief = this.settings.recordTraces && isLlmConfigured(this.settings)
        ? (onToken: (t: string) => void, signal: AbortSignal) => this.runDebrief(trace, onToken, signal)
        : null;

      new ResultModal(this.app, buildResultView(res.result, res.unverified), this.settings.colorScheme, runDebrief).open();
    } else {
      // Reveal every line that is wrong right now. The repaint at the end of this method
      // draws them and then clears them one by one as they get corrected — drawing here
      // too would just dispatch the same decoration set twice.
      this.revealedLines = cm ? this.session.divergentLinesFor(cm.state.doc.toString()) : [];
      const off = res.diff.lines_off;
      new Notice(`>_ ${off} line${off !== 1 ? 's' : ''} differ — keep going`);
      void this.session.requestHint().then((h) => { if (h) { this.hint = h; this.repaint(); } });
    }
    this.repaint();
  }

  private async handleReset(): Promise<void> {
    if (!this.session.activeMissionId) return;
    await this.session.reset();
    this.boxDismissed = false;
    this.hint = null;
    this.revealedLines = [];
    const cm = this.missionEditorView();
    if (cm) clearHighlight(cm);
    new Notice('>_ Transmission reset. Timer restarted.');
    this.repaint();
  }

  private handleAbandon(): void {
    const cm = this.missionEditorView();
    if (cm) clearHighlight(cm);
    this.hint = null;
    this.revealedLines = [];
    this.highlighted = '';
    this.session.end();
    this.restoreVim();
    this.cipherSession.setMission(null);
    new Notice('>_ Mission aborted.');
    this.repaint();
  }

  /** The uplink, built on first use. Knowledge assembly walks the whole cheatsheet
   *  and the quick-reference note — not worth doing at load. */
  private uplink(): CipherUplink {
    this.cipherUplink ??= new CipherUplink(
      new CorePortAdapter(this.cipherClient, this.endpointResolver, {
        configured: () => isLlmConfigured(this.settings),
        forEndpoint: (ep) => ({
          model: effectiveModel(ep, this.settings.llmModel),
          suppressThinking: this.settings.llmSuppressThinking,
        }),
      }),
      buildKnowledge(quickReference(ENTRIES)),
      () => this.repaint(),
    );
    return this.cipherUplink;
  }

  /** One-shot CIPHER debrief for a completed run. The Result modal renders tokens
   *  via onToken and the final result. */
  private async runDebrief(
    trace: RunTrace,
    onToken: (t: string) => void,
    signal: AbortSignal,
  ): Promise<LlmResult> {
    const m = this.missions.find((x) => x.mission_id === trace.mission_id);
    const mission: MissionContext | null = m
      ? {
          id: m.mission_id, title: m.title, category: m.category,
          why: m.why, parKeystrokes: m.par_keystrokes,
        }
      : null;
    return this.uplink().debrief(trace, mission, onToken, signal);
  }

  /** One CIPHER chat turn. Choreography and the stale-turn guard live in the core. */
  private async handleCipherAsk(question: string): Promise<void> {
    await this.uplink().ask(this.cipherSession, question);
  }

  private async activateView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_NEUROVIM);
    if (existing.length) { await workspace.revealLeaf(existing[0]); this.repaint(); return; }
    const leaf = workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_NEUROVIM, active: true });
    await workspace.revealLeaf(leaf);
    this.repaint();
  }

  private repaint(): void {
    const id = this.session.activeMissionId;
    const vimActive = this.vimEnabled();
    const paused = this.session.state === 'paused';

    // Read the body straight from CodeMirror — a vault read twice a second would be
    // wasteful and async. While the note is closed the last known values simply stand.
    const liveCm = this.missionEditorView();
    if (id && liveCm) {
      const body = liveCm.state.doc.toString();
      this.progress = this.session.progressFor(body);
      // Recompute the highlight live so a corrected line clears at once, but never mark
      // a line the player has not yet submitted against — the mission stays "find the
      // corruption", not "here is everything that is wrong".
      const divergent = new Set(this.session.divergentLinesFor(body));
      const stillWrong = this.revealedLines.filter((l) => divergent.has(l));
      const key = stillWrong.join(',');
      if (key !== this.highlighted) {
        showDivergentLines(liveCm, stillWrong);
        this.highlighted = key;
      }
    }
    if (!id) { this.progress = null; this.revealedLines = []; this.highlighted = ''; }

    // Base mission-control props (shared by box and pane).
    const control: HudRenderProps | null = id && this.session.notePath
      ? {
          id,
          title: this.missions.find((m) => m.mission_id === id)?.title ?? id,
          elapsedMs: this.session.elapsedMs(),
          keystrokes: this.session.metrics.getKeystrokes(),
          vimActive,
          paused,
          progress: this.progress,
          scheme: this.settings.colorScheme,
          onSubmit: () => void this.handleSubmit(),
          onReset: () => void this.handleReset(),
          onAbandon: () => this.handleAbandon(),
          hint: this.hint,
          onHint: () => { if (this.hint) { new Notice(this.hint); this.hint = null; this.repaint(); } },
          onCipher: isLlmConfigured(this.settings)
            ? () => { this.hubTab = 'uplink'; void this.activateView(); }
            : undefined,
        }
      : null;

    // Decide where the control goes: sidebar pane, floating box, or nowhere.
    const target = control
      ? resolveHudTarget(this.settings.hudPlacement, this.isPaneVisible(), this.boxDismissed)
      : 'none';

    // Floating box (with a dismiss handler for this mission).
    const boxActive: HudActive | null = target === 'box' && control && this.session.notePath
      ? {
          notePath: this.session.notePath,
          props: { ...control, onDismiss: () => { this.boxDismissed = true; this.repaint(); } },
        }
      : null;
    this.hud.sync(boxActive);

    // Sidebar pane: NEXUS list, with the control block on top when targeted there.
    const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_NEUROVIM)[0]?.view;
    if (view instanceof HubView) {
      view.setProps({
        missions: this.missions,
        data: this.data,
        onStart: (mid) => void this.handleStart(mid),
        control: target === 'sidebar' ? control : null,
        cipher: isLlmConfigured(this.settings)
          ? {
              entries: this.cipherSession.entries,
              streaming: this.cipherSession.streaming,
              busy: this.cipherSession.busy,
              missionTitle: this.cipherSession.mission?.title ?? null,
              onAsk: (q) => void this.handleCipherAsk(q),
              // CUT keeps the turn's identity so it still lands its partial "— signal cut";
              // RST disowns it so it cannot append into the cleared channel. See CipherUplink.
              onAbort: () => this.cipherUplink?.abort(),
              onReset: () => this.cipherUplink?.reset(this.cipherSession),
            }
          : null,
        activeTab: this.hubTab,
        onSelectTab: (t) => { this.hubTab = t; this.repaint(); },
        guideQuery: this.guideQuery,
        onGuideQuery: (q) => { this.guideQuery = q; this.repaint(); },
        onOpenLore: (id, title) => void this.openLore(id, title),
        collapsed: this.settings.uiCollapsed,
        onToggleCollapsed: (key) => {
          this.settings.uiCollapsed = {
            ...this.settings.uiCollapsed,
            [key]: !this.settings.uiCollapsed[key],
          };
          this.repaint();
          void this.saveSettings();
        },
        scheme: this.settings.colorScheme,
      });
    }

    // Status bar: present whenever a mission exists, so a paused run can never go
    // unnoticed no matter which note is open or whether the pane is closed.
    if (id) {
      const t = Math.floor(this.session.elapsedMs() / 1000);
      const clock = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      this.statusBar.set(paused ? `▸ ${id} PAUSED ${clock}` : `▸ ${id} ${clock}`);
    } else {
      this.statusBar.set(null);
    }

    // Banner: only once a pause has outlasted the configured threshold.
    if (id && paused
      && shouldShowPausedBanner(this.session.pausedMs(), this.settings.pausedBannerMinutes)) {
      this.banner.show({
        missionId: id,
        scheme: this.settings.colorScheme,
        onReturn: () => void this.returnToMission(),
        onAbort: () => this.handleAbandon(),
      });
    } else {
      this.banner.hide();
    }
  }
}
