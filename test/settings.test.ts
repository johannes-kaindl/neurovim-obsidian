import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, isLlmConfigured, loadRequestSettings, mergeStoredSettings } from '../src/settings';
import { thinkingFor } from '../src/vendor/kit/sampling-profiles';

describe('LLM settings', () => {
  it('defaults to unconfigured (feature off)', () => {
    expect(DEFAULT_SETTINGS.llmEndpoints).toEqual([]);
    expect(isLlmConfigured(DEFAULT_SETTINGS)).toBe(false);
  });

  it('does not think by default (short vim tips, faster answers) — the companion profile says off', () => {
    expect(thinkingFor(DEFAULT_SETTINGS.request, 'companion')).toBe('off');
    expect(DEFAULT_SETTINGS.request.overrides).toEqual({});
  });

  it('records run traces by default (local, transparent telemetry)', () => {
    expect(DEFAULT_SETTINGS.recordTraces).toBe(true);
  });

  it('starts with no persisted section states', () => {
    expect(DEFAULT_SETTINGS.uiCollapsed).toEqual({});
  });

  it('does not hide the mission folder by default (visible unless opted in)', () => {
    expect(DEFAULT_SETTINGS.hideMissionFolder).toBe(false);
  });

  it('requires at least one endpoint, each carrying its own model', () => {
    expect(isLlmConfigured({ llmEndpoints: [{ url: 'http://localhost:1234' }] })).toBe(false);
    expect(isLlmConfigured({ llmEndpoints: [] })).toBe(false);
    expect(isLlmConfigured({ llmEndpoints: [{ url: 'http://localhost:1234', model: 'qwen3' }] })).toBe(true);
  });

  it('stays unconfigured when even one endpoint carries no model of its own', () => {
    // There is no global fallback any more (model belongs on the endpoint row; code-kit
    // 0.16.0 removed the old effectiveModel fallback) — a mixed list with one bare endpoint reads
    // as unconfigured, same as before the migration.
    expect(isLlmConfigured({
      llmEndpoints: [{ url: 'http://a:1', model: 'qwen3' }, { url: 'http://b:2' }],
    })).toBe(false);
  });

  it('defaults the paused-banner threshold to five minutes', () => {
    expect(DEFAULT_SETTINGS.pausedBannerMinutes).toBe(5);
  });
});

