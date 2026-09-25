import { describe, it, expect } from 'vitest';
import { pickEndpointSettings } from '../scripts/debrief-settings.mjs';

// Die Form der data.json ist die des Plugins: seit 0.9.0 traegt `llmEndpoints` Objekte
// ({ url, apiKey, model }), davor Strings. Das Skript las es als String und brach mit TypeError.
describe('debrief-lab · pickEndpointSettings', () => {
  it('liest url, model und apiKey aus dem ersten Endpunkt-Objekt (aktuelle Form)', () => {
    const s = { llmEndpoints: [{ url: 'http://a:1234', apiKey: 'sk-a', model: 'qwen3' }, { url: 'http://b:1' }] };
    expect(pickEndpointSettings(s)).toEqual({ endpoint: 'http://a:1234', model: 'qwen3', apiKey: 'sk-a' });
  });

  it('Objekt ohne eigenes Modell/Schluessel: faellt auf die Alt-Felder zurueck', () => {
    const s = { llmEndpoints: [{ url: 'http://a:1234' }], llmModel: 'alt-modell', llmApiKey: 'sk-alt' };
    expect(pickEndpointSettings(s)).toEqual({ endpoint: 'http://a:1234', model: 'alt-modell', apiKey: 'sk-alt' });
  });

  it('Alt-Form (blanke Strings vor 0.9.0) bleibt lesbar', () => {
    const s = { llmEndpoints: ['http://a:1234'], llmModel: 'alt-modell' };
    expect(pickEndpointSettings(s)).toEqual({ endpoint: 'http://a:1234', model: 'alt-modell', apiKey: '' });
  });

  it('leere oder fehlende Liste: kein Endpunkt, kein Absturz', () => {
    expect(pickEndpointSettings({})).toEqual({ endpoint: undefined, model: undefined, apiKey: '' });
    expect(pickEndpointSettings({ llmEndpoints: [] }).endpoint).toBeUndefined();
    expect(pickEndpointSettings({ llmEndpoints: 'quatsch' }).endpoint).toBeUndefined();
  });
});
