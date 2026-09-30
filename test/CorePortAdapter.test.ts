import { describe, it, expect } from 'vitest';
import { CorePortAdapter, type ModelChoice } from '../src/llm/CorePortAdapter';
import type { CipherClient, StreamOutcome } from '../src/llm/CipherClient';
import type { EndpointResolver } from '../src/llm/endpointResolver';
import type { EndpointConfig } from '../src/vendor/kit/endpoint_config';
import type { EndpointSourceResult } from '../src/vendor/kit/endpoint-source';
import type { ResponseFacts } from '../src/vendor/kit/sampling-profiles';

const ENDPOINT = { url: 'http://localhost:1234', apiKey: '' } as EndpointConfig;
const OTHER = { url: 'http://192.168.1.5:1234', apiKey: '' } as EndpointConfig;

const FACTS: ResponseFacts = { status: 200, content: 'hi', reasoning: '' };
const ok = (content: string): StreamOutcome => ({ ok: true, content, facts: { ...FACTS, content } });
const fail = (kind: 'http' | 'overflow' | 'truncated' | 'timeout' | 'aborted' | 'network', detail: string, partial: string): StreamOutcome =>
  ({ ok: false, kind, detail, partial, facts: null });

/** Stands in for CipherClient: replays scripted outcomes, one per call. */
class FakeClient {
  calls: { endpoint: EndpointConfig; model: string; params: Record<string, number | string> }[] = [];
  constructor(private outcomes: StreamOutcome[]) {}
  async stream(cfg: { endpoint: EndpointConfig; sentModel: string; params: Record<string, number | string> }): Promise<StreamOutcome> {
    const o = this.outcomes[Math.min(this.calls.length, this.outcomes.length - 1)];
    this.calls.push({ endpoint: cfg.endpoint, model: cfg.sentModel, params: cfg.params });
    return o;
  }
}

/** What the real resolver would hand over for one endpoint. The model differs per endpoint,
 *  so the retry test can prove the adapter re-reads it from the FRESH source. */
const sourceOf = (ep: EndpointConfig | null, sentModel = ep?.url.includes('192.168') ? 'lan-model' : 'local-model'): EndpointSourceResult => ({
  kind: 'local', config: ep, model: sentModel, family: null, familySource: 'none',
  backend: 'unknown', backendSource: 'none', sentModel,
});

/** Stands in for EndpointResolver. */
class FakeResolver {
  invalidated = 0;
  resolveCalls = 0;
  /** The manager case: an endpoint came back, but no model was chosen and none is its default. */
  noModel = false;
  constructor(private endpoints: (EndpointConfig | null)[]) {}
  async resolveSource(): Promise<EndpointSourceResult> {
    const e = this.endpoints[Math.min(this.resolveCalls, this.endpoints.length - 1)];
    this.resolveCalls += 1;
    return this.noModel ? sourceOf(e, '') : sourceOf(e);
  }
  invalidate(): void { this.invalidated += 1; }
}

const choiceOf = (configured: boolean, reported: ResponseFacts[] = []): ModelChoice => ({
  configured: () => configured,
  // Model per endpoint, so the tests can prove the retry re-reads it.
  forSource: (src) => ({
    sentModel: src.sentModel,
    params: { temperature: 0.7 },
    report: (facts) => { reported.push(facts); },
  }),
});

const make = (client: FakeClient, resolver: FakeResolver, configured = true): CorePortAdapter =>
  new CorePortAdapter(
    client as unknown as CipherClient,
    resolver as unknown as EndpointResolver,
    choiceOf(configured),
  );

