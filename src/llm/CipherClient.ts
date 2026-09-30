/**
 * CIPHER's chat call over the kit client (`createChatClient`). The client and its transports
 * come from `vendor/kit-obsidian`; what stays here is what only this plugin knows: the request
 * mode (`companion`) and token budget, and the one-client-per-endpoint rule (the kit client
 * remembers that an endpoint refused the stream — MIGRATION 0.42.0, point 2).
 *
 * Sampling values are no longer fixed here: `buildCipherParams` resolves them from the kit's
 * profile table (model family × backend × mode) plus the user's overrides.
 *
 * Reasoning is never shown (`onReasoning` is left out), but it is collected so
 * `checkResponse` can tell whether the model thought although thinking is off.
 */
import type { LlmMessage } from '@neurovim/core';
import type { EndpointConfig } from '../vendor/kit/endpoint_config';
import type { ChatClient, ChatErrorKind } from '../vendor/kit-obsidian/chat-client';
import {
  resolveRequestParams,
  type BackendId, type FamilyId, type FieldId, type ResolvedRequest, type ResponseFacts, type ThinkingLevel,
} from '../vendor/kit/sampling-profiles';

/** CIPHER answers a player's question next to the game — a conversational partner with some
 *  personality, not a transformer of text (kit profile mode `companion`). */
export const MODE = 'companion';

/** The plugin's own token budget — sent as `max_tokens` (the profile has no budget of its own). */
export const CIPHER_MAX_TOKENS = 1024;

/** The request-building function OF THE PLUGIN: only it knows NeuroVim's fixed mode and budget.
 *  The golden-request tests run against this, not against `resolveRequestParams` directly —
 *  that would test the kit instead of the plugin. */
export function buildCipherParams(input: {
  family: FamilyId | null;
  backend: BackendId;
  thinking: ThinkingLevel;
  overrides?: Partial<Record<FieldId, number | string>>;
}): ResolvedRequest {
  return resolveRequestParams({
    family: input.family,
    mode: MODE,
    backend: input.backend,
    thinking: input.thinking,
    maxTokens: CIPHER_MAX_TOKENS,
    ...(input.overrides !== undefined ? { overrides: input.overrides } : {}),
  });
}

/** `sentModel` is the model as it goes over the wire (after alias resolution); `params` come
 *  from `buildCipherParams`. */
export interface CipherConfig { endpoint: EndpointConfig; sentModel: string; params: Record<string, number | string> }

export type StreamOutcome =
  | { ok: true; content: string; facts: ResponseFacts }
  | { ok: false; kind: ChatErrorKind; detail: string; partial: string; facts: ResponseFacts | null };

export class CipherClient {
  private client: ChatClient | null = null;
  private clientKey = '';

  /** `makeClient` builds a kit client (transport + fallback are the caller's wiring). */
  constructor(private readonly makeClient: () => ChatClient) {}

  private clientFor(ep: EndpointConfig): ChatClient {
    const key = `${ep.url}\n${ep.apiKey ?? ''}`;
    if (this.client === null || key !== this.clientKey) {
      this.client = this.makeClient();
      this.clientKey = key;
    }
    return this.client;
  }

  async stream(
    cfg: CipherConfig,
    messages: LlmMessage[],
    onToken: (t: string) => void,
    signal: AbortSignal,
  ): Promise<StreamOutcome> {
    const r = await this.clientFor(cfg.endpoint).complete({
      endpoint: cfg.endpoint,
      model: cfg.sentModel,
      messages,
      params: cfg.params,
      onToken,
      signal,
    });
    if (!r.ok) {
      // Only a server answer says something about the request; aborts, timeouts and network
      // failures have none to check (`checkResponse` has nothing to say there). `truncated` is
      // a 200 that stopped at the token limit without any text — the "thinking ate the
      // budget" case.
      const facts: ResponseFacts | null = r.kind === 'http'
        ? { status: r.status ?? 0, errorText: r.detail, content: '', reasoning: r.reasoning }
        : r.kind === 'truncated'
          ? { status: 200, finishReason: 'length', content: '', reasoning: r.reasoning }
          : null;
      return { ok: false, kind: r.kind, detail: r.detail, partial: r.partial, facts };
    }
    // Cut off at the token limit but with text: valid, shown as-is (the core has no slot for the flag).
    return {
      ok: true,
      content: r.content,
      facts: {
        status: 200,
        finishReason: r.finishReason ?? null,
        content: r.content,
        reasoning: r.reasoning,
        ...(r.model !== undefined ? { responseModel: r.model } : {}),
      },
    };
  }
}
