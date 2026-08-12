import { describe, it, expect, vi } from 'vitest';
import { EndpointResolver } from '../src/llm/endpointResolver';

const cfg = (url: string) => ({ url });

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