describe('CorePortAdapter', () => {
  it('ohne Modell am aufgeloesten Endpunkt: unavailable, kein Aufruf (Manager ohne Default-Modell)', async () => {
    const client = new FakeClient([ok('hi')]);
    const resolver = new FakeResolver([ENDPOINT]);
    resolver.noModel = true;
    const adapter = new CorePortAdapter(client as unknown as CipherClient, resolver as unknown as EndpointResolver, choiceOf(true));
    const r = await adapter.complete([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('unavailable');
    expect(client.calls).toHaveLength(0);
  });

  it('maps a successful stream to ok', async () => {
    const adapter = make(new FakeClient([ok('hi')]), new FakeResolver([ENDPOINT]));
    expect(await adapter.complete([])).toEqual({ ok: true, content: 'hi' });
  });

  it.each([
    ['http' as const, 'failed'],
    ['overflow' as const, 'failed'],
    ['truncated' as const, 'failed'],
    ['timeout' as const, 'timeout'],
    ['aborted' as const, 'aborted'],
  ])('translates %s to %s and keeps detail and partial', async (from, to) => {
    const client = new FakeClient([fail(from, 'boom', 'par')]);
    const adapter = make(client, new FakeResolver([ENDPOINT]));
    expect(await adapter.complete([])).toEqual({
      ok: false, kind: to, detail: 'boom', partial: 'par',
    });
  });

  it('translates a network failure to unavailable once the retry is spent', async () => {
    const client = new FakeClient([fail('network', 'boom', 'par')]);
    // Nothing fresh resolves, so the original failure stands.
    const adapter = make(client, new FakeResolver([ENDPOINT, null]));
    expect(await adapter.complete([])).toEqual({
      ok: false, kind: 'unavailable', detail: 'boom', partial: 'par',
    });
  });

  it('reports unavailable when no endpoint resolves at all', async () => {
    const client = new FakeClient([ok('unreachable')]);
    const adapter = make(client, new FakeResolver([null]));
    const result = await adapter.complete([]);
    expect(result).toMatchObject({ ok: false, kind: 'unavailable' });
    expect(client.calls).toHaveLength(0);
  });

  it('reports unavailable when the uplink is not configured', async () => {
    const client = new FakeClient([ok('x')]);
    const adapter = make(client, new FakeResolver([ENDPOINT]), false);
    expect(await adapter.complete([])).toMatchObject({ ok: false, kind: 'unavailable' });
    expect(client.calls).toHaveLength(0);
  });

  it('retries a network failure exactly once against a freshly resolved endpoint', async () => {
    const client = new FakeClient([
      fail('network', 'moved', ''),
      ok('second try'),
    ]);
    const resolver = new FakeResolver([ENDPOINT, OTHER]);
    const adapter = make(client, resolver);

    expect(await adapter.complete([])).toEqual({ ok: true, content: 'second try' });
    expect(client.calls).toHaveLength(2);
    expect(resolver.invalidated).toBe(1);
    // The retry re-reads the model for the endpoint that actually answered.
    expect(client.calls.map((c) => c.model)).toEqual(['local-model', 'lan-model']);
  });

  it('does not retry a non-network failure', async () => {
    const client = new FakeClient([fail('http', 'HTTP 500', '')]);
    const resolver = new FakeResolver([ENDPOINT, ENDPOINT]);
    const adapter = make(client, resolver);

    await adapter.complete([]);
    expect(client.calls).toHaveLength(1);
    expect(resolver.invalidated).toBe(0);
  });

  it('passes the token callback and signal through to the client', async () => {
    let sawToken = '';
    const client = {
      async stream(
        _cfg: unknown, _msgs: unknown, onToken: (t: string) => void, signal: AbortSignal,
      ): Promise<StreamOutcome> {
        onToken('tok');
        return ok(signal.aborted ? 'aborted' : 'tok');
      },
    };
    const adapter = new CorePortAdapter(
      client as unknown as CipherClient,
      new FakeResolver([ENDPOINT]) as unknown as EndpointResolver,
      choiceOf(true),
    );

    const result = await adapter.complete([], { onToken: (t) => { sawToken = t; } });
    expect(sawToken).toBe('tok');
    expect(result).toEqual({ ok: true, content: 'tok' });
  });

  it('hands the params of forSource to the client and the answer\'s facts to the plan\'s report', async () => {
    const reported: ResponseFacts[] = [];
    const client = new FakeClient([ok('hi')]);
    const adapter = new CorePortAdapter(
      client as unknown as CipherClient,
      new FakeResolver([ENDPOINT]) as unknown as EndpointResolver,
      choiceOf(true, reported),
    );
    await adapter.complete([]);
    expect(client.calls[0]?.params).toEqual({ temperature: 0.7 });
    expect(reported).toEqual([{ status: 200, content: 'hi', reasoning: '' }]);
  });

  it('reports nothing when the failure carries no server answer (network, abort)', async () => {
    const reported: ResponseFacts[] = [];
    const adapter = new CorePortAdapter(
      new FakeClient([fail('aborted', 'x', '')]) as unknown as CipherClient,
      new FakeResolver([ENDPOINT]) as unknown as EndpointResolver,
      choiceOf(true, reported),
    );
    await adapter.complete([]);
    expect(reported).toEqual([]);
  });
});
