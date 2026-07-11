import { App, TFile, normalizePath } from 'obsidian';
import type { MissionApp } from './MissionSession';

/** Real MissionApp over the Obsidian vault. Only ever touches the given note paths. */
export class ObsidianMissionApp implements MissionApp {
  constructor(private readonly app: App) {}

  async ensureFolder(folder: string): Promise<void> {
    const path = normalizePath(folder).replace(/\/+$/, '');
    if (!path) return;
    if (this.app.vault.getAbstractFileByPath(path)) return;
    await this.app.vault.createFolder(path).catch(() => { /* exists / race */ });
  }

  async writeNote(path: string, body: string): Promise<void> {
    const p = normalizePath(path);
    const existing = this.app.vault.getAbstractFileByPath(p);
    if (existing instanceof TFile) await this.app.vault.modify(existing, body);
    else await this.app.vault.create(p, body);
  }

  async readNote(path: string): Promise<string> {
    const f = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (!(f instanceof TFile)) throw new Error(`Note not found: ${path}`);
    return this.app.vault.read(f);
  }

  async openNote(path: string): Promise<void> {
    const f = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (f instanceof TFile) await this.app.workspace.getLeaf(false).openFile(f);
  }

  async noteExists(path: string): Promise<boolean> {
    return this.app.vault.getAbstractFileByPath(normalizePath(path)) instanceof TFile;
  }
}
