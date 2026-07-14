import { ItemView, WorkspaceLeaf } from 'obsidian';
import { render, h } from 'preact';
import { ProgressionEngine } from '@neurovim/core';
import type { MissionSummary, PluginData } from '@neurovim/core';
import { MissionHud } from './MissionHud';
import type { HudRenderProps } from './HudMount';
import type { ColorScheme } from './settings';
import { CipherChat, type CipherChatProps } from './CipherChat';

export const VIEW_TYPE_NEUROVIM = 'neurovim-hub';

export interface HubProps {
  missions: MissionSummary[];
  data: PluginData;
  onStart: (id: string) => void;
  /** When set, the mission-control block is shown at the top of the pane. */
  control: HudRenderProps | null;
  /** When set, the UPLINK // CIPHER chat is shown below the mission list. */
  cipher: CipherChatProps | null;
  scheme: ColorScheme;
}

function Nexus(p: HubProps) {
  const prog = ProgressionEngine.getXpProgress(p.data.total_xp);
  return (
    <div class="nv-nexus">
      {p.control && <MissionHud {...p.control} />}
      <h2 class="nv-title">NEXUS</h2>
      <div class="nv-level">LVL {prog.level} · {p.data.total_xp} XP</div>
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
      {p.cipher && <CipherChat key="cipher-chat" {...p.cipher} />}
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
    render(h('div', { class: `nv-root nv-${this.props.scheme}` }, h(Nexus, this.props)), this.contentEl);
  }
}
