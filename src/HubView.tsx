import { ItemView, WorkspaceLeaf } from 'obsidian';
import { render, h } from 'preact';
import { ProgressionEngine } from '@neurovim/core';
import type { MissionSummary, PluginData } from '@neurovim/core';

export const VIEW_TYPE_NEUROVIM = 'neurovim-hub';

export interface HubProps {
  missions: MissionSummary[];
  data: PluginData;
  active: { id: string; title: string; elapsedMs: number; keystrokes: number } | null;
  onStart: (id: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  onAbandon: () => void;
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function Nexus(p: HubProps) {
  const prog = ProgressionEngine.getXpProgress(p.data.total_xp);
  return (
    <div class="nv-nexus">
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
    </div>
  );
}

function MissionControl(p: HubProps) {
  const a = p.active!;
  return (
    <div class="nv-control">
      <h2 class="nv-title">{a.id}</h2>
      <div class="nv-mission-title">{a.title}</div>
      <div class="nv-metrics">
        <span class="nv-timer">{fmt(a.elapsedMs)}</span>
        <span class="nv-keystrokes">{a.keystrokes} keys</span>
      </div>
      <div class="nv-actions">
        <button class="nv-btn nv-btn-primary" onClick={p.onSubmit}>Submit</button>
        <button class="nv-btn" onClick={p.onReset}>Reset</button>
        <button class="nv-btn" onClick={p.onAbandon}>Abandon</button>
      </div>
      <p class="nv-hint">Edit the note to restore the transmission. Enable Obsidian&apos;s Vim mode (Settings → Editor) for the real experience.</p>
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
    const view = this.props.active ? h(MissionControl, this.props) : h(Nexus, this.props);
    render(h('div', { class: 'nv-root' }, view), this.contentEl);
  }
}
