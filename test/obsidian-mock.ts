// Minimal Obsidian mock for vitest — grows only as tasks need it.
export class Plugin {
  private _data: unknown = null;
  async loadData(): Promise<unknown> { return this._data; }
  async saveData(data: unknown): Promise<void> { this._data = data; }
}
export class Notice { constructor(public message: string) {} }
export class TFile { constructor(public path: string) {} }
export class ItemView {}
export class PluginSettingTab {}
export class Setting { constructor(_containerEl: unknown) {} }
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/');
}

// ── Fake MissionApp surface (Task 4) ─────────────────────────
export interface FakeStore { [path: string]: string; }
export function makeFakeMissionApp(store: FakeStore = {}) {
  const opened: string[] = [];
  return {
    store, opened,
    async ensureFolder(_folder: string): Promise<void> { /* no-op in mock */ },
    async writeNote(path: string, body: string): Promise<void> { store[path] = body; },
    async readNote(path: string): Promise<string> {
      if (!(path in store)) throw new Error(`ENOENT ${path}`);
      return store[path];
    },
    async openNote(path: string): Promise<void> { opened.push(path); },
    async noteExists(path: string): Promise<boolean> { return path in store; },
  };
}