describe('mergeStoredSettings — endpoint migration', () => {
  it('lifts a legacy 0.4.x single llmEndpoint into a one-entry EndpointConfig list', () => {
    const settings = mergeStoredSettings({ llmEndpoint: 'http://localhost:1234' });
    expect(settings.llmEndpoints).toEqual([{ url: 'http://localhost:1234' }]);
    expect(Object.hasOwn(settings, 'llmEndpoint')).toBe(false);
  });

  it('lifts a legacy 0.7.x string[] llmEndpoints into EndpointConfig[]', () => {
    const settings = mergeStoredSettings({ llmEndpoints: ['http://a:1', 'http://b:2'] });
    expect(settings.llmEndpoints).toEqual([{ url: 'http://a:1' }, { url: 'http://b:2' }]);
  });

  it('folds a legacy global llmApiKey onto every migrated endpoint, then drops the field', () => {
    const settings = mergeStoredSettings({
      llmEndpoints: ['http://a:1', 'http://b:2'],
      llmApiKey: 'sk-secret',
    });
    expect(settings.llmEndpoints).toEqual([
      { url: 'http://a:1', apiKey: 'sk-secret' },
      { url: 'http://b:2', apiKey: 'sk-secret' },
    ]);
    expect(Object.hasOwn(settings, 'llmApiKey')).toBe(false);
  });

  it('does not overwrite a per-endpoint key that already exists (post-migration data.json)', () => {
    const settings = mergeStoredSettings({
      llmEndpoints: [{ url: 'http://a:1', apiKey: 'own-key' }],
      llmApiKey: 'stale-global',
    });
    expect(settings.llmEndpoints).toEqual([{ url: 'http://a:1', apiKey: 'own-key' }]);
  });

  it('ignores an empty/whitespace legacy global key', () => {
    const settings = mergeStoredSettings({ llmEndpoints: ['http://a:1'], llmApiKey: '   ' });
    expect(settings.llmEndpoints).toEqual([{ url: 'http://a:1' }]);
  });

  it('folds a legacy global llmModel onto every migrated endpoint without its own model, then drops the field', () => {
    // pre-0.9.0 vim-dojo had one global `llmModel` — the per-endpoint EndpointConfig has no
    // equivalent global field, so a plain merge would silently drop a configured model on
    // upgrade and every endpoint would go from "configured" to "off" (isLlmConfigured requires
    // a model on EVERY endpoint) without any signal.
    const settings = mergeStoredSettings({
      llmEndpoints: ['http://a:1', 'http://b:2'],
      llmModel: 'qwen3-8b',
    });
    expect(settings.llmEndpoints).toEqual([
      { url: 'http://a:1', model: 'qwen3-8b' },
      { url: 'http://b:2', model: 'qwen3-8b' },
    ]);
    expect(Object.hasOwn(settings, 'llmModel')).toBe(false);
  });

  it('does not overwrite a per-endpoint model that already exists (post-migration data.json)', () => {
    const settings = mergeStoredSettings({
      llmEndpoints: [{ url: 'http://a:1', model: 'own-model' }],
      llmModel: 'stale-global',
    });
    expect(settings.llmEndpoints).toEqual([{ url: 'http://a:1', model: 'own-model' }]);
  });

  it('ignores an empty/whitespace legacy global model', () => {
    const settings = mergeStoredSettings({ llmEndpoints: ['http://a:1'], llmModel: '   ' });
    expect(settings.llmEndpoints).toEqual([{ url: 'http://a:1' }]);
  });

  it('merges defaults with a raw blob that has no legacy field', () => {
    const settings = mergeStoredSettings({ missionFolder: 'Custom/' });
    expect(settings.missionFolder).toBe('Custom/');
    expect(settings.llmEndpoints).toEqual([]);
  });

  it('handles a missing or null blob by falling back to defaults', () => {
    expect(mergeStoredSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeStoredSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('gives each merge its own uiCollapsed object, not a shared reference to the default', () => {
    const a = mergeStoredSettings({});
    const b = mergeStoredSettings({});
    a.uiCollapsed.cipher = true;
    expect(b.uiCollapsed).toEqual({});
    expect(DEFAULT_SETTINGS.uiCollapsed).toEqual({});
  });

  it('keeps a stored paused-banner threshold, including 0 (disabled)', () => {
    expect(mergeStoredSettings({ pausedBannerMinutes: 0 }).pausedBannerMinutes).toBe(0);
    expect(mergeStoredSettings({ pausedBannerMinutes: 12 }).pausedBannerMinutes).toBe(12);
  });

  it('falls back to the single/empty path instead of throwing on a non-array llmEndpoints', () => {
    // Regression: a hand-edited or corrupted data.json can have llmEndpoints be any JSON value.
    // The vendored kit's migrateEndpointList only guards `list && list.length`, which lets a
    // non-empty string through to .map — that threw and took the whole plugin down with
    // "failed to load plugin" on the next onload.
    expect(mergeStoredSettings({ llmEndpoints: 'http://x:1' }).llmEndpoints).toEqual([]);
    expect(mergeStoredSettings({ llmEndpoint: 'http://legacy:1', llmEndpoints: 'http://x:1' }).llmEndpoints)
      .toEqual([{ url: 'http://legacy:1' }]);
  });
});

describe('choice (Wahl gegenueber dem LLM Endpoint Manager)', () => {
  it('Default ist die leere Wahl', () => {
    expect(DEFAULT_SETTINGS.choice).toEqual({});
    expect(mergeStoredSettings({}).choice).toEqual({});
  });
  it('bleibt aus einer data.json erhalten', () => {
    expect(mergeStoredSettings({ choice: { endpointId: 'a', model: 'm' } }).choice).toEqual({ endpointId: 'a', model: 'm' });
  });
  it('untrusted: nur nicht-leere Strings bleiben', () => {
    expect(mergeStoredSettings({ choice: { endpointId: 5, model: '' } }).choice).toEqual({});
    expect(mergeStoredSettings({ choice: 'quatsch' }).choice).toEqual({});
  });
});

describe('request settings — migration of the legacy llmSuppressThinking switch', () => {
  it('suppress = true (the old default) becomes thinking "off" for the companion mode', () => {
    const { request } = loadRequestSettings({ llmSuppressThinking: true });
    expect(request.thinking.companion).toBe('off');
  });

  it('suppress = false becomes the mode\'s "on" level (never "off")', () => {
    const { request } = loadRequestSettings({ llmSuppressThinking: false });
    expect(request.thinking.companion).toBeDefined();
    expect(request.thinking.companion).not.toBe('off');
  });

  it('an explicit new setting wins over the legacy flag', () => {
    const { request } = loadRequestSettings({ llmSuppressThinking: true, request: { thinking: { companion: 'high' } } });
    expect(request.thinking.companion).toBe('high');
  });

  it('no legacy flag and no request block: nothing is invented', () => {
    expect(loadRequestSettings({}).request.thinking).toEqual({});
    expect(loadRequestSettings(undefined).request.thinking).toEqual({});
  });

  it('mergeStoredSettings applies the migration and drops the legacy field (persist() would re-seed it)', () => {
    const settings = mergeStoredSettings({ llmSuppressThinking: false });
    expect(settings.request.thinking.companion).not.toBe('off');
    expect(Object.hasOwn(settings, 'llmSuppressThinking')).toBe(false);
  });

  it('keeps stored overrides and reports the ones that fail validation instead of dropping them silently', () => {
    const good = loadRequestSettings({ request: { overrides: { companion: { 'qwen3.8': { temperature: 0.4 } } } } });
    expect(good.request.overrides.companion?.['qwen3.8']?.temperature).toBe(0.4);
    expect(good.dropped).toEqual([]);
    const bad = loadRequestSettings({ request: { overrides: { companion: { 'qwen3.8': { temperature: 'hot' } } } } });
    expect(bad.dropped.length).toBeGreaterThan(0);
    expect(bad.request.overrides.companion?.['qwen3.8']?.temperature).toBeUndefined();
  });
});
