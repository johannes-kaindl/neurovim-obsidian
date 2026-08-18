/**
 * LlmPort — one streaming completion against a language model (ADR-001 §P5).
 *
 * - vim-dojo (Obsidian): CipherClient + endpointResolver + XhrSseTransport.
 * - a future web/nvim consumer: fetch + EventSource, or a local process.
 *
 * Deliberately transport-neutral: endpoint resolution, retry, model choice,
 * auth and reasoning suppression all live *behind* `complete()`. The core
 * never learns that HTTP was involved — a consumer over a Unix socket is
 * just as valid, which is why `LlmFailure` has no `http` member. The
 * consumer puts the status line into `detail`.
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Why a completion did not produce content. */
export type LlmFailure =
  /** The caller's AbortSignal fired. */
  | 'aborted'
  /** The consumer's own deadline elapsed. */
  | 'timeout'
  /** Nothing answered — unreachable, unconfigured, no endpoint. */
  | 'unavailable'
  /** Something answered, but not with a usable completion. */
  | 'failed';

export type LlmResult =
  | { ok: true; content: string }
  /** `partial` carries whatever streamed before the failure — never dropped;
   *  the chat renders it as a cut-off answer rather than losing it. */
  | { ok: false; kind: LlmFailure; detail: string; partial: string };

export interface LlmPort {
  complete(
    messages: LlmMessage[],
    opts?: { onToken?: (t: string) => void; signal?: AbortSignal },
  ): Promise<LlmResult>;
}
