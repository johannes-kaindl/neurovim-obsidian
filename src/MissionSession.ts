import { localDate } from './vendor/kit/local-stamp';
import {
  MissionEngine, MetricsTracker, completeMission, getDivergentLines, normalizeMissionText,
} from '@neurovim/core';
import type { PluginData, RunResult, DiffResult, MissionRecord, TraceEvent, CompletedMission } from '@neurovim/core';
import type { BundledContent } from './content/BundledContent';
import type { ClockPort } from './vendor/kit-obsidian/clock';
import { RunTimer } from './RunTimer';
import { countMatchingLines, markLineDelta, type LineProgress } from './missionProgress';
import { missionNotePath } from './paths';

/** Where a mission stands: no mission, being played, or waiting while you work elsewhere. */
export type MissionState = 'idle' | 'active' | 'paused';

/** Minimal Obsidian surface MissionSession needs — real impl in main.ts, fake in tests. */
export interface MissionApp {
  ensureFolder(folder: string): Promise<void>;
  writeNote(path: string, body: string): Promise<void>;
  readNote(path: string): Promise<string>;
  openNote(path: string): Promise<void>;
  noteExists(path: string): Promise<boolean>;
}

export interface MissionSessionDeps {
  app: MissionApp;
  content: BundledContent;
  getFolder: () => string;
  getData: () => PluginData;
  setData: (d: PluginData) => Promise<void>;
  clock: ClockPort;
}

type SubmitResult =
  | { ok: true; result: RunResult; unverified: boolean }
  | { ok: false; diff: DiffResult };

export class MissionSession {
  readonly metrics: MetricsTracker;
  private readonly timer: RunTimer;
  private _state: MissionState = 'idle';
  /** Wall time the current pause began, null while not paused. */
  private _pausedAt: number | null = null;
  private _id: string | null = null;
  private _notePath: string | null = null;
  private _corrupted = '';
  private _solution = '';
  private _mission: CompletedMission | null = null;

  constructor(private readonly deps: MissionSessionDeps) {
    this.timer = new RunTimer(deps.clock);
    // Same clock as the timer: metrics time and trace timestamps come from one source.
    this.metrics = new MetricsTracker(deps.clock);
  }

  get activeMissionId(): string | null { return this._id; }
  get notePath(): string | null { return this._notePath; }
  get state(): MissionState { return this._state; }

  /** Run time so far, excluding every pause. */
  elapsedMs(): number { return this.timer.elapsedMs(); }

  /** How long the current pause has lasted; 0 when not paused. */
  pausedMs(): number {
    if (this._pausedAt === null) return 0;
    return this.deps.clock.now() - this._pausedAt;
  }

  /** Suspend a running mission: the clock stops, keystrokes stop counting (guarded at
   *  the call site by `state === 'active'`). No-op unless active. */
  pause(): void {
    if (this._state !== 'active') return;
    this._state = 'paused';
    this._pausedAt = this.deps.clock.now();
    this.timer.pause();
  }

  /** Resume a paused mission. No-op unless paused — presence sync calls this repeatedly. */
  resume(): void {
    if (this._state !== 'paused') return;
    this._state = 'active';
    this._pausedAt = null;
    this.timer.resume();
  }

  /** Live progress of an arbitrary body against this mission's solution. */
  progressFor(body: string): LineProgress {
    return countMatchingLines(body, this._solution);
  }

  /** 0-based editor (document) line indices of `body` that differ from the solution —
   *  frontmatter a vault plugin added shifts them, it is never itself marked. */
  divergentLinesFor(body: string): number[] {
    return getDivergentLines(body, this._solution);
  }

  async start(id: string): Promise<void> {
    const doc = await this.deps.content.getMission(id);
    if (doc.solution == null) throw new Error(`Mission ${id} has no solution — cannot play`);
    const folder = this.deps.getFolder();
    const path = missionNotePath(folder, id, doc.title);
    await this.deps.app.ensureFolder(folder);
    await this.deps.app.writeNote(path, doc.transmissionBody);
    await this.deps.app.openNote(path);
    this._id = id;
    this._notePath = path;
    this._corrupted = doc.transmissionBody;
    this._solution = doc.solution;
    this._mission = {
      mission_id: id,
      xp_reward: doc.xp_reward,
      par_keystrokes: doc.par_keystrokes,
      difficulty: doc.difficulty,
    };
    this._state = 'active';
    this._pausedAt = null;
    this.metrics.reset();
    this.metrics.start();
    this.timer.start();
  }

