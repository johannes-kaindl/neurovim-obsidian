/**
 * Fulfils the core's LlmPort with this plugin's transport stack.
 *
 * Everything the core deliberately does not know lives here: which endpoint
 * answers, what to do when it stops answering, which model to ask, and which
 * sampling/thinking values that model gets. The core sees four failure kinds and a detail string.
 *
 * Model choice is per-endpoint, not global: each entry in the endpoint list
 * may carry its own model, so it can only be decided once the resolver has picked
 * one. That is why this takes `forSource(result)` rather than a plain thunk.
 */
import type { LlmPort, LlmMessage, LlmResult } from '../vendor/neurovim/core';
import type { CipherClient, StreamOutcome } from './CipherClient';
import type { EndpointResolver } from './endpointResolver';
import type { EndpointSourceResult } from '../vendor/kit/endpoint-source';
import type { ResponseFacts } from '../vendor/kit/sampling-profiles';

/** What one request needs, derived from the source that answered. */
export interface RequestPlan {
  /** Model as it goes over the wire (after alias resolution). */
  sentModel: string;
  /** Sampling/thinking fields, flat — from the kit's profile table plus the user's overrides. */
  params: Record<string, number | string>;
  /** Hands the server's answer to the request session (deviation check). */
  report(facts: ResponseFacts): void;
}

export interface ModelChoice {
  /** Is the uplink usable at all? (manager installed, or every local endpoint has a model) */
  configured(): boolean;
  /** Request for the endpoint that actually answered. */
  forSource(src: EndpointSourceResult): RequestPlan;
}

const UNAVAILABLE = (detail: string): LlmResult =>
  ({ ok: false, kind: 'unavailable', detail, partial: '' });

/** StreamOutcome speaks HTTP; LlmResult must not. The status line survives in `detail`. */
function toResult(o: StreamOutcome): LlmResult {
  if (o.ok) return { ok: true, content: o.content };
  // http / overflow / truncated: something answered, but not with a usable completion.
  const kind = o.kind === 'network' ? 'unavailable' : o.kind === 'aborted' || o.kind === 'timeout' ? o.kind : 'failed';
  return { ok: false, kind, detail: o.detail, partial: o.partial };
}

export class CorePortAdapter implements LlmPort {
  constructor(
    private readonly client: CipherClient,
    private readonly resolver: EndpointResolver,
    private readonly choice: ModelChoice,
  ) {}

  async complete(
    messages: LlmMessage[],
    opts?: { onToken?: (t: string) => void; signal?: AbortSignal },
  ): Promise<LlmResult> {
    if (!this.choice.configured()) return UNAVAILABLE('CIPHER uplink not configured');

    const onToken = opts?.onToken ?? ((): void => {});
    const signal = opts?.signal ?? new AbortController().signal;

    const run = async (src: EndpointSourceResult, endpoint: NonNullable<EndpointSourceResult['config']>): Promise<StreamOutcome> => {
      const plan = this.choice.forSource(src);
      const outcome = await this.client.stream({ endpoint, sentModel: plan.sentModel, params: plan.params }, messages, onToken, signal);
      if (outcome.facts !== null) plan.report(outcome.facts);
      return outcome;
    };

    const src = await this.resolver.resolveSource();
    if (src.config === null) return UNAVAILABLE('no endpoint reachable');
    // The manager may hand out an endpoint without a default model, and none was chosen — an
    // empty model would be sent as-is and answered with an opaque HTTP error.
    if (src.sentModel.trim() === '') return UNAVAILABLE('no model set for the endpoint');

    let outcome = await run(src, src.config);

    // A network failure may just mean the cached endpoint moved (host slept,
    // network changed). Re-resolve once and retry — never twice, or a dead
    // uplink stalls the turn. Retry on any freshly resolved endpoint, including
    // the same one: the fresh ping just proved it answers, so the failure was
    // transient. Guarding on `fresh !== endpoint` would disable the retry
    // entirely for a single-endpoint list — the common case.
    if (!outcome.ok && outcome.kind === 'network') {
      this.resolver.invalidate();
      const fresh = await this.resolver.resolveSource();
      if (fresh.config !== null) outcome = await run(fresh, fresh.config);
    }

    return toResult(outcome);
  }
}
