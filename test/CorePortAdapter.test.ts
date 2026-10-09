import { describe, it, expect } from 'vitest';
import { CorePortAdapter, type CipherConnection } from '../src/llm/CorePortAdapter';
import type { LlmResult } from '../src/vendor/kit-obsidian/llm-connection';
import type { EndpointConfig } from '../src/vendor/kit/endpoint_config';
import type { EndpointSourceResult } from '../src/vendor/kit/endpoint-source';

const ENDPOINT = { url: 'http://localhost:1234', apiKey: '' } as EndpointConfig;
const OTHER = { url: 'http://192.168.1.5:1234', apiKey: '' } as EndpointConfig;

const timing = { startedAt: 0, endedAt: 0 };

/** What the connection would hand over for one endpoint. The model differs per endpoint, so the
 *  retry test can prove the adapter asks again after a fresh resolution. */
const sourceOf = (ep: EndpointConfig | null, sentModel = ep?.url.includes('192.168') ? 'lan-model' : 'local-model'): EndpointSourceResult => ({
  kind: 'local', config: ep, model: sentModel, family: null, familySource: 'none',
  backend: 'unknown', backendSource: 'none', sentModel,
});

const ok = (content: string): LlmResult => ({
  ok: true, content, reasoning: '', toolCalls: [], truncated: false, streamed: true, timing,
  facts: null, deviations: [], source: sourceOf(ENDPOINT),
});
const fail = (kind: 'http' | 'overflow' | 'truncated' | 'timeout' | 'aborted' | 'network' | 'no-endpoint', detail: string, partial = ''): LlmResult => ({
  ok: false, kind, detail, partial, reasoning: '', timing, facts: null, deviations: [], source: sourceOf(ENDPOINT),
});

/** Stands in for the kit connection: replays scripted results (one per `complete`) and
 *  scripted resolutions (one per `resolve`), and counts what the adapter does. */
class FakeConnection implements CipherConnection {
  completeCalls: { messages: unknown; onToken: ((t: string) => void) | undefined; signal: AbortSignal | undefined }[] = [];
  resolveCalls = 0;
  invalidated = 0;
  constructor(private results: LlmResult[], private endpoints: (EndpointConfig | null)[] = [ENDPOINT], private noModel = false) {}
  async resolve(): Promise<EndpointSourceResult> {
    const e = this.endpoints[Math.min(this.resolveCalls, this.endpoints.length - 1)] ?? null;
    this.resolveCalls += 1;
    return this.noModel ? sourceOf(e, '') : sourceOf(e);
  }
  invalidate(): void { this.invalidated += 1; }
  async complete(req: { messages?: unknown }, h?: { onToken?: (t: string) => void; signal?: AbortSignal }): Promise<LlmResult> {
    const r = this.results[Math.min(this.completeCalls.length, this.results.length - 1)] as LlmResult;
    this.completeCalls.push({ messages: req.messages, onToken: h?.onToken, signal: h?.signal });
    return r;
  }
}

const make = (conn: FakeConnection, configured = true): CorePortAdapter =>
  new CorePortAdapter(conn as unknown as CipherConnection, () => configured);

describe('CorePortAdapter', () => {
  it('ohne Modell am aufgeloesten Endpunkt: unavailable, kein Aufruf (Manager ohne Default-Modell)', async () => {
    const conn = new FakeConnection([ok('hi')], [ENDPOINT], true);
    const r = await make(conn).complete([]);
    expect(r).toEqual({ ok: false, kind: 'unavailable', detail: 'no model set for the endpoint', partial: '' });
    expect(conn.completeCalls).toHaveLength(0);
  });

  it('maps a successful completion to ok', async () => {
    expect(await make(new FakeConnection([ok('hi')])).complete([])).toEqual({ ok: true, content: 'hi' });
  });

  it.each([
    ['http' as const, 'failed'],
    ['overflow' as const, 'failed'],
    ['truncated' as const, 'failed'],
    ['timeout' as const, 'timeout'],
    ['aborted' as const, 'aborted'],
    ['no-endpoint' as const, 'unavailable'],
  ])('translates %s to %s and keeps detail and partial', async (from, to) => {
    expect(await make(new FakeConnection([fail(from, 'boom', 'par')])).complete([])).toEqual({
      ok: false, kind: to, detail: 'boom', partial: 'par',
    });
  });

  it('translates a network failure to unavailable once the retry is spent', async () => {
    // Nothing fresh resolves, so the original failure stands.
    const conn = new FakeConnection([fail('network', 'boom', 'par')], [ENDPOINT, null]);
    expect(await make(conn).complete([])).toEqual({ ok: false, kind: 'unavailable', detail: 'boom', partial: 'par' });
  });

  it('reports unavailable when no endpoint resolves at all', async () => {
    const conn = new FakeConnection([ok('unreachable')], [null]);
    expect(await make(conn).complete([])).toMatchObject({ ok: false, kind: 'unavailable' });
    expect(conn.completeCalls).toHaveLength(0);
  });

  it('reports unavailable when the uplink is not configured', async () => {
    const conn = new FakeConnection([ok('x')]);
    expect(await make(conn, false).complete([])).toMatchObject({ ok: false, kind: 'unavailable' });
    expect(conn.completeCalls).toHaveLength(0);
    expect(conn.resolveCalls).toBe(0);
  });

  it('retries a network failure exactly once after dropping the remembered resolution', async () => {
    const conn = new FakeConnection([fail('network', 'moved'), ok('second try')], [ENDPOINT, OTHER]);
    expect(await make(conn).complete([])).toEqual({ ok: true, content: 'second try' });
    expect(conn.completeCalls).toHaveLength(2);
    expect(conn.invalidated).toBe(1);
  });

  it('does not retry a second network failure', async () => {
    const conn = new FakeConnection([fail('network', 'down')], [ENDPOINT, ENDPOINT]);
    expect(await make(conn).complete([])).toMatchObject({ ok: false, kind: 'unavailable' });
    expect(conn.completeCalls).toHaveLength(2);
  });

  it('does not retry a non-network failure', async () => {
    const conn = new FakeConnection([fail('http', 'HTTP 500')]);
    await make(conn).complete([]);
    expect(conn.completeCalls).toHaveLength(1);
    expect(conn.invalidated).toBe(0);
  });

  it('passes messages, the token callback and the signal through to the connection', async () => {
    const conn = new FakeConnection([ok('tok')]);
    const messages = [{ role: 'user' as const, content: 'q' }];
    const signal = new AbortController().signal;
    const onToken = (): void => {};
    expect(await make(conn).complete(messages, { onToken, signal })).toEqual({ ok: true, content: 'tok' });
    expect(conn.completeCalls[0]).toEqual({ messages, onToken, signal });
  });
});
