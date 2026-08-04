import { describe, it, expect } from 'vitest';
import { BundledContent } from '../src/content/BundledContent';
import { listLore } from '@neurovim/content';
import { UNLOCK_MAP } from '@neurovim/core';

describe('BundledContent', () => {
  it('lists missions including the default-unlocked M-01', async () => {
    const c = new BundledContent();
    const missions = await c.listMissions();
    expect(missions.length).toBeGreaterThan(0);
    expect(missions.map((m) => m.mission_id)).toContain('M-01');
  });

  it('returns M-01 with a transmission body and a solution target', async () => {
    const c = new BundledContent();
    const doc = await c.getMission('M-01');
    expect(doc.mission_id).toBe('M-01');
    expect(doc.transmissionBody.length).toBeGreaterThan(0);
    expect(typeof doc.solution).toBe('string');
    expect((doc.solution ?? '').length).toBeGreaterThan(0);
  });

  it('returns a lore artifact with a body', async () => {
    const c = new BundledContent();
    const doc = await c.getLore('LOOT-01');
    expect(doc.id).toBe('LOOT-01');
    expect(doc.kind).toBe('loot');
    expect(doc.title.length).toBeGreaterThan(0);
    expect(doc.body.length).toBeGreaterThan(0);
  });

  // Guards the id contract between two independent sources: UNLOCK_MAP writes loot ids
  // into data.unlocked, buildArchive matches them against listLore(). Diverging forms
  // would lock every loot artifact forever — silently.
  it('uses loot ids of the same form UNLOCK_MAP unlocks', () => {
    const lootIds = listLore().filter((l) => l.kind === 'loot').map((l) => l.id);
    const unlockable = Object.values(UNLOCK_MAP).flatMap((u) => u.loot);
    expect(unlockable.length).toBeGreaterThan(0);
    for (const id of unlockable) expect(lootIds).toContain(id);
  });
});
