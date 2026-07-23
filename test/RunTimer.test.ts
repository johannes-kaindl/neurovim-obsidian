import { describe, it, expect } from 'vitest';
import { RunTimer } from '../src/RunTimer';
import type { ClockPort } from '../src/vendor/kit/clock';

/** Controllable clock: `at` is the current wall time in ms. */
function fakeClock(): ClockPort & { at: number } {
  const c = {
    at: 1_000,
    now: () => c.at,
    setTimeout: () => 0,
    clearTimeout: () => {},
  };
  return c;
}

describe('RunTimer', () => {
  it('accumulates time across a pause', () => {
    const clock = fakeClock();
    const t = new RunTimer(clock);
    t.start();
    clock.at += 5_000;
    t.pause();
    clock.at += 60_000;      // paused — must not count
    expect(t.elapsedMs()).toBe(5_000);
    t.resume();
    clock.at += 2_000;
    expect(t.elapsedMs()).toBe(7_000);
  });

  it('treats pause on a paused timer and resume on a running one as no-ops', () => {
    const clock = fakeClock();
    const t = new RunTimer(clock);
    t.start();
    clock.at += 1_000;
    t.pause();
    t.pause();               // idempotent
    clock.at += 10_000;
    t.resume();
    t.resume();              // idempotent — must not restart the segment
    clock.at += 1_000;
    expect(t.elapsedMs()).toBe(2_000);
  });

  it('start() discards a previous run', () => {
    const clock = fakeClock();
    const t = new RunTimer(clock);
    t.start();
    clock.at += 9_000;
    t.start();
    clock.at += 1_000;
    expect(t.elapsedMs()).toBe(1_000);
  });

  it('reset() zeroes and stops the timer', () => {
    const clock = fakeClock();
    const t = new RunTimer(clock);
    t.start();
    clock.at += 3_000;
    t.reset();
    expect(t.running).toBe(false);
    clock.at += 5_000;
    expect(t.elapsedMs()).toBe(0);
  });
});
