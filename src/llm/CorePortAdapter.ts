/**
 * Fulfils the core's LlmPort with this plugin's transport stack.
 *
 * Everything the core deliberately does not know lives here: which endpoint
 * answers, what to do when it stops answering, which model to ask, and how to
 * suppress reasoning. The core sees four failure kinds and a detail string.
 *
 * Model choice is per-endpoint, not global: each entry in the endpoint list
 * may carry its own model, so it can only be decided once resolve() has picked
 * one. That is why this takes `modelFor(endpoint)` rather than a plain thunk.
 */
import type { LlmPort, LlmMessage, LlmResult } from '../vendor/neurovim/core';
import type { CipherClient, StreamOutcome } from './CipherClient';
import type { EndpointResolver } from './endpointResolver';
import type { EndpointConfig } from '../vendor/kit/endpoint_config';

export interface ModelChoice {
  /** Is the uplink usable at all? (endpoints present, every one has a model) */
  configured(): boolean;
  /** Model + reasoning setting for the endpoint that actually answered. */
  forEndpoint(ep: EndpointConfig): { model: string; suppressThinking: boolean };
}

const UNAVAILABLE = (detail: string): LlmResult =>
  ({ ok: false, kind: 'unavailable', detail, partial: '' });

/** StreamOutcome speaks HTTP; LlmResult must not. The status line survives in `detail`. */
function toResult(o: StreamOutcome): LlmResult {
  if (o.ok) return { ok: true, content: o.content };
  const kind = o.kind === 'http' ? 'failed' : o.kind === 'network' ? 'unavailable' : o.kind;
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

    const run = (endpoint: EndpointConfig): Promise<StreamOutcome> => {
      const { model, suppressThinking } = this.choice.forEndpoint(endpoint);
      return this.client.stream({ endpoint, model, suppressThinking }, messages, onToken, signal);
    };

    const endpoint = await this.resolver.resolve();
    if (endpoint === null) return UNAVAILABLE('no endpoint reachable');

    let outcome = await run(endpoint);

    // A network failure may just mean the cached endpoint moved (host slept,
    // network changed). Re-resolve once and retry — never twice, or a dead
    // uplink stalls the turn. Retry on any freshly resolved endpoint, including
    // the same one: the fresh ping just proved it answers, so the failure was
    // transient. Guarding on `fresh !== endpoint` would disable the retry
    // entirely for a single-endpoint list — the common case.
    if (!outcome.ok && outcome.kind === 'network') {
      this.resolver.invalidate();
      const fresh = await this.resolver.resolve();
      if (fresh !== null) outcome = await run(fresh);
    }

    return toResult(outcome);
  }
}
