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
  /** Ordered fallback list of OpenAI-compatible endpoints — the first reachable one
   *  wins. A local endpoint moves with the network (localhost at the host vs. LAN IP
   *  on the road); one synced list covers every network. Empty = feature off. */
  llmEndpoints: string[];
  /** Optional bearer token for cloud proxies (LM Studio/Ollama need none). */
  llmApiKey: string;
  /** Model id to request, e.g. "qwen3-8b". Empty = feature off. */
  llmModel: string;
  /** Ask the model not to think. On by default: vim tips are short, thinking is slow. */
  llmSuppressThinking: boolean;
  /** Collapsed state per settings section, keyed by section id. */
  uiCollapsed: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: VimDojoSettings = {
  missionFolder: 'NeuroVim/',
  hudPlacement: 'auto',
  colorScheme: 'crt',
  autoVim: false,
  openPaneOnStartup: false,
  llmEndpoints: [],
  llmApiKey: '',
  llmModel: '',
  llmSuppressThinking: true,
  uiCollapsed: {},
};

/** Lifts the 0.4.x single `llmEndpoint` into the 0.5.0 `llmEndpoints` list. The list wins
 *  when present (it is the newer field); a lone legacy endpoint becomes a one-entry list.
 *  Pure — the caller applies it to raw `data.json` before defaults are merged. */
export function migrateEndpointList(single: string | undefined, list: string[] | undefined): string[] {
  if (list && list.length) return list.filter((e) => e && e.trim() !== '');
  if (single && single.trim() !== '') return [single.trim()];
  return [];
}

/** The CIPHER uplink is live only when at least one endpoint and a model are set.
 *  Configuration only — reachability is deliberately not checked here, or the chat would
 *  vanish on a dead endpoint instead of reporting the error. */
export function isLlmConfigured(s: Pick<VimDojoSettings, 'llmEndpoints' | 'llmModel'>): boolean {
  return s.llmEndpoints.length > 0 && s.llmModel.trim() !== '';
}

/** Merge a raw `data.json` `__settings` blob onto the defaults, migrating the 0.4.x
 *  `llmEndpoint` field on the way in. Destructure the legacy field out of the rest —
 *  spreading the source wholesale would carry it onto the merged settings, and persist()
 *  writes that object back to data.json verbatim, re-seeding a dead field on every save.
 *  Pure — no Obsidian dependency — so main.ts's onload can stay a thin wrapper around it
 *  and the migration is testable without a plugin mock. */
export function mergeStoredSettings(raw: unknown): VimDojoSettings {
  const { llmEndpoint, ...rest } = (raw ?? {}) as Partial<VimDojoSettings> & { llmEndpoint?: string };
  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    llmEndpoints: migrateEndpointList(llmEndpoint, rest.llmEndpoints),
    // {...DEFAULT_SETTINGS} above is a shallow copy: without this, a raw blob with no
    // uiCollapsed field would carry DEFAULT_SETTINGS.uiCollapsed through by reference, and
    // collapsibleStorage().setCollapsed would then mutate that module-wide constant in
    // place — every settings instance merged afterwards would inherit the stray value.
    // Spreading it fresh here gives every call its own object.
    uiCollapsed: { ...DEFAULT_SETTINGS.uiCollapsed, ...rest.uiCollapsed },
  };
}
