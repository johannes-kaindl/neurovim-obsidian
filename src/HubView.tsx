import { ItemView, WorkspaceLeaf } from 'obsidian';
import { render, h, Fragment } from 'preact';
import { ProgressionEngine, CHEATSHEET } from '@neurovim/core';
import type { MissionSummary, PluginData } from '@neurovim/core';
import { getWelcome } from '@neurovim/content';
import { MissionHud } from './MissionHud';
import type { HudRenderProps } from './HudMount';
import type { ColorScheme } from './settings';
import { CipherChat, type CipherChatProps } from './CipherChat';
import { effectiveTab, type HubTab } from './hubTabs';
import { nextMission } from './nextMission';
import { parseWelcomeBlocks } from './welcomeBlocks';
import { filterCheatsheet } from './filterCheatsheet';

export const VIEW_TYPE_NEUROVIM = 'neurovim-hub';

export interface HubProps {
  missions: MissionSummary[];
  data: PluginData;
  onStart: (id: string) => void;
  /** When set, the mission-control block is shown at the top of the pane. */
  control: HudRenderProps | null;
  /** When set, the UPLINK // CIPHER chat tab is available. */
  cipher: CipherChatProps | null;
  activeTab: HubTab;
  onSelectTab: (t: HubTab) => void;
  guideQuery: string;
  onGuideQuery: (q: string) => void;
  scheme: ColorScheme;
}

const WELCOME_BLOCKS = parseWelcomeBlocks(getWelcome());

function TabBar(p: { active: HubTab; uplinkVisible: boolean; onSelect: (t: HubTab) => void }) {
  const tabs: { id: HubTab; label: string }[] = [
    { id: 'nexus', label: 'NEXUS' },
    { id: 'missions', label: 'MISSIONS' },
    { id: 'guide', label: 'GUIDE' },
    ...(p.uplinkVisible ? [{ id: 'uplink' as HubTab, label: 'UPLINK' }] : []),
  ];
  return (
    <div class="nv-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          class={`nv-tab ${p.active === t.id ? 'is-active' : ''}`}
          role="tab"
          aria-selected={p.active === t.id}
          onClick={() => p.onSelect(t.id)}
        >{t.label}</button>
      ))}
    </div>
  );
}

function NexusTab(p: HubProps) {
  const prog = ProgressionEngine.getXpProgress(p.data.total_xp);
  const next = nextMission(p.missions, p.data);
  return (
    <div class="nv-nexus-home">
      <div class="nv-level">LVL {prog.level} · {p.data.total_xp} XP</div>
      {WELCOME_BLOCKS.map((b) =>
        b.kind === 'quote'
          ? <div class="nv-welcome-quote">{b.lines.map((l) => <div>{l}</div>)}</div>
          : <p class="nv-welcome-para">{b.text}</p>,
      )}
      {next && (
        <button class="nv-btn nv-btn-submit nv-next-mission" onClick={() => p.onStart(next.mission_id)}>
          ▶ NEXT MISSION: {next.mission_id} — {next.title}
        </button>
      )}
    </div>
  );
}

function MissionsTab(p: HubProps) {
  return (
    <div class="nv-mission-list">
      {p.missions.map((m) => {
        const unlocked = p.data.unlocked.includes(m.mission_id);
        const done = p.data.completed_missions.includes(m.mission_id);
        return (
          <button
            class={`nv-mission ${unlocked ? '' : 'is-locked'} ${done ? 'is-done' : ''}`}
            disabled={!unlocked}
            onClick={() => unlocked && p.onStart(m.mission_id)}
          >
            <span class="nv-mission-id">{m.mission_id}</span>
            <span class="nv-mission-title">{m.title}</span>
            <span class="nv-mission-xp">{done ? '✓' : `+${m.xp_reward}`}</span>
          </button>
        );
      })}
    </div>
  );
}

function GuideTab(p: { query: string; onQuery: (q: string) => void }) {
  const cats = filterCheatsheet(CHEATSHEET, p.query);
  return (
    <div class="nv-guide">
      {/* Controlled on purpose (unlike CipherChat's draft): the query state lives in
          main.ts so the filter survives tab switches, and the onInput→repaint
          round-trip is synchronous, so typing never fights the 500ms tick. */}
      <input
        class="nv-guide-search"
        type="search"
        placeholder="search keys… (e.g. delete, ciw, :%s)"
        value={p.query}
        onInput={(e) => p.onQuery((e.currentTarget as HTMLInputElement).value)}
      />
      {cats.length === 0 && <div class="nv-guide-empty">No matches. CORP scrubbed that page.</div>}
      {cats.map((cat) => (
        <div class="nv-guide-cat">
          <h3 class="nv-guide-cat-title">{cat.label}</h3>
          {cat.groups.map((g) => (
            <Fragment>
              <div class="nv-guide-group">{g.label}</div>
              {g.keys.map((k) => (
                <div class="nv-guide-row">
                  <span class="nv-guide-key">{k.key}</span>
                  <span class="nv-guide-desc">{k.description}</span>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

function Hub(p: HubProps) {
  const tab = effectiveTab(p.activeTab, p.cipher !== null);
  return (
    <div class="nv-nexus">
      {p.control && <MissionHud {...p.control} />}
      <h2 class="nv-title">NEXUS</h2>
      <TabBar active={tab} uplinkVisible={p.cipher !== null} onSelect={p.onSelectTab} />
      {tab === 'nexus' && <NexusTab {...p} />}
      {tab === 'missions' && <MissionsTab {...p} />}
      {tab === 'guide' && <GuideTab key="guide" query={p.guideQuery} onQuery={p.onGuideQuery} />}
      {tab === 'uplink' && p.cipher && <CipherChat key="cipher-chat" {...p.cipher} />}
    </div>
  );
}

export class HubView extends ItemView {
  private props: HubProps | null = null;

  constructor(leaf: WorkspaceLeaf) { super(leaf); }
  getViewType(): string { return VIEW_TYPE_NEUROVIM; }
  getDisplayText(): string { return 'NeuroVim'; }
  getIcon(): string { return 'terminal'; }

  async onOpen(): Promise<void> { this.paint(); }
  async onClose(): Promise<void> { render(null, this.contentEl); }

  setProps(props: HubProps): void {
    this.props = props;
    this.paint();
  }

  private paint(): void {
    if (!this.props) return;
    render(h('div', { class: `nv-root nv-${this.props.scheme}` }, h(Hub, this.props)), this.contentEl);
  }
}
