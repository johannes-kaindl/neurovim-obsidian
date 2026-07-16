import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, isLlmConfigured, mergeStoredSettings, migrateEndpointList } from '../src/settings';

describe('LLM settings', () => {
  it('defaults to unconfigured (feature off)', () => {
    expect(DEFAULT_SETTINGS.llmEndpoints).toEqual([]);
    expect(DEFAULT_SETTINGS.llmApiKey).toBe('');
    expect(DEFAULT_SETTINGS.llmModel).toBe('');
    expect(isLlmConfigured(DEFAULT_SETTINGS)).toBe(false);
  });

  it('suppresses thinking by default (short vim tips, faster answers)', () => {
    expect(DEFAULT_SETTINGS.llmSuppressThinking).toBe(true);
  });

  it('starts with no persisted section states', () => {
    expect(DEFAULT_SETTINGS.uiCollapsed).toEqual({});
  });

  it('requires at least one endpoint and a model', () => {
    expect(isLlmConfigured({ llmEndpoints: ['http://localhost:1234'], llmModel: '' })).toBe(false);
    expect(isLlmConfigured({ llmEndpoints: [], llmModel: 'qwen3' })).toBe(false);
    expect(isLlmConfigured({ llmEndpoints: ['http://localhost:1234'], llmModel: 'qwen3' })).toBe(true);
  });
});

describe('migrateEndpointList', () => {
  it('keeps an existing list and drops blank entries', () => {
    expect(migrateEndpointList(undefined, ['http://a:1', '  ', 'http://b:2'])).toEqual(['http://a:1', 'http://b:2']);
  });

  it('lifts a single 0.4.x endpoint into a one-entry list', () => {
    expect(migrateEndpointList('http://localhost:1234', undefined)).toEqual(['http://localhost:1234']);
    expect(migrateEndpointList('  http://localhost:1234  ', undefined)).toEqual(['http://localhost:1234']);
  });

  it('prefers the list when both are present (list is the newer field)', () => {
    expect(migrateEndpointList('http://old:1', ['http://new:2'])).toEqual(['http://new:2']);
  });

  it('yields an empty list when nothing is configured', () => {
    expect(migrateEndpointList(undefined, undefined)).toEqual([]);
    expect(migrateEndpointList('   ', [])).toEqual([]);
  });
});

describe('mergeStoredSettings', () => {
  it('lifts a legacy llmEndpoint into llmEndpoints and does not carry the dead field along', () => {
    const settings = mergeStoredSettings({ llmEndpoint: 'http://localhost:1234' });
    expect(settings.llmEndpoints).toEqual(['http://localhost:1234']);
    // The legacy field must not survive onto the merged settings object — persist() writes
    // this object back to data.json verbatim, so any stray property here would be re-seeded
    // into storage on every save, forever, even though 0.5.0 never reads it again.
    expect(Object.hasOwn(settings, 'llmEndpoint')).toBe(false);
  });

  it('merges defaults with a raw blob that has no legacy field', () => {
    const settings = mergeStoredSettings({ missionFolder: 'Custom/' });
    expect(settings.missionFolder).toBe('Custom/');
    expect(settings.llmEndpoints).toEqual([]);
    expect(Object.hasOwn(settings, 'llmEndpoint')).toBe(false);
  });

  it('handles a missing or null blob by falling back to defaults', () => {
    expect(mergeStoredSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeStoredSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});
