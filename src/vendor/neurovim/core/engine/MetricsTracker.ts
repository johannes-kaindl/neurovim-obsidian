import { realClock, type ClockPort } from '../utils/clock';
import type { TraceEvent } from './RunTrace';

export interface MetricsResult {
  elapsed_ms: number;
  keystrokes: number;
  ks_per_min: number;
}

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Meta', 'Shift', 'CapsLock']);

/** True if a keydown's `key` counts as a mission keystroke (everything but bare modifiers).
 *  Lives with the counter so every consumer applies the same rule; the *where* of a keystroke
 *  (which editor, which document) is platform-bound and stays with the adapter. */
export function countsAsKeystroke(key: string): boolean {
  return !MODIFIER_KEYS.has(key);
}

/** A run's metrics from its keystroke count and duration — keystrokes per minute rounded to
 *  one decimal. Pure, so a port that counts keys elsewhere (the Neovim plugin) computes the
 *  same number; MetricsTracker.getResult delegates to it. */
export function metricsResult(keystrokes: number, elapsed_ms: number): MetricsResult {
  const ks_per_min = elapsed_ms > 0 ? Math.round((keystrokes / elapsed_ms) * 60_000 * 10) / 10 : 0;
  return { elapsed_ms, keystrokes, ks_per_min };
}

/** Counting and recording for one mission run. Both are driven by the injected clock, so
 *  elapsed time and event timestamps share a single baseline set in `start()`. */
export class MetricsTracker {
  private _keystrokes = 0;
  private _running = false;
  private _startTime = 0;
  private _events: TraceEvent[] = [];

  constructor(private readonly clock: ClockPort = realClock) {}

  start(): void {
    this._startTime = this.clock.now();
    this._running = true;
  }

  reset(): void {
    this._keystrokes = 0;
    this._running = false;
    this._startTime = 0;
    this._events = [];
  }

  /** Count one keystroke. Pass `key` to also record it into the run's trace — callers whose
   *  recording scope is narrower than their counting scope simply omit it. */
  addKeystroke(key?: string, mode?: string): void {
    if (!this._running) return;
    this._keystrokes++;
    if (key === undefined) return;
    const e: TraceEvent = { k: key, t: this.clock.now() - this._startTime };
    if (mode) e.m = mode;
    this._events.push(e);
  }

  getKeystrokes(): number {
    return this._keystrokes;
  }

  /** Defensive copy — the caller usually hands this straight to `buildRunTrace`. */
  getEvents(): TraceEvent[] {
    return this._events.map((e) => ({ ...e }));
  }

  getElapsedMs(): number {
    if (!this._running) return 0;
    return this.clock.now() - this._startTime;
  }

  getResult(elapsed_ms?: number): MetricsResult {
    return metricsResult(this._keystrokes, elapsed_ms ?? this.getElapsedMs());
  }
}
