import { describe, it, expect } from 'vitest';
import { authoredPar, bestTier } from '../src/masteryTier';
import type { MissionRecord, MissionSummary } from '@neurovim/core';

function mission(over: Partial<MissionSummary> = {}): MissionSummary {
  return {
    mission_id: 'M-01', mission_type: 'practice', title: 'The Three Modes',
    category: 'fundamentals', xp_reward: 15, locked: false, tier: '🔴 INDOCTRINATION',
    arc: 'I', chapter: '01 - Indoctrination', ...over,
  } as MissionSummary;
}
function record(best_keystrokes: number): MissionRecord {
  return { best_time_ms: 1000, best_keystrokes, best_ks_per_min: 60, runs: 1, last_run: '' };
}

describe('authoredPar', () => {
  it('returns the par a human wrote for the mission', () => {
    expect(authoredPar(mission({ par_keystrokes: 22, difficulty: 1 }))).toBe(22);
  });

  it('returns null when only the difficulty formula could answer', () => {
    expect(authoredPar(mission({ difficulty: 2 }))).toBeNull();
  });
});

describe('bestTier', () => {
  it('grades the best run against an authored par', () => {
    expect(bestTier(mission({ par_keystrokes: 22 }), record(20))).toBe('gold');
    expect(bestTier(mission({ par_keystrokes: 22 }), record(30))).toBe('silver');
  });

  it('stays silent for a mission nobody set a par for', () => {
    expect(bestTier(mission({ difficulty: 1 }), record(20))).toBeNull();
  });

  it('stays silent for a mission never played', () => {
    expect(bestTier(mission({ par_keystrokes: 22 }), undefined)).toBeNull();
  });
});
