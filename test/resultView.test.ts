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

describe('buildResultView — mastery tier', () => {
  it('awards a tier when the mission carries an authored par', () => {
    const v = buildResultView(makeResult({ keystrokes: 20 }), false, 22);
    expect(v.tier).toBe('gold');
    expect(v.par).toBe(22);
  });

  // That a computed par never reaches this function is masteryTier.ts's job, and is
  // tested there. Here the contract is only: no par, no verdict.
  it('withholds the tier when no par was authored for the mission', () => {
    const v = buildResultView(makeResult({ keystrokes: 20 }), false, null);
    expect(v.tier).toBeNull();
    expect(v.par).toBeNull();
  });

  // Keystrokes deliberately > 0: today `unverified` means exactly `keystrokes === 0`
  // (MissionSession.ts), so a zero-keystroke fixture would be caught by tierFor's own
  // guard and prove nothing about this one. This pins the invariant itself — an
  // unverified run is never judged — so it keeps holding if `unverified` ever comes to
  // mean something else, such as an aborted run.
  it('withholds the tier on an unverified run but still names the par', () => {
    const v = buildResultView(makeResult({ keystrokes: 20 }), true, 22);
    expect(v.tier).toBeNull();
    expect(v.par).toBe(22);
  });

  it('stays tierless when no par information is passed at all', () => {
    const v = buildResultView(makeResult({ keystrokes: 20 }));
    expect(v.tier).toBeNull();
    expect(v.par).toBeNull();
  });

  it('grades a slow run down rather than withholding the tier', () => {
    const v = buildResultView(makeResult({ keystrokes: 30 }), false, 22);
    expect(v.tier).toBe('silver'); // 30 <= 22 * 1.5
  });
});
