/**
 * StoragePort — persistence abstraction (ADR-001 §P3 / Decisions D5).
 *
 * Encapsulates loading/saving the persistent player state (`PluginData`).
 * - adapter-obsidian: `plugin.loadData()` / `plugin.saveData()` (→ data.json)
 * - adapter-web:      IndexedDB (+ one-time data.json import for legacy users)
 *
 * Kept generic (`<T>`) so that partial states (e.g. audio settings)
 * can also be stored under their own keys. The main state is `PluginData` (types.ts).
 */
export interface StoragePort {
  /** Loads the state stored under `key`; `null`/default handling is up to the caller. */
  loadData<T>(key?: string): Promise<T | null>;

  /** Persists `data` under `key` (default key = main state). */
  saveData<T>(data: T, key?: string): Promise<void>;

  /** All existing keys (for migration / debug). */
  keys(): Promise<string[]>;

  /** Removes a key (for reset / migration). */
  delete(key: string): Promise<void>;
}
