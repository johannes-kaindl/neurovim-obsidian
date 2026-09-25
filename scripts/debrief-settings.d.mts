export function pickEndpointSettings(s: {
  llmEndpoints?: unknown;
  llmModel?: string;
  llmApiKey?: string;
}): { endpoint: string | undefined; model: string | undefined; apiKey: string };
