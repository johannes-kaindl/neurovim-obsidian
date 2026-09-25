// Liest Endpunkt, Modell und Schluessel des ERSTEN Endpunkts aus den Plugin-Settings
// (`data.json` → `__settings`). Eigene Datei, damit test/debriefSettings.test.ts die Form
// pruefen kann, ohne das Skript zu starten. Seit 0.9.0 traegt `llmEndpoints` Objekte
// ({ url, apiKey, model }); vor 0.9.0 waren es Strings mit globalem `llmModel`/`llmApiKey`.
// Endpunkte vom LLM Endpoint Manager stehen NICHT in der data.json — dort gibt es sie nicht,
// das Skript bekommt dann --endpoint/--model.
export function pickEndpointSettings(s) {
  const first = (Array.isArray(s.llmEndpoints) ? s.llmEndpoints : [])[0];
  const legacyModel = s.llmModel;
  const legacyKey = s.llmApiKey ?? '';
  if (typeof first === 'string') return { endpoint: first, model: legacyModel, apiKey: legacyKey };
  if (first !== null && typeof first === 'object') {
    return { endpoint: first.url, model: first.model || legacyModel, apiKey: first.apiKey || legacyKey };
  }
  return { endpoint: undefined, model: legacyModel, apiKey: legacyKey };
}
