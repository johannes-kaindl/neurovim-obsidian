import { DEFAULT_PLUGIN_DATA, ProgressionEngine } from '@neurovim/core';
import type { PluginData, StoragePort } from '@neurovim/core';

/** Load PluginData, merge over defaults, backfill entitled unlocks (idempotent). */
export async function loadPluginData(storage: StoragePort): Promise<PluginData> {
  const saved = await storage.loadData<Partial<PluginData>>();
  const merged: PluginData = {
    ...DEFAULT_PLUGIN_DATA,
    ...(saved ?? {}),
    sidebar_module_state: {
      ...DEFAULT_PLUGIN_DATA.sidebar_module_state,
      ...(saved?.sidebar_module_state ?? {}),
    },
    sandbox_bests: {
      ...DEFAULT_PLUGIN_DATA.sandbox_bests,
      ...(saved?.sandbox_bests ?? {}),
    },
    missions: { ...(saved?.missions ?? {}) },
  };
  return ProgressionEngine.backfillUnlocks(merged);
}

export async function savePluginData(storage: StoragePort, data: PluginData): Promise<void> {
  await storage.saveData(data);
}
