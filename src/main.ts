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
import { diffHighlightField, showDivergentLine, clearHighlight } from './diffHighlight';
import { countsAsKeystroke, isEditorKeydownTarget } from './keystrokeCounter';
import { NeuroVimSettingTab } from './SettingsTab';
import { buildResultView } from './result/resultView';
import { ResultModal } from './result/ResultModal';
import { BriefingModal } from './briefing/BriefingModal';
import { ChatSession } from './llm/chatSession';
import { CipherClient, type StreamOutcome } from './llm/CipherClient';
import { XhrSseTransport } from './llm/XhrSseTransport';
import { buildKnowledge, buildChatMessages, type CipherKnowledge } from './llm/cipherPrompt';
import { EndpointResolver } from './llm/endpointResolver';
import { probeEndpoint } from './llm/endpointProbe';
import { DEFAULT_SETTINGS, isLlmConfigured, mergeStoredSettings, type VimDojoSettings } from './settings';
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
  private boxDismissed = false;
  private vimRestore: boolean | null = null;
  private tick: number | null = null;
  private cipherSession = new ChatSession();
  private cipherClient = new CipherClient(new XhrSseTransport());
  private cipherAbort: AbortController | null = null;
  private endpointResolver = new EndpointResolver(
    () => this.settings.llmEndpoints,
    async (ep) => (await probeEndpoint(ep, this.settings.llmApiKey)).status.reachable,
  );
  private cipherKnowledge: CipherKnowledge | null = null;
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
    });

    this.hud = new HudMount(new ObsidianHudDom(this.app));
    this.registerEditorExtension([diffHighlightField]);
    this.registerEvent(this.app.workspace.on('layout-change', () => this.repaint()));

    this.registerView(VIEW_TYPE_NEUROVIM, (leaf) => new HubView(leaf));
    this.addRibbonIcon('terminal', 'NeuroVim', () => void this.activateView());

    this.addCommand({ id: 'open', name: 'Open', callback: () => void this.activateView() });
    this.addCommand({ id: 'submit', name: 'Submit mission', callback: () => void this.handleSubmit() });
    this.addCommand({ id: 'reset', name: 'Reset mission', callback: () => void this.handleReset() });

    // Count keystrokes in the capture phase so Vim normal-mode commands and navigation
    // (h/j/k/l, motions, operators) are seen before CodeMirror/Vim consumes them — a bubble
    // or in-editor keydown handler never fires for those. Scoped to editor targets only.
    this.registerDomEvent(activeDocument, 'keydown', (e: KeyboardEvent) => {
      if (!this.session.activeMissionId) return;
      if (!countsAsKeystroke(e.key)) return;
      if (!isEditorKeydownTarget(e.target)) return;
      this.session.metrics.addKeystroke();
    }, { capture: true });

    this.addSettingTab(new NeuroVimSettingTab(this.app, this));
    this.tick = window.setInterval(() => this.repaint(), 500);
    // Only auto-open the pane on startup if the user opted in (default off) — otherwise the
    // pane still opens on demand via the ribbon icon or the "Open NeuroVim" command.
    if (this.settings.openPaneOnStartup) {
      this.app.workspace.onLayoutReady(() => void this.activateView());
    }
  }

  onunload(): void {
    if (this.tick !== null) window.clearInterval(this.tick);
    this.hud.detach();
    // Null after abort so a resumed continuation fails the identity check in handleCipherAsk
    // instead of calling repaint() and re-creating the HUD after teardown.
    this.cipherAbort?.abort();
    this.cipherAbort = null;
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

  /** True if a NeuroVim pane leaf is currently rendered (not in a collapsed sidebar). */
  private isPaneVisible(): boolean {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE_NEUROVIM).some((leaf) => {
      const el = (leaf.view as unknown as { containerEl?: HTMLElement }).containerEl;
      return !!el && el.offsetParent !== null;
    });
  }

  /** CM6 EditorView of the active mission note, if it's open in a markdown leaf. */
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

  async saveSettings(): Promise<void> { await this.persist(); this.repaint(); }

  /** Persist PluginData + settings under one data.json blob. */
  private async persist(): Promise<void> {
    const blob: StoredBlob = { ...this.data, __settings: this.settings };
    await this.saveData(blob);
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
      this.session.end();
      this.restoreVim();
      this.cipherSession.setMission(null);
      new ResultModal(this.app, buildResultView(res.result), this.settings.colorScheme).open();
    } else {
      if (cm) showDivergentLine(cm, res.diff.first_divergent_line);
      const off = res.diff.lines_off;
      new Notice(`>_ ${off} line${off !== 1 ? 's' : ''} differ — keep going`);
    }
    this.repaint();
  }

  private async handleReset(): Promise<void> {
    if (!this.session.activeMissionId) return;
    await this.session.reset();
    this.boxDismissed = false;
    const cm = this.missionEditorView();
    if (cm) clearHighlight(cm);
    new Notice('>_ Transmission reset. Timer restarted.');
    this.repaint();
  }

  private handleAbandon(): void {
    const cm = this.missionEditorView();
    if (cm) clearHighlight(cm);
    this.session.end();
    this.restoreVim();
    this.cipherSession.setMission(null);
    new Notice('>_ Mission aborted.');
    this.repaint();
  }

  /** One CIPHER chat turn: append the question, stream the answer into the session. */
  private async handleCipherAsk(question: string): Promise<void> {
    if (this.cipherSession.busy || !isLlmConfigured(this.settings)) return;
    this.cipherKnowledge ??= buildKnowledge();
    const history = this.cipherSession.historyForPrompt();
    this.cipherSession.append({ role: 'user', text: question });
    this.cipherSession.busy = true;
    this.cipherSession.streaming = '';
    // Capture this turn's controller locally: `this.cipherAbort` may be reassigned
    // (new turn) or nulled (reset) by the time our await resolves.
    const myAbort = new AbortController();
    this.cipherAbort = myAbort;
    this.repaint();
    const messages = buildChatMessages({
      knowledge: this.cipherKnowledge,
      mission: this.cipherSession.mission,
      history,
      question,
    });
    const runStream = async (endpoint: string): Promise<StreamOutcome> =>
      this.cipherClient.stream(
        { endpoint, apiKey: this.settings.llmApiKey, model: this.settings.llmModel, suppressThinking: this.settings.llmSuppressThinking },
        messages,
        (t) => {
          // Stale stream from a reset/superseded turn — don't write into the new turn's state.
          if (this.cipherAbort !== myAbort) return;
          // The 500ms repaint tick picks this up — no extra render plumbing.
          this.cipherSession.streaming = (this.cipherSession.streaming ?? '') + t;
        },
        myAbort.signal,
      );

    const endpoint = await this.endpointResolver.resolve();
    let outcome: StreamOutcome = endpoint === null
      ? { ok: false, kind: 'network', detail: 'no endpoint reachable', partial: '' }
      : await runStream(endpoint);

    // A network failure may just mean the cached endpoint moved (host slept, network
    // changed). Re-resolve once and retry — never twice, or a dead uplink stalls the turn.
    // Retry on any freshly resolved endpoint, including the same one: the fresh ping just
    // proved it answers, so the failure was transient. (Guarding on `fresh !== endpoint`
    // would disable the retry entirely for a single-endpoint list — the common case.)
    // If nothing resolves, `fresh` is null and the original failure stands.
    // `endpoint !== null` excludes the case where the *first* resolve already came back
    // null (nothing in the list was reachable at all — resolve() deliberately doesn't cache
    // that). Retrying there would re-ping every endpoint a second time for a failure that
    // was never transient, doubling the wait (up to ~5s per endpoint) before "Signal lost".
    // The retry is for a resolved endpoint that broke mid-request, not for a list that was
    // already unreachable.
    if (endpoint !== null && !outcome.ok && outcome.kind === 'network' && this.cipherAbort === myAbort) {
      this.endpointResolver.invalidate();
      const fresh = await this.endpointResolver.resolve();
      if (fresh !== null) outcome = await runStream(fresh);
    }

    // Only the current turn may mutate session state after its await — a reset or a
    // newer ask already owns `cipherSession`/`cipherAbort` if the identity check fails.
    if (this.cipherAbort !== myAbort) return;

    if (outcome.ok) {
      this.cipherSession.append({ role: 'assistant', text: outcome.content });
    } else if (outcome.kind === 'aborted' && outcome.partial) {
      this.cipherSession.append({ role: 'assistant', text: `${outcome.partial} — signal cut` });
    } else if (outcome.kind !== 'aborted') {
      this.cipherSession.append({ role: 'error', text: 'Signal lost. Check your uplink.', detail: outcome.detail });
    }
    this.cipherSession.streaming = null;
    this.cipherSession.busy = false;
    this.cipherAbort = null;
    this.repaint();
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

    // Base mission-control props (shared by box and pane).
    const control: HudRenderProps | null = id && this.session.notePath
      ? {
          id,
          title: this.missions.find((m) => m.mission_id === id)?.title ?? id,
          elapsedMs: this.session.metrics.getElapsedMs(),
          keystrokes: this.session.metrics.getKeystrokes(),
          vimActive,
          scheme: this.settings.colorScheme,
          onSubmit: () => void this.handleSubmit(),
          onReset: () => void this.handleReset(),
          onAbandon: () => this.handleAbandon(),
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
              // onAbort leaves cipherAbort set: the killed turn still owns the identity check
              // and must append its partial "— signal cut" answer into the live session.
              onAbort: () => this.cipherAbort?.abort(),
              // onReset wipes the session, so the killed turn must NOT be allowed to append
              // into it — null the controller to fail its identity check in handleCipherAsk.
              onReset: () => { this.cipherAbort?.abort(); this.cipherAbort = null; this.cipherSession.reset(); this.repaint(); },
            }
          : null,
        activeTab: this.hubTab,
        onSelectTab: (t) => { this.hubTab = t; this.repaint(); },
        guideQuery: this.guideQuery,
        onGuideQuery: (q) => { this.guideQuery = q; this.repaint(); },
        scheme: this.settings.colorScheme,
      });
    }
  }
}
