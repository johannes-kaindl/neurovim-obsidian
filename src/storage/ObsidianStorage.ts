import type { Plugin } from 'obsidian';
import type { StoragePort } from '@neurovim/core';

/** StoragePort over Obsidian's single-blob loadData/saveData (data.json). */
export class ObsidianStorage implements StoragePort {
  constructor(private readonly plugin: Plugin) {}

  async loadData<T>(): Promise<T | null> {
    return ((await this.plugin.loadData()) as T) ?? null;
  }
  async saveData<T>(data: T): Promise<void> {
    await this.plugin.saveData(data);
  }
  async keys(): Promise<string[]> {
    return ['pluginData'];
  }
  async delete(): Promise<void> {
    await this.plugin.saveData(null);
  }
}
