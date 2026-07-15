import { describe, it, expect } from 'vitest';
import { nextMission } from '../src/nextMission';
import type { MissionSummary, PluginData } from '@neurovim/core';

const m = (id: string): MissionSummary => ({
  mission_id: id, mission_type: 'practice', title: id, category: 'c',
  xp_reward: 10, locked: false, tier: '',
} as MissionSummary);

const data = (unlocked: string[], completed: string[]): PluginData =>
  ({ unlocked, completed_missions: completed, total_xp: 0 } as unknown as PluginData);

describe('nextMission', () => {
  it('returns the first unlocked, not-yet-completed mission in list order', () => {
    const missions = [m('M-01'), m('M-02'), m('M-03')];
    expect(nextMission(missions, data(['M-01', 'M-02', 'M-03'], ['M-01']))?.mission_id).toBe('M-02');
  });
  it('skips locked missions', () => {
    const missions = [m('M-01'), m('M-02')];
    expect(nextMission(missions, data(['M-02'], []))?.mission_id).toBe('M-02');
  });
  it('returns null when everything unlocked is completed', () => {
    expect(nextMission([m('M-01')], data(['M-01'], ['M-01']))).toBeNull();
  });
});
