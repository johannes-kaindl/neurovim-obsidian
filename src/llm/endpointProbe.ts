/** One-shot reachability probe + model listing against GET /v1/models via Obsidian's
 *  requestUrl (CORS-free, throw:false so error bodies classify instead of throwing).
 *  Never throws — every failure maps to a classified EndpointStatus. */
import { requestUrl } from 'obsidian';
import { normalizeEndpoint } from '../vendor/kit/endpoint';
import { authHeaders, type EndpointConfig } from '../vendor/kit/endpoint_config';
import { classifyEndpointStatus, extractModelIds, type EndpointStatus } from '../vendor/kit/endpoint_diagnostics';
import { withTimeout } from '../vendor/kit/timeout';
import { realClock, type ClockPort } from '../vendor/kit-obsidian/clock';

const PROBE_TIMEOUT_MS = 5_000;

export interface ProbeResult { status: EndpointStatus; models: string[] }

export async function probeEndpoint(cfg: EndpointConfig, clock: ClockPort = realClock): Promise<ProbeResult> {
  const url = `${normalizeEndpoint(cfg.url)}/v1/models`;
  const headers = authHeaders(cfg.apiKey);
  try {
    const result = await withTimeout(
      requestUrl({ url, method: 'GET', headers, throw: false }),
      PROBE_TIMEOUT_MS,
      clock,
    );
    if (result.timedOut) return { status: classifyEndpointStatus({ kind: 'timeout' }), models: [] };
    let body: unknown = null;
    try { body = JSON.parse(result.value.text); } catch { body = null; }
    const status = classifyEndpointStatus({ kind: 'response', status: result.value.status, body });
    return { status, models: status.reachable ? extractModelIds(body) : [] };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: classifyEndpointStatus({ kind: 'error', message }), models: [] };
  }
}
