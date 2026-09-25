import type { HudPlacement } from './hudPlacement';
import { migrateEndpointList, type EndpointConfig } from './vendor/kit/endpoint_config';
import type { EndpointChoice } from './vendor/kit/endpoint-source';

export type ColorScheme = 'crt' | 'native';

export interface VimDojoSettings {
  missionFolder: string;
  /** Hides the mission folder in the file explorer (CSS-only — the folder still syncs and
   *  still exists, only the nav row is suppressed). Off by default: a newly installed
   *  plugin should not make a folder disappear without the user asking for it. */
  hideMissionFolder: boolean;
  hudPlacement: HudPlacement;
  colorScheme: ColorScheme;
  autoVim: boolean;
  openPaneOnStartup: boolean;
  /** Ordered fallback list of OpenAI-compatible endpoints — the first reachable one
   *  wins. Each entry carries its own model (and optionally its own API key) — a model
   *  name only means something on the endpoint that reports it in `/v1/models`, so there
   *  is deliberately no global fallback (removed in 0.9.0, see `foldLegacyModel`). Empty =
   *  feature off. */
  llmEndpoints: EndpointConfig[];
  /** Choice against the LLM Endpoint Manager (endpoint + model). Empty = automatic. Only
   *  relevant while the manager is installed; without it `llmEndpoints` (each with its own
   *  model) is the source. */
  choice: EndpointChoice;
  llmSuppressThinking: boolean;
  recordTraces: boolean;
  pausedBannerMinutes: number;
  uiCollapsed: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: VimDojoSettings = {
  missionFolder: '_neurovim/',
  hideMissionFolder: false,
  hudPlacement: 'auto',
  colorScheme: 'crt',
  autoVim: false,
  openPaneOnStartup: false,
  llmEndpoints: [],
  choice: {},
  llmSuppressThinking: true,
  recordTraces: true,
  pausedBannerMinutes: 5,
  uiCollapsed: {},
};

/** The CIPHER feature is on when there is at least one endpoint and EVERY endpoint carries
 *  its own non-empty model — there is no global fallback (see the `llmEndpoints` doc comment
 *  on why: a model name is meaningless off the endpoint that reports it). */
export function isLlmConfigured(s: Pick<VimDojoSettings, 'llmEndpoints'>): boolean {
  return s.llmEndpoints.length > 0
    && s.llmEndpoints.every((ep) => (ep.model ?? '').trim() !== '');
}

/** `choice` comes from a data.json and is therefore untrusted: only non-empty strings survive. */
export function sanitizeChoice(raw: unknown): EndpointChoice {
  if (raw === null || typeof raw !== 'object') return {};
  const { endpointId, model } = raw as EndpointChoice;
  return {
    ...(typeof endpointId === 'string' && endpointId ? { endpointId } : {}),
    ...(typeof model === 'string' && model ? { model } : {}),
  };
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

/** Applies a legacy GLOBAL model onto every migrated endpoint that doesn't already carry its
 *  own — pre-0.9.0 vim-dojo had one `llmModel` shared by every endpoint in the list; the
 *  kit's per-endpoint EndpointConfig has no equivalent global field, so a plain merge would
 *  silently drop a configured model on upgrade and every endpoint would go from "configured"
 *  to "off" (isLlmConfigured requires a model on EVERY endpoint) without any signal. Same
 *  shape as foldLegacyApiKey — kept separate because the two legacy fields migrate
 *  independently (a data.json can carry one without the other). Pure — no Obsidian
 *  dependency. */
function foldLegacyModel(eps: EndpointConfig[], legacyModel: string | undefined): EndpointConfig[] {
  const model = legacyModel?.trim();
  if (!model) return eps;
  return eps.map((cfg) => (cfg.model ? cfg : { ...cfg, model }));
}

/** Merge a raw `data.json` `__settings` blob onto the defaults, migrating both the 0.4.x
 *  single `llmEndpoint` field and the pre-0.8.0 global `llmApiKey` on the way in. Both legacy
 *  fields are destructured out of `rest` — spreading the source wholesale would carry them
 *  onto the merged settings, and persist() writes that object back to data.json verbatim,
 *  re-seeding dead fields on every save. Pure — no Obsidian dependency — so main.ts's onload
 *  can stay a thin wrapper around it and the migration is testable without a plugin mock. */
export function mergeStoredSettings(raw: unknown): VimDojoSettings {
  const { llmEndpoint, llmApiKey, llmModel, llmEndpoints, ...rest } = (raw ?? {}) as Partial<VimDojoSettings> & {
    llmEndpoint?: string;
    llmApiKey?: string;
    llmModel?: string;
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
    llmEndpoints: foldLegacyModel(foldLegacyApiKey(migrated, llmApiKey), llmModel),
    choice: sanitizeChoice(rest.choice),
    uiCollapsed: { ...DEFAULT_SETTINGS.uiCollapsed, ...rest.uiCollapsed },
  };
}
