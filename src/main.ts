import { Plugin } from 'obsidian';

export default class NeuroVimPlugin extends Plugin {
  async onload(): Promise<void> {
    console.log('NeuroVim loaded');
  }
  onunload(): void {
    console.log('NeuroVim unloaded');
  }
}