  async reset(): Promise<void> {
    if (!this._notePath) return;
    await this.deps.app.writeNote(this._notePath, this._corrupted);
    this.metrics.reset();
    this.metrics.start();
    this.timer.reset();
    // Only run again if the player is actually in the note; a reset from the pane
    // during a pause leaves a cleanly zeroed, stopped timer.
    if (this._state === 'active') this.timer.resume();
  }

  async submit(): Promise<SubmitResult> {
    if (!this._id || !this._notePath) throw new Error('No active mission');
    if (!(await this.deps.app.noteExists(this._notePath))) {
      // Note was deleted mid-mission → re-materialize, treat as not-yet-solved.
      await this.deps.app.writeNote(this._notePath, this._corrupted);
      await this.deps.app.openNote(this._notePath);
      return { ok: false, diff: { matches: false, first_divergent_line: 0, lines_off: 0 } };
    }
    const elapsed = this.timer.elapsedMs();
    const body = await this.deps.app.readNote(this._notePath);
    const diff: DiffResult = MissionEngine.verify(body, this._solution);
    if (!diff.matches) return { ok: false, diff };

    const metrics = this.metrics.getResult(elapsed);
    const today = localDate(new Date(this.deps.clock.now()));
    const data = this.deps.getData();
    const old: MissionRecord | undefined = data.missions[this._id];
    // Scoring (XP, streak on the local day, bests, no bests without a keystroke) is the core's.
    const done = completeMission(data, this._mission ?? { mission_id: this._id, xp_reward: 0 }, metrics, today);
    const unverified = done.unverified;
    await this.deps.setData(done.data);

    const result: RunResult = {
      mission_id: this._id,
      elapsed_ms: metrics.elapsed_ms,
      keystrokes: metrics.keystrokes,
      ks_per_min: metrics.ks_per_min,
      xp_earned: done.xp,
      is_new_best_time: !unverified && (!old || metrics.elapsed_ms < old.best_time_ms),
      is_new_best_ks: !unverified && (!old || metrics.keystrokes < old.best_keystrokes),
      delta_time_ms: old ? metrics.elapsed_ms - old.best_time_ms : 0,
      delta_keystrokes: old ? metrics.keystrokes - old.best_keystrokes : 0,
      delta_ks_per_min: old ? metrics.ks_per_min - old.best_ks_per_min : 0,
    };
    return { ok: true, result, unverified };
  }

  /**
   * Compute a hint for the first divergent line. Re-reads the current note so the hint
   * reflects the player's latest edits (they may have fixed the first error and need the next).
   * Returns null when no active mission or the note cannot be read.
   */
  async requestHint(): Promise<string | null> {
    if (!this._id || !this._notePath) return null;
    let body: string;
    try {
      body = await this.deps.app.readNote(this._notePath);
    } catch { return null; }
    // Same normalization as the check: frontmatter and trailing spaces a vault plugin
    // added are never the "difference". The line number is the editor line (1-based) the
    // player sees, so it counts the frontmatter the scoring skips.
    const cur = normalizeMissionText(body);
    const sol = normalizeMissionText(this._solution).lines;
    const maxLen = Math.max(cur.lines.length, sol.length);
    for (let i = 0; i < maxLen; i++) {
      const has = cur.lines[i] ?? '';
      const want = sol[i] ?? '';
      if (has !== want) return formatHint(i + cur.offset + 1, has, want);
    }
    return null;
  }

  /** Ends the run and hands back its keystroke trace. Returning it rather than leaving it
   *  to be fetched is deliberate: `metrics.reset()` below clears the events, so a caller
   *  reading them afterwards would silently get an empty array. Taking the snapshot out
   *  through the same call that destroys it removes the ordering hazard instead of
   *  documenting it. */
  end(): TraceEvent[] {
    const events = this.metrics.getEvents();
    this._state = 'idle';
    this._pausedAt = null;
    this._id = null;
    this._notePath = null;
    this._corrupted = '';
    this._solution = '';
    this.metrics.reset();
    this.timer.reset();
    return events;
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

function formatHint(lineNum: number, current: string, solution: string): string {
  // Truncate before marking, not after — marking first would let the guillemets fall
  // outside the visible window on a long line.
  const { has, want } = markLineDelta(truncate(current, 60), truncate(solution, 60));
  return `>_ Line ${lineNum} differs\n\nHas:  ${has}\n\nWant: ${want}`;
}
