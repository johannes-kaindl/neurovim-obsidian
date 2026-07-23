import { describe, it, expect } from 'vitest';
import { RunRecorder } from '../src/keystrokeRecorder';
import type { ClockPort } from '../src/vendor/kit/clock';

function fakeClock(times: number[]): ClockPort {
  let i = 0;
  return { now: () => times[Math.min(i++, times.length - 1)], setTimeout: () => 0, clearTimeout: () => {} };
}

describe('RunRecorder', () => {
  it('records keys with t relative to the reset baseline', () => {
    const r = new RunRecorder(fakeClock([1000, 1120, 1190]));
    r.reset();            // base = 1000
    r.record('d');        // t = 120
    r.record('w');        // t = 190
    expect(r.snapshot()).toEqual([{ k: 'd', t: 120 }, { k: 'w', t: 190 }]);
  });

  it('includes mode only when provided', () => {
    const r = new RunRecorder(fakeClock([0, 5]));
    r.reset();
    r.record('i', 'normal');
    expect(r.snapshot()).toEqual([{ k: 'i', m: 'normal', t: 5 }]);
  });

  it('reset clears events and rebaselines', () => {
    const r = new RunRecorder(fakeClock([0, 10, 100, 130]));
    r.reset();
    r.record('x');        // t = 10
    r.reset();            // base = 100
    r.record('y');        // t = 30
    expect(r.snapshot()).toEqual([{ k: 'y', t: 30 }]);
  });

  it('snapshot returns a defensive copy', () => {
    const r = new RunRecorder(fakeClock([0, 1]));
    r.reset();
    r.record('a');
    const snap = r.snapshot();
    snap[0].k = 'MUT';
    expect(r.snapshot()[0].k).toBe('a');
  });
});
