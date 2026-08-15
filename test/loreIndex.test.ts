import { describe, it, expect } from 'vitest';
import { buildArchive } from '../src/lore/loreIndex';
import type { LoreSummary } from '@neurovim/content';

const lore = (
  id: string,
  kind: LoreSummary['kind'],
  unlockLevel: number | null = null,
): LoreSummary => ({ id, kind, title: `T-${id}`, summary: `S-${id}`, unlockLevel });

describe('buildArchive', () => {
  it('groups loot and fragments into separate sections, in manifest order', () => {
    const out = buildArchive(
      [lore('LOOT-01', 'loot', 2), lore('FRAGMENT-01', 'fragment'), lore('LOOT-02', 'loot', 3)],
      ['LOOT-01', 'LOOT-02'],
    );
    expect(out.map((s) => s.kind)).toEqual(['loot', 'fragment']);
    expect(out[0].entries.map((e) => e.id)).toEqual(['LOOT-01', 'LOOT-02']);
    expect(out[1].entries.map((e) => e.id)).toEqual(['FRAGMENT-01']);
  });

  it('drops ref entries entirely', () => {
    const out = buildArchive([lore('REF-EN', 'ref'), lore('FRAGMENT-01', 'fragment')], []);
    expect(out.flatMap((s) => s.entries).map((e) => e.id)).toEqual(['FRAGMENT-01']);
  });

  it('marks loot missing from unlocked as locked, keeping title and level', () => {
    const [loot] = buildArchive([lore('LOOT-05', 'loot', 6)], []);
    expect(loot.entries[0]).toMatchObject({
      id: 'LOOT-05', title: 'T-LOOT-05', locked: true, unlockLevel: 6,
    });
  });

  it('marks loot present in unlocked as open', () => {
    const [loot] = buildArchive([lore('LOOT-01', 'loot', 2)], ['LOOT-01']);
    expect(loot.entries[0].locked).toBe(false);
  });

  it('never locks fragments, even with an empty unlocked list', () => {
    const [frag] = buildArchive([lore('FRAGMENT-01', 'fragment')], []);
    expect(frag.entries[0].locked).toBe(false);
  });

  it('ignores unknown ids in unlocked', () => {
    const [loot] = buildArchive([lore('LOOT-01', 'loot', 2)], ['M-01', 'LOOT-99', 'LOOT-01']);
    expect(loot.entries[0].locked).toBe(false);
  });

  it('omits a section that would be empty', () => {
    const out = buildArchive([lore('FRAGMENT-01', 'fragment')], []);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('fragment');
  });
});

describe('buildArchive — section counts', () => {
  it('reports how many of a section are open, so a collapsed header still informs', () => {
    const [loot] = buildArchive(
      [lore('LOOT-01', 'loot', 2), lore('LOOT-02', 'loot', 3), lore('LOOT-03', 'loot', 4)],
      ['LOOT-01'],
    );
    expect(loot.total).toBe(3);
    expect(loot.openCount).toBe(1);
  });

  it('counts every fragment as open — fragments never gate on progress', () => {
    const [frag] = buildArchive([lore('FRAGMENT-01', 'fragment'), lore('FRAGMENT-02', 'fragment')], []);
    expect(frag.openCount).toBe(frag.total);
    expect(frag.total).toBe(2);
  });
})
