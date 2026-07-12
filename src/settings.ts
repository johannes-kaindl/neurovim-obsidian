import type { HudPlacement } from './hudPlacement';

/** Color palette: fixed CRT look vs. adaptive Obsidian-theme colors. */
export type ColorScheme = 'crt' | 'native';

export interface VimDojoSettings {
  missionFolder: string;
  hudPlacement: HudPlacement;
  colorScheme: ColorScheme;
  /** Turn Obsidian's Vim mode on for the duration of a mission, restore it after. */
  autoVim: boolean;
  /** Open the NeuroVim pane automatically when Obsidian starts. Off by default. */
  openPaneOnStartup: boolean;
}

export const DEFAULT_SETTINGS: VimDojoSettings = {
  missionFolder: 'NeuroVim/',
  hudPlacement: 'auto',
  colorScheme: 'crt',
  autoVim: false,
  openPaneOnStartup: false,
};
