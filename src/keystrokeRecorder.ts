import type { ClockPort } from './vendor/kit/clock';
import type { TraceEvent } from './trace';

/** Accumulates the keystroke sequence of one mission attempt. Pure — timing via
 *  injected ClockPort. Fed from the scoped capture-phase keydown handler in main.ts;
 *  the security scope (active mission + editor target) lives at the call site. */
export class RunRecorder {
  private events: TraceEvent[] = [];
  private base = 0;

  constructor(private readonly clock: ClockPort) {}

  /** Start a fresh attempt: drop events and rebaseline t to now. */
  reset(): void {
    this.events = [];
    this.base = this.clock.now();
  }

  record(key: string, mode?: string): void {
    const e: TraceEvent = { k: key, t: this.clock.now() - this.base };
    if (mode) e.m = mode;
    this.events.push(e);
  }

  snapshot(): TraceEvent[] {
    return this.events.map((e) => ({ ...e }));
  }
}
