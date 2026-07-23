import { describe, it, expect } from 'vitest';
import { DEFAULT_PLUGIN_DATA } from '@neurovim/core';
import type { PluginData } from '@neurovim/core';
import { BundledContent } from '../src/content/BundledContent';
import { MissionSession } from '../src/MissionSession';
import { makeFakeMissionApp } from './obsidian-mock';
import type { ClockPort } from '../src/vendor/kit/clock';

/** Controllable clock: `at` is the current wall time in ms. */
function fakeClock(): ClockPort & { at: number } {
  const c = { at: 1_000, now: () => c.at, setTimeout: () => 0, clearTimeout: () => {} };
  return c;
}

function makeSession(app = makeFakeMissionApp()) {
  let data: PluginData = { ...DEFAULT_PLUGIN_DATA };
  const clock = fakeClock();
  const session = new MissionSession({
    app,
    content: new BundledContent(),
    getFolder: () => 'NeuroVim/',
    getData: () => data,
    setData: async (d) => { data = d; },
    clock,
  });
  return { session, app, clock, getData: () => data };
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

describe('MissionSession lifecycle', () => {
  it('starts idle and becomes active on start', async () => {
    const { session } = makeSession();
    expect(session.state).toBe('idle');
    await session.start('M-01');
    expect(session.state).toBe('active');
  });

  it('stops the clock while paused and continues on resume', async () => {
    const { session, clock } = makeSession();
    await session.start('M-01');
    clock.at += 4_000;
    session.pause();
    expect(session.state).toBe('paused');
    clock.at += 100_000;                    // away — must not count
    session.resume();
    clock.at += 1_000;
    expect(session.metrics.getKeystrokes()).toBe(0);
    expect(session.elapsedMs()).toBe(5_000);
  });

  it('reports how long it has been paused', async () => {
    const { session, clock } = makeSession();
    await session.start('M-01');
    session.pause();
    clock.at += 7_000;
    expect(session.pausedMs()).toBe(7_000);
    session.resume();
    expect(session.pausedMs()).toBe(0);
  });

  it('ignores pause when idle and resume when active', async () => {
    const { session } = makeSession();
    session.pause();
    expect(session.state).toBe('idle');
    await session.start('M-01');
    session.resume();
    expect(session.state).toBe('active');
  });

  it('returns to idle on end', async () => {
    const { session } = makeSession();
    await session.start('M-01');
    session.end();
    expect(session.state).toBe('idle');
    expect(session.elapsedMs()).toBe(0);
  });

  it('reset keeps the paused state and leaves the timer stopped', async () => {
    const { session, clock } = makeSession();
    await session.start('M-01');
    clock.at += 3_000;
    session.pause();
    await session.reset();
    expect(session.state).toBe('paused');
    clock.at += 5_000;
    expect(session.elapsedMs()).toBe(0);
  });

  it('reset while active restarts the timer from zero', async () => {
    const { session, clock } = makeSession();
    await session.start('M-01');
    clock.at += 3_000;
    await session.reset();
    clock.at += 2_000;
    expect(session.elapsedMs()).toBe(2_000);
  });

  it('reports live line progress against the solution', async () => {
    const { session } = makeSession();
    await session.start('M-01');
    const doc = await new BundledContent().getMission('M-01');
    const full = session.progressFor(doc.solution!);
    expect(full.matched).toBe(full.total);
    const broken = session.progressFor('nonsense');
    expect(broken.matched).toBe(0);
  });

  it('reports divergent line indices for a body', async () => {
    const { session } = makeSession();
    await session.start('M-01');
    const doc = await new BundledContent().getMission('M-01');
    expect(session.divergentLinesFor(doc.solution!)).toEqual([]);
    expect(session.divergentLinesFor('nonsense').length).toBeGreaterThan(0);
  });
});

describe('MissionSession unverified runs', () => {
  it('flags a zero-keystroke win and leaves best scores untouched', async () => {
    const { session, app, getData } = makeSession();
    const doc = await new BundledContent().getMission('M-01');

    // First: an honest run with keystrokes, establishing a best.
    await session.start('M-01');
    session.metrics.addKeystroke();
    session.metrics.addKeystroke();
    app.store[session.notePath!] = doc.solution!;
    const honest = await session.submit();
    expect(honest.ok).toBe(true);
    if (honest.ok) expect(honest.unverified).toBe(false);
    expect(getData().missions['M-01'].best_keystrokes).toBe(2);

    // Then: a run without a single keystroke must not overwrite it.
    session.end();
    await session.start('M-01');
    app.store[session.notePath!] = doc.solution!;
    const untyped = await session.submit();
    expect(untyped.ok).toBe(true);
    if (untyped.ok) {
      expect(untyped.unverified).toBe(true);
      expect(untyped.result.is_new_best_ks).toBe(false);
      expect(untyped.result.is_new_best_time).toBe(false);
    }
    expect(getData().missions['M-01'].best_keystrokes).toBe(2);
    expect(getData().missions['M-01'].runs).toBe(2);
  });

  it('still awards XP and completion for an unverified run', async () => {
    const { session, app, getData } = makeSession();
    const doc = await new BundledContent().getMission('M-01');
    await session.start('M-01');
    app.store[session.notePath!] = doc.solution!;
    const res = await session.submit();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.result.xp_earned).toBe(doc.xp_reward);
    expect(getData().completed_missions).toContain('M-01');
  });
});
