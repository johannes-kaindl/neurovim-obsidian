/**
 * Fulfils the core's LlmPort with the kit's LLM connection (`createLlmConnection`).
 *
 * The connection owns what used to live here: which endpoint answers, the remembered
 * resolution, the request values from the profile table, the client and its time limits.
 * What stays is what only this plugin decides: the uplink is off unless configured, an
 * endpoint without a model is not asked, a network failure is retried once on a fresh
 * resolution, and the kit's result is mapped onto the core's four failure kinds.
 */
import type { LlmPort, LlmMessage, LlmResult } from '../vendor/neurovim/core';
import type { LlmConnection, LlmResult as KitResult } from '../vendor/kit-obsidian/llm-connection';

/** The part of the connection this adapter needs (a fake stands in for it in tests). */
export type CipherConnection = Pick<LlmConnection, 'resolve' | 'invalidate' | 'complete'>;

const UNAVAILABLE = (detail: string): LlmResult =>
  ({ ok: false, kind: 'unavailable', detail, partial: '' });

/** The kit result speaks HTTP; LlmResult must not. The status line survives in `detail`. */
function toResult(r: KitResult): LlmResult {
  if (r.ok) return { ok: true, content: r.content };
  // no-endpoint / network: nothing answered. http / overflow / truncated: something answered,
  // but not with a usable completion.
  const kind = r.kind === 'network' || r.kind === 'no-endpoint' ? 'unavailable'
    : r.kind === 'aborted' || r.kind === 'timeout' ? r.kind : 'failed';
  return { ok: false, kind, detail: r.detail, partial: r.partial };
}

export class CorePortAdapter implements LlmPort {
  constructor(
    private readonly llm: CipherConnection,
    /** Is the uplink usable at all? (manager installed, or every local endpoint has a model) */
    private readonly configured: () => boolean,
  ) {}

  async complete(
    messages: LlmMessage[],
    opts?: { onToken?: (t: string) => void; signal?: AbortSignal },
  ): Promise<LlmResult> {
    if (!this.configured()) return UNAVAILABLE('CIPHER uplink not configured');

    const handlers = {
      ...(opts?.onToken ? { onToken: opts.onToken } : {}),
      ...(opts?.signal ? { signal: opts.signal } : {}),
    };

    const src = await this.llm.resolve();
    if (src.config === null) return UNAVAILABLE('no endpoint reachable');
    // The manager may hand out an endpoint without a default model, and none was chosen — an
    // empty model would be sent as-is and answered with an opaque HTTP error.
    if (src.sentModel.trim() === '') return UNAVAILABLE('no model set for the endpoint');

    let r = await this.llm.complete({ messages }, handlers);

    // A network failure may just mean the remembered endpoint moved (host slept, network
    // changed). Re-resolve once and retry — never twice, or a dead uplink stalls the turn.
    // Retry on any freshly resolved endpoint, including the same one: the fresh ping just
    // proved it answers, so the failure was transient. Guarding on "a different endpoint"
    // would disable the retry entirely for a single-endpoint list — the common case.
    if (!r.ok && r.kind === 'network') {
      this.llm.invalidate();
      const fresh = await this.llm.resolve();
      if (fresh.config !== null) r = await this.llm.complete({ messages }, handlers);
    }

    return toResult(r);
  }
}
