/**
 * Failover orchestration around the kit's resolveActiveEndpoint. The kit deliberately does
 * one resolver pass and leaves caching/re-resolve to the caller — this is that caller.
 *
 * A local LLM endpoint moves with the network (localhost at the host, LAN IP on the road),
 * so the list is resolved once per session and re-resolved only when a request actually
 * fails. Resolving per message would make every question pay the ping.
 */
import { resolveActiveEndpoint } from '../vendor/kit/endpoint';

export class EndpointResolver {
  private cached: string | null = null;
  /** In-flight resolve, shared so concurrent asks don't each ping the list. */
  private pending: Promise<string | null> | null = null;

  constructor(
    private readonly getEndpoints: () => string[],
    private readonly ping: (endpoint: string) => Promise<boolean>,
  ) {}

  /** First reachable endpoint, or null if none answers. Cached until invalidate().
   *  A failed resolve is not cached — the next ask retries (the network may be back). */
  async resolve(): Promise<string | null> {
    if (this.cached !== null) return this.cached;
    if (this.pending) return this.pending;
    this.pending = resolveActiveEndpoint(this.getEndpoints(), this.ping)
      .then((ep) => { this.cached = ep; return ep; })
      .finally(() => { this.pending = null; });
    return this.pending;
  }

  /** Drops the cached endpoint so the next resolve() probes the list again. */
  invalidate(): void {
    this.cached = null;
  }
}
