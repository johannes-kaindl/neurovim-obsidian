/**
 * CIPHER's chat call over the kit client (`createChatClient`, obsidian-kit 0.42.0). The client
 * and its transports come from `vendor/kit-obsidian`; what stays here is what only this plugin
 * knows: the fixed sampling values (the kit client sends none), reasoning suppression, and the
 * one-client-per-endpoint rule (the kit client remembers that an endpoint refused the stream —
 * MIGRATION 0.42.0, point 2).
 *
 * Reasoning is dropped by design: `onReasoning` is left out.
 */
import type { LlmMessage } from '@neurovim/core';
import type { EndpointConfig } from '../vendor/kit/endpoint_config';
import type { ChatClient, ChatErrorKind } from '../vendor/kit-obsidian/chat-client';
import { suppressParams } from '../vendor/kit/reasoning';
import { effectiveSuppress } from './thinkToggle';

export interface CipherConfig { endpoint: EndpointConfig; model: string; suppressThinking: boolean }

export type StreamOutcome =
  | { ok: true; content: string }
  | { ok: false; kind: ChatErrorKind; detail: string; partial: string };

const TEMPERATURE = 0.7;
const MAX_TOKENS = 1024;

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
      model: cfg.model,
      messages,
      params: {
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        ...suppressParams(effectiveSuppress(cfg.model, cfg.suppressThinking)),
      },
      onToken,
      signal,
    });
    if (!r.ok) return { ok: false, kind: r.kind, detail: r.detail, partial: r.partial };
    // Cut off at the token limit but with text: valid, shown as-is (the core has no slot for the flag).
    return { ok: true, content: r.content };
  }
}
