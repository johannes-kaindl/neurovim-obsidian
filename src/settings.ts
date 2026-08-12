import type { HudPlacement } from './hudPlacement';
import { effectiveModel, migrateEndpointList, type EndpointConfig } from './vendor/kit/endpoint_config';

export type ColorScheme = 'crt' | 'native';

export interface VimDojoSettings {
  missionFolder: string;
  hudPlacement: HudPlacement;
  colorScheme: ColorScheme;
  autoVim: boolean;
  openPaneOnStartup: boolean;
  /** Ordered fallback list of OpenAI-compatible endpoints — the first reachable one
   *  wins. Each entry may carry its own API key and model override; a bare
   *  `{ url }` falls back to the global key-less/`llmModel` request. Empty = feature off. */
  llmEndpoints: EndpointConfig[];
  /** Model id to request when an endpoint has no override, e.g. "qwen3-8b". Empty = feature off. */
  llmModel: string;
  llmSuppressThinking: boolean;
  recordTraces: boolean;
  pausedBannerMinutes: number;
  uiCollapsed: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: VimDojoSettings = {
  missionFolder: '_neurovim/',
  hudPlacement: 'auto',
  colorScheme: 'crt',
  autoVim: false,
  openPaneOnStartup: false,
  llmEndpoints: [],
  llmModel: '',
  llmSuppressThinking: true,
  recordTraces: true,
  pausedBannerMinutes: 5,
  uiCollapsed: {},
};

/** The CIPHER feature is on when there is at least one endpoint and EVERY endpoint would
 *  resolve to a non-empty model. Gating on the global `llmModel` alone locked out the setup
 *  the per-endpoint override exists for: a single endpoint carrying its own model and no
 *  global default is fully configured, yet read as "off". A strict generalization of the old
 *  check — with no overrides in play, `effectiveModel` is the global model for every entry. */
export function isLlmConfigured(s: Pick<VimDojoSettings, 'llmEndpoints' | 'llmModel'>): boolean {
  return s.llmEndpoints.length > 0
    && s.llmEndpoints.every((ep) => effectiveModel(ep, s.llmModel).trim() !== '');
}

/** Applies a legacy GLOBAL API key onto every migrated endpoint that doesn't already carry
 *  its own — vim-dojo pre-0.8.0 had one Bearer token shared by every endpoint in the list;
 *  the kit's per-endpoint EndpointConfig has no equivalent global field, so a plain
 *  migrateEndpointList() call would silently drop a configured key on upgrade and every
 *  endpoint would go from authenticated to anonymous without any signal. Pure — no Obsidian
 *  dependency. */
function foldLegacyApiKey(eps: EndpointConfig[], legacyKey: string | undefined): EndpointConfig[] {
  const key = legacyKey?.trim();
  if (!key) return eps;
  return eps.map((cfg) => (cfg.apiKey ? cfg : { ...cfg, apiKey: key }));
}

/** Merge a raw `data.json` `__settings` blob onto the defaults, migrating both the 0.4.x
 *  single `llmEndpoint` field and the pre-0.8.0 global `llmApiKey` on the way in. Both legacy
 *  fields are destructured out of `rest` — spreading the source wholesale would carry them
 *  onto the merged settings, and persist() writes that object back to data.json verbatim,
 *  re-seeding dead fields on every save. Pure — no Obsidian dependency — so main.ts's onload
 *  can stay a thin wrapper around it and the migration is testable without a plugin mock. */
export function mergeStoredSettings(raw: unknown): VimDojoSettings {
  const { llmEndpoint, llmApiKey, llmEndpoints, ...rest } = (raw ?? {}) as Partial<VimDojoSettings> & {
    llmEndpoint?: string;
    llmApiKey?: string;
    llmEndpoints?: (string | EndpointConfig)[];
  };
  // migrateEndpointList (vendored from the kit) does not guard Array.isArray — a hand-edited or
  // corrupted data.json can put any JSON value under llmEndpoints (e.g. a bare string), and that
  // reaches .map inside migrateEndpointList and throws, taking the whole plugin down with "failed
  // to load plugin" on the next onload. Coerce a non-array value to undefined here, at the
  // untrusted-input boundary, rather than editing the vendored file.
  const safeList = Array.isArray(llmEndpoints) ? llmEndpoints : undefined;
  const migrated = migrateEndpointList(llmEndpoint, safeList);
  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    llmEndpoints: foldLegacyApiKey(migrated, llmApiKey),
    uiCollapsed: { ...DEFAULT_SETTINGS.uiCollapsed, ...rest.uiCollapsed },
  };
}
