import {
  MissionEngine, MetricsTracker, ProgressionEngine, getDivergentLines,
} from '@neurovim/core';
import type { PluginData, RunResult, DiffResult, MissionRecord } from '@neurovim/core';
import type { BundledContent } from './content/BundledContent';
import type { ClockPort } from './vendor/kit/clock';
import { RunTimer } from './RunTimer';
import { countMatchingLines, type LineProgress } from './missionProgress';
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

/**
 * Bump run bookkeeping without touching best scores. Used for unverified runs, because
 * `ProgressionEngine.recordMissionRun` reads a 0 as "no value yet" (`cur > 0 ? min : next`)
 * and would adopt it as an unbeatable best — exactly the corruption seen on 2026-07-23.
 */
function bumpRunOnly(prev: MissionRecord | undefined, today: string): MissionRecord {
  return {
    best_time_ms: prev?.best_time_ms ?? 0,
    best_keystrokes: prev?.best_keystrokes ?? 0,
    best_ks_per_min: prev?.best_ks_per_min ?? 0,
    runs: (prev?.runs ?? 0) + 1,
    last_run: today,
  };
}

export class MissionSession {
  readonly metrics = new MetricsTracker();
  private readonly timer: RunTimer;
  private _state: MissionState = 'idle';
  /** Wall time the current pause began, null while not paused. */
  private _pausedAt: number | null = null;
  private _id: string | null = null;
  private _notePath: string | null = null;
  private _corrupted = '';
  private _solution = '';
  private _xpReward = 0;

  constructor(private readonly deps: MissionSessionDeps) {
    this.timer = new RunTimer(deps.clock);
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

  /** 0-based indices of the lines in `body` that differ from the solution. */
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
    this._xpReward = doc.xp_reward;
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
    // No keystroke means the solution was not typed (paste, already-solved note, foreign
    // sync). The win counts, the record does not.
    const unverified = metrics.keystrokes === 0;
    const today = new Date(this.deps.clock.now()).toISOString().slice(0, 10);
    const data = this.deps.getData();
    const old: MissionRecord | undefined = data.missions[this._id];
    const record = unverified
      ? bumpRunOnly(old, today)
      : ProgressionEngine.recordMissionRun(old, metrics, today);
    let next: PluginData = { ...data, missions: { ...data.missions, [this._id]: record } };

    const { new_data } = ProgressionEngine.addXp(next, this._xpReward);
    next = ProgressionEngine.recordCompletion(new_data);
    if (!next.completed_missions.includes(this._id)) {
      next = { ...next, completed_missions: [...next.completed_missions, this._id] };
    }
    await this.deps.setData(next);

    const result: RunResult = {
      mission_id: this._id,
      elapsed_ms: metrics.elapsed_ms,
      keystrokes: metrics.keystrokes,
      ks_per_min: metrics.ks_per_min,
      xp_earned: this._xpReward,
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
    const current = body.trim();
    const solution = this._solution.trim();
    if (current === solution) return null;
    const curLines = current.split('\n');
    const solLines = solution.split('\n');
    const maxLen = Math.max(curLines.length, solLines.length);
    for (let i = 0; i < maxLen; i++) {
      const cur = curLines[i] ?? '';
      const sol = solLines[i] ?? '';
      if (cur !== sol) {
        const lineNum = i + 1;
        return formatHint(lineNum, cur, sol);
      }
    }
    return null;
  }

  end(): void {
    this._state = 'idle';
    this._pausedAt = null;
    this._id = null;
    this._notePath = null;
    this._corrupted = '';
    this._solution = '';
    this.metrics.reset();
    this.timer.reset();
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

function formatHint(lineNum: number, current: string, solution: string): string {
  return `>_ Line ${lineNum} differs\n\nHas: ${truncate(current, 60)}\n\nShould be:\n${truncate(solution, 60)}`;
}
