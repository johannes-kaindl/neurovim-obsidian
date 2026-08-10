import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, isLlmConfigured, mergeStoredSettings } from '../src/settings';

describe('LLM settings', () => {
  it('defaults to unconfigured (feature off)', () => {
    expect(DEFAULT_SETTINGS.llmEndpoints).toEqual([]);
    expect(DEFAULT_SETTINGS.llmModel).toBe('');
    expect(isLlmConfigured(DEFAULT_SETTINGS)).toBe(false);
  });

  it('suppresses thinking by default (short vim tips, faster answers)', () => {
    expect(DEFAULT_SETTINGS.llmSuppressThinking).toBe(true);
  });

  it('records run traces by default (local, transparent telemetry)', () => {
    expect(DEFAULT_SETTINGS.recordTraces).toBe(true);
  });

  it('starts with no persisted section states', () => {
    expect(DEFAULT_SETTINGS.uiCollapsed).toEqual({});
  });

  it('requires at least one endpoint and a model', () => {
    expect(isLlmConfigured({ llmEndpoints: [{ url: 'http://localhost:1234' }], llmModel: '' })).toBe(false);
    expect(isLlmConfigured({ llmEndpoints: [], llmModel: 'qwen3' })).toBe(false);
    expect(isLlmConfigured({ llmEndpoints: [{ url: 'http://localhost:1234' }], llmModel: 'qwen3' })).toBe(true);
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
});
