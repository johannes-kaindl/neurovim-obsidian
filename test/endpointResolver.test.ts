import { describe, it, expect, vi } from 'vitest';
import { EndpointResolver } from '../src/llm/endpointResolver';
import type { LlmEndpointManagerApi } from '../src/vendor/kit/endpoint-source';

const cfg = (url: string) => ({ url });

describe('EndpointResolver — source result (family/backend/wire model for the request profile)', () => {
  it('resolveSource carries the local row\'s model as sentModel and probes the backend once per resolve', async () => {
    const backendOf = vi.fn(async () => 'lmstudio' as const);
    const r = new EndpointResolver(
      () => [{ url: 'http://a:1', model: 'qwen/qwen3.8-27b' }],
      async () => true,
      { manager: () => null, choice: () => ({}), backendOf },
    );
    const src = await r.resolveSource();
    expect(src).toMatchObject({ kind: 'local', sentModel: 'qwen/qwen3.8-27b', family: 'qwen3.8', backend: 'lmstudio', backendSource: 'probe' });
    await r.resolveSource();
    expect(backendOf).toHaveBeenCalledTimes(1); // the local result is cached like resolve() always was
  });

  it('lastSource() is null before the first resolve and holds the latest result afterwards', async () => {
    const r = new EndpointResolver(() => [{ url: 'http://a:1', model: 'm' }], async () => true);
    expect(r.lastSource()).toBeNull();
    await r.resolve();
    expect(r.lastSource()).toMatchObject({ kind: 'local', sentModel: 'm', backend: 'unknown' });
  });

  it('a failed backend probe leaves the backend unknown instead of failing the resolve', async () => {
    const r = new EndpointResolver(
      () => [{ url: 'http://a:1', model: 'm' }],
      async () => true,
      { manager: () => null, choice: () => ({}), backendOf: async () => { throw new Error('probe down'); } },
    );
    expect(await r.resolveSource()).toMatchObject({ backend: 'unknown', backendSource: 'none' });
  });
});

describe('EndpointResolver', () => {
  it('resolves to the first reachable endpoint', async () => {
    const ping = vi.fn(async (c: { url: string }) => c.url === 'http://b:2');
    const r = new EndpointResolver(() => [cfg('http://a:1'), cfg('http://b:2')], ping);
    expect(await r.resolve()).toEqual(cfg('http://b:2'));
  });

  it('caches the result — a second resolve does not ping again', async () => {
    const ping = vi.fn(async () => true);
    const r = new EndpointResolver(() => [cfg('http://a:1')], ping);
    await r.resolve();
    await r.resolve();
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('pings again after invalidate (endpoint moved to another network)', async () => {
    const ping = vi.fn(async (c: { url: string }) => c.url === 'http://b:2');
    const r = new EndpointResolver(() => [cfg('http://a:1'), cfg('http://b:2')], ping);
    expect(await r.resolve()).toEqual(cfg('http://b:2'));
    r.invalidate();
    expect(await r.resolve()).toEqual(cfg('http://b:2'));
    expect(ping).toHaveBeenCalledTimes(4);
  });

  it('returns null when nothing is reachable and does not cache the failure', async () => {
    const ping = vi.fn(async () => false);
    const r = new EndpointResolver(() => [cfg('http://a:1')], ping);
    expect(await r.resolve()).toBeNull();
    await r.resolve();
    expect(ping).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight resolve between concurrent callers', async () => {
    const ping = vi.fn(async () => true);
    const r = new EndpointResolver(() => [cfg('http://a:1')], ping);
    await Promise.all([r.resolve(), r.resolve()]);
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('carries a per-endpoint apiKey/model override through to the ping and the result', async () => {
    const full = { url: 'http://a:1', apiKey: 'sk-a', model: 'llama' };
    const ping = vi.fn(async (c: { apiKey?: string }) => c.apiKey === 'sk-a');
    const r = new EndpointResolver(() => [full], ping);
    expect(await r.resolve()).toEqual(full);
  });
});

/** Manager mit nur den Methoden, die resolveEndpointSource ruft. */
function fakeManager(over: Partial<LlmEndpointManagerApi> = {}): LlmEndpointManagerApi {
  return {
    version: 1,
    list: () => [],
    get: () => null,
    resolve: vi.fn(async () => ({ id: 'm1', label: 'M', config: { url: 'http://manager:1234' }, defaultModel: 'qwen3' })),
    materialize: vi.fn(async (id: string) => ({ id, label: id, config: { url: `http://${id}:1234` }, defaultModel: 'gemma' })),
    models: vi.fn(async () => []),
    importEndpoints: vi.fn(async () => ({ added: [], merged: [], skipped: [] })),
    on: () => () => {},
    ...over,
  } as unknown as LlmEndpointManagerApi;
}

describe('EndpointResolver — LLM Endpoint Manager', () => {
  it('Manager da: er gewinnt, das Modell (Default des Endpunkts) steht auf der Config', async () => {
    const ping = vi.fn(async () => true);
    const m = fakeManager();
    const r = new EndpointResolver(() => [cfg('http://a:1')], ping, { manager: () => m, choice: () => ({}) });
    expect(await r.resolve()).toEqual({ url: 'http://manager:1234', model: 'qwen3' });
    expect(m.resolve).toHaveBeenCalledWith('chat', { caller: 'neurovim' });
    expect(ping).not.toHaveBeenCalled();
  });

  it('Manager da: choice haelt Endpunkt und Modell', async () => {
    const m = fakeManager();
    const r = new EndpointResolver(() => [], async () => true, { manager: () => m, choice: () => ({ endpointId: 'ep7', model: 'mein-modell' }) });
    expect(await r.resolve()).toEqual({ url: 'http://ep7:1234', model: 'mein-modell' });
  });

  it('Manager da: nicht gecacht — der Manager cached selbst, und eine Wahl darf sofort greifen', async () => {
    const m = fakeManager();
    const r = new EndpointResolver(() => [], async () => true, { manager: () => m, choice: () => ({}) });
    await r.resolve();
    await r.resolve();
    expect(m.resolve).toHaveBeenCalledTimes(2);
  });

  it('Manager ohne Endpunkt: null, kein lokaler Rueckfall', async () => {
    const ping = vi.fn(async () => true);
    const m = fakeManager({ resolve: vi.fn(async () => ({ error: 'no-endpoint' as const })) });
    const r = new EndpointResolver(() => [cfg('http://a:1')], ping, { manager: () => m, choice: () => ({}) });
    expect(await r.resolve()).toBeNull();
    expect(ping).not.toHaveBeenCalled();
  });

  it('Manager verschwindet: die lokale Liste greift wieder (Manager wird bei JEDEM Aufruf frisch gelesen)', async () => {
    let m: LlmEndpointManagerApi | null = fakeManager();
    const r = new EndpointResolver(() => [cfg('http://a:1')], async () => true, { manager: () => m, choice: () => ({}) });
    expect((await r.resolve())?.url).toBe('http://manager:1234');
    m = null;
    expect(await r.resolve()).toEqual(cfg('http://a:1'));
  });

  it('ohne Manager wird eine gespeicherte Wahl ignoriert — Modellnamen gelten je Endpunkt', async () => {
    const r = new EndpointResolver(() => [{ url: 'http://a:1', model: 'zeile' }], async () => true,
      { manager: () => null, choice: () => ({ endpointId: 'x', model: 'fremd' }) });
    expect(await r.resolve()).toEqual({ url: 'http://a:1', model: 'zeile' });
  });
});
