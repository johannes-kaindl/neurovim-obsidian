// uebernommen aus lingotuner/src/obsidian/http.ts (cachedProbe, fetchJsonAdapter), 2026-09-30
import { requestUrl } from 'obsidian';
import { probeBaseUrl, probeEndpoint as probeBackend, type CapabilityFetch } from '../vendor/kit/capabilities';
import type { BackendId } from '../vendor/kit/sampling-profiles';

const fetchJsonAdapter: CapabilityFetch = async (req) => {
  const res = await requestUrl({ url: req.url, method: req.method ?? 'GET', headers: req.headers, body: req.body, throw: false });
  if (res.status < 200 || res.status >= 300) return null;
  try { return { json: JSON.parse(res.text) as unknown }; } catch { return null; }
};

const BACKEND_CACHE_MS = 30_000;
let backendCache: { url: string; backend: BackendId; at: number } | null = null;

/** Which backend sits behind a URL — cached 30 s per URL (the same rule as the model-list
 *  cache), dropped when the URL changes. Request profiles differ per backend, so every
 *  request needs the answer; probing on each one would add a round trip to every question. */
export async function cachedProbe(url: string, model: string): Promise<BackendId | null> {
  const now = Date.now();
  if (backendCache && backendCache.url === url && now - backendCache.at < BACKEND_CACHE_MS) return backendCache.backend;
  const { backend } = await probeBackend(fetchJsonAdapter, probeBaseUrl(url), model);
  backendCache = { url, backend, at: now };
  return backend;
}
