import type { HudPlacement } from './hudPlacement';

export interface VimDojoSettings {
  missionFolder: string;
  hudPlacement: HudPlacement;
}

export const DEFAULT_SETTINGS: VimDojoSettings = {
  missionFolder: 'NeuroVim/',
  hudPlacement: 'auto',
};
