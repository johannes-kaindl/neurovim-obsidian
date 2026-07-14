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
  /** OpenAI-compatible endpoint for the optional CIPHER uplink. Empty = feature off. */
  llmEndpoint: string;
  /** Optional bearer token for cloud proxies (LM Studio/Ollama need none). */
  llmApiKey: string;
  /** Model id to request, e.g. "qwen3-8b". Empty = feature off. */
  llmModel: string;
}

export const DEFAULT_SETTINGS: VimDojoSettings = {
  missionFolder: 'NeuroVim/',
  hudPlacement: 'auto',
  colorScheme: 'crt',
  autoVim: false,
  openPaneOnStartup: false,
  llmEndpoint: '',
  llmApiKey: '',
  llmModel: '',
};

/** The CIPHER uplink is live only when both an endpoint and a model are set. */
export function isLlmConfigured(s: Pick<VimDojoSettings, 'llmEndpoint' | 'llmModel'>): boolean {
  return s.llmEndpoint.trim() !== '' && s.llmModel.trim() !== '';
}
