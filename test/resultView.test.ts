import { describe, it, expect } from 'vitest';
import { buildResultView, formatDuration } from '../src/result/resultView';
import type { RunResult } from '@neurovim/core';

function makeResult(over: Partial<RunResult> = {}): RunResult {
  return {
    mission_id: 'M-01',
    elapsed_ms: 700,
    keystrokes: 2,
    ks_per_min: 171,
    xp_earned: 15,
    is_new_best_time: false,
    is_new_best_ks: false,
    delta_time_ms: 0,
    delta_keystrokes: 0,
    delta_ks_per_min: 0,
    ...over,
  };
}

describe('formatDuration', () => {
  it('formats sub-minute as one-decimal seconds', () => {
    expect(formatDuration(700)).toBe('0.7s');
    expect(formatDuration(12400)).toBe('12.4s');
  });
  it('formats >= 1 minute as M:SS', () => {
    expect(formatDuration(65000)).toBe('1:05');
  });
});

describe('buildResultView', () => {
  it('first clear: NEW BEST on time+ks, no deltas, no KS/MIN badge', () => {
    const v = buildResultView(makeResult({ is_new_best_time: true, is_new_best_ks: true }));
    expect(v.title).toBe('M-01');
    expect(v.xp).toBe(15);
    const [time, ks, kspm] = v.rows;
    expect(time.label).toBe('TIME');
    expect(time.value).toBe('0.7s');
    expect(time.delta).toBeNull();
    expect(time.newBest).toBe(true);
    expect(ks.newBest).toBe(true);
    expect(ks.delta).toBeNull();
    expect(kspm.label).toBe('KS/MIN');
    expect(kspm.value).toBe('171');
    expect(kspm.newBest).toBe(false);
  });

  it('improvement: all up-arrows, good, badges where new best', () => {
    const v = buildResultView(makeResult({
      is_new_best_time: true, is_new_best_ks: true,
      delta_time_ms: -3000, delta_keystrokes: -2, delta_ks_per_min: 12.4,
    }));
    const [time, ks, kspm] = v.rows;
    expect(time.delta).toEqual({ arrow: '▲', magnitude: '3.0s', good: true });
    expect(ks.delta).toEqual({ arrow: '▲', magnitude: '2', good: true });
    expect(kspm.delta).toEqual({ arrow: '▲', magnitude: '12.4', good: true });
  });

  it('regression: all down-arrows, bad, no badges', () => {
    const v = buildResultView(makeResult({
      delta_time_ms: 2000, delta_keystrokes: 3, delta_ks_per_min: -5.2,
    }));
    const [time, ks, kspm] = v.rows;
    expect(time.delta).toEqual({ arrow: '▼', magnitude: '2.0s', good: false });
    expect(ks.delta).toEqual({ arrow: '▼', magnitude: '3', good: false });
    expect(kspm.delta).toEqual({ arrow: '▼', magnitude: '5.2', good: false });
    expect(time.newBest).toBe(false);
    expect(ks.newBest).toBe(false);
  });

  it('tie: zero deltas render neutral (null), no badges', () => {
    const v = buildResultView(makeResult());
    for (const row of v.rows) {
      expect(row.delta).toBeNull();
      expect(row.newBest).toBe(false);
    }
  });

  it('is verified by default', () => {
    expect(buildResultView(makeResult()).unverified).toBe(false);
  });

  it('marks an unverified run and carries no new-best badges', () => {
    const v = buildResultView(makeResult({ keystrokes: 0, ks_per_min: 0 }), true);
    expect(v.unverified).toBe(true);
    expect(v.rows.every((r) => !r.newBest)).toBe(true);
  });
});
