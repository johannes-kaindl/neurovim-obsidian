/** Failover orchestration around the kit's endpoint-source resolver. The kit deliberately
 *  does one resolver pass and leaves caching/re-resolve to the caller — this is that caller.
 *
 *  Source: the LLM Endpoint Manager when it is installed (found FRESH on every resolve — the
 *  plugin can be disabled at any time), otherwise the local list. A local LLM endpoint moves
 *  with the network (localhost at the host, LAN IP on the road), so the local list is resolved
 *  once per session and re-resolved only when a request actually fails; resolving per message
 *  would make every question pay the ping. The manager path is NOT cached here: the manager
 *  caches itself, and a changed choice must take effect on the next question. */
import type { EndpointConfig } from '../vendor/kit/endpoint_config';
import {
  resolveEndpointSource,
  type EndpointChoice,
  type LlmEndpointManagerApi,
} from '../vendor/kit/endpoint-source';

export const ENDPOINT_CALLER = 'neurovim';

export interface EndpointSourceDeps {
  /** The installed manager's API or null. Called on every resolve. */
  manager: () => LlmEndpointManagerApi | null;
  /** The user's endpoint/model choice against the manager. */
  choice: () => EndpointChoice;
}

export class EndpointResolver {
  private cached: EndpointConfig | null = null;
  /** In-flight resolve, shared so concurrent asks don't each ping the list. */
  private pending: Promise<EndpointConfig | null> | null = null;

  constructor(
    private readonly getEndpoints: () => EndpointConfig[],
    private readonly ping: (cfg: EndpointConfig) => Promise<boolean>,
    private readonly source?: EndpointSourceDeps,
  ) {}

  /** First reachable endpoint (with its normalized url + own key), or null if none answers.
   *  The model to ask rides on `config.model`: the manager's choice/default, or the local
   *  row's own model. Local results are cached until invalidate(); a failed resolve is not
   *  cached — the next ask retries (the network may be back). */
  async resolve(): Promise<EndpointConfig | null> {
    const manager = this.source?.manager() ?? null;
    if (manager === null && this.cached !== null) return this.cached;
    if (this.pending) return this.pending;
    this.pending = resolveEndpointSource({
      manager,
      local: this.getEndpoints(),
      capability: 'chat',
      // A model name is bound to its endpoint: a choice made against the manager means
      // nothing for the local list, so it only travels with the manager.
      ...(manager !== null && this.source ? { choice: this.source.choice() } : {}),
      caller: ENDPOINT_CALLER,
    }, this.ping)
      .then((r) => {
        const ep = r.config === null ? null
          : r.model !== '' && r.model !== r.config.model ? { ...r.config, model: r.model } : r.config;
        if (r.kind === 'local') this.cached = ep;
        return ep;
      })
      .finally(() => { this.pending = null; });
    return this.pending;
  }

  /** Drops the cached endpoint so the next resolve() probes the list again. */
  invalidate(): void {
    this.cached = null;
  }
}
