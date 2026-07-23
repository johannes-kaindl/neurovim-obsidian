import type { ClockPort } from './vendor/kit/clock';

/**
 * Pausable elapsed-time counter for one mission run. Accumulates completed segments and
 * adds the live one while running. Exists because the vendored MetricsTracker computes
 * `Date.now() - startTime` and has no pause — and the vendor is read-only.
 */
export class RunTimer {
  private accumulated = 0;
  /** Wall time the current segment began, or null while paused/stopped. */
  private segmentStart: number | null = null;

  constructor(private readonly clock: ClockPort) {}

  get running(): boolean { return this.segmentStart !== null; }

  /** Begin a fresh run — discards anything accumulated before. */
  start(): void {
    this.accumulated = 0;
    this.segmentStart = this.clock.now();
  }

  /** Fold the live segment into the accumulator. No-op when already paused. */
  pause(): void {
    if (this.segmentStart === null) return;
    this.accumulated += this.clock.now() - this.segmentStart;
    this.segmentStart = null;
  }

  /** Open a new segment. No-op when already running — presence sync may call this repeatedly. */
  resume(): void {
    if (this.segmentStart !== null) return;
    this.segmentStart = this.clock.now();
  }

  reset(): void {
    this.accumulated = 0;
    this.segmentStart = null;
  }

  elapsedMs(): number {
    const live = this.segmentStart === null ? 0 : this.clock.now() - this.segmentStart;
    return this.accumulated + live;
  }
}
