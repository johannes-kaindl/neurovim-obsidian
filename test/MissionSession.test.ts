import { describe, it, expect } from 'vitest';
import { DEFAULT_PLUGIN_DATA } from '@neurovim/core';
import type { PluginData } from '@neurovim/core';
import { BundledContent } from '../src/content/BundledContent';
import { MissionSession } from '../src/MissionSession';
import { makeFakeMissionApp } from './obsidian-mock';

function makeSession(app = makeFakeMissionApp()) {
  let data: PluginData = { ...DEFAULT_PLUGIN_DATA };
  const session = new MissionSession({
    app,
    content: new BundledContent(),
    getFolder: () => 'NeuroVim/',
    getData: () => data,
    setData: async (d) => { data = d; },
  });
  return { session, app, getData: () => data };
}

describe('MissionSession', () => {
  it('materializes the corrupted transmission into a note and opens it', async () => {
    const { session, app } = makeSession();
    await session.start('M-01');
    expect(session.activeMissionId).toBe('M-01');
    expect(session.notePath).toBe('NeuroVim/M-01-The-Three-Modes.md');
    expect(app.store[session.notePath!].length).toBeGreaterThan(0);
    expect(app.opened).toContain(session.notePath);
  });

  it('submit fails (ok:false) when the note still holds the corrupted body', async () => {
    const { session } = makeSession();
    await session.start('M-01');
    const res = await session.submit();
    expect(res.ok).toBe(false);
  });

  it('submit succeeds and awards XP when the note equals the solution', async () => {
    const { session, app, getData } = makeSession();
    await session.start('M-01');
    const doc = await new BundledContent().getMission('M-01');
    app.store[session.notePath!] = doc.solution!;
    const res = await session.submit();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.result.xp_earned).toBe(doc.xp_reward);
    expect(getData().completed_missions).toContain('M-01');
    expect(getData().missions['M-01'].runs).toBe(1);
  });
});
