import { describe, it, expect } from 'vitest';
import { Plugin } from 'obsidian';
import { DEFAULT_PLUGIN_DATA } from '@neurovim/core';
import { ObsidianStorage } from '../src/storage/ObsidianStorage';
import { loadPluginData, savePluginData } from '../src/storage/loadPluginData';

describe('loadPluginData', () => {
  it('returns defaults on an empty store', async () => {
    const s = new ObsidianStorage(new Plugin() as never);
    const data = await loadPluginData(s);
    expect(data.total_xp).toBe(0);
    expect(data.unlocked).toEqual(expect.arrayContaining(DEFAULT_PLUGIN_DATA.unlocked));
  });

  it('round-trips saved data and backfills unlocks for completed missions', async () => {
    const s = new ObsidianStorage(new Plugin() as never);
    await savePluginData(s, { ...DEFAULT_PLUGIN_DATA, total_xp: 50, completed_missions: ['M-01'] });
    const data = await loadPluginData(s);
    expect(data.total_xp).toBe(50);
    expect(data.unlocked).toContain('M-01');
  });
});
