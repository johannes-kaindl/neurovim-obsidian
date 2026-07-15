/** One-shot reachability probe + model listing against GET /v1/models via Obsidian's
 *  requestUrl (CORS-free, throw:false so error bodies classify instead of throwing).
 *  Never throws — every failure maps to a classified EndpointStatus. */
import { requestUrl } from 'obsidian';
import { normalizeEndpoint } from '../vendor/kit/endpoint';
import { classifyEndpointStatus, type EndpointStatus } from '../vendor/kit/endpoint_diagnostics';
import { extractModelIds } from './modelList';

const PROBE_TIMEOUT_MS = 5_000;

export interface ProbeResult { status: EndpointStatus; models: string[] }

export async function probeEndpoint(endpoint: string, apiKey: string): Promise<ProbeResult> {
  const url = `${normalizeEndpoint(endpoint)}/v1/models`;
  const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const timeout = new Promise<'timeout'>((res) => window.setTimeout(() => res('timeout'), PROBE_TIMEOUT_MS));
  try {
    const r = await Promise.race([requestUrl({ url, method: 'GET', headers, throw: false }), timeout]);
    if (r === 'timeout') return { status: classifyEndpointStatus({ kind: 'timeout' }), models: [] };
    let body: unknown = null;
    try { body = JSON.parse(r.text); } catch { body = null; }
    const status = classifyEndpointStatus({ kind: 'response', status: r.status, body });
    return { status, models: status.reachable ? extractModelIds(body) : [] };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: classifyEndpointStatus({ kind: 'error', message }), models: [] };
  }
}
