import { describe, it, expect } from 'vitest';
import { CorePortAdapter, type ModelChoice } from '../src/llm/CorePortAdapter';
import type { CipherClient, StreamOutcome } from '../src/llm/CipherClient';
import type { EndpointResolver } from '../src/llm/endpointResolver';
import type { EndpointConfig } from '../src/vendor/kit/endpoint_config';

const ENDPOINT = { url: 'http://localhost:1234', apiKey: '' } as EndpointConfig;
const OTHER = { url: 'http://192.168.1.5:1234', apiKey: '' } as EndpointConfig;

/** Stands in for CipherClient: replays scripted outcomes, one per call. */
class FakeClient {
  calls: { endpoint: EndpointConfig; model: string }[] = [];
  constructor(private outcomes: StreamOutcome[]) {}
  async stream(cfg: { endpoint: EndpointConfig; model: string }): Promise<StreamOutcome> {
    const o = this.outcomes[Math.min(this.calls.length, this.outcomes.length - 1)];
    this.calls.push({ endpoint: cfg.endpoint, model: cfg.model });
    return o;
  }
}

/** Stands in for EndpointResolver. */
class FakeResolver {
  invalidated = 0;
  resolveCalls = 0;
  constructor(private endpoints: (EndpointConfig | null)[]) {}
  async resolve(): Promise<EndpointConfig | null> {
    const e = this.endpoints[Math.min(this.resolveCalls, this.endpoints.length - 1)];
    this.resolveCalls += 1;
    return e;
  }
  invalidate(): void { this.invalidated += 1; }
}

const choiceOf = (configured: boolean): ModelChoice => ({
  configured: () => configured,
  // Model per endpoint, so the tests can prove the retry re-reads it.
  forEndpoint: (ep) => ({
    model: ep.url.includes('192.168') ? 'lan-model' : 'local-model',
    suppressThinking: false,
  }),
});

const make = (client: FakeClient, resolver: FakeResolver, configured = true): CorePortAdapter =>
  new CorePortAdapter(
    client as unknown as CipherClient,
    resolver as unknown as EndpointResolver,
    choiceOf(configured),
  );

describe('CorePortAdapter', () => {
  it('maps a successful stream to ok', async () => {
    const adapter = make(new FakeClient([{ ok: true, content: 'hi' }]), new FakeResolver([ENDPOINT]));
    expect(await adapter.complete([])).toEqual({ ok: true, content: 'hi' });
  });

  it.each([
    ['http' as const, 'failed'],
    ['timeout' as const, 'timeout'],
    ['aborted' as const, 'aborted'],
  ])('translates %s to %s and keeps detail and partial', async (from, to) => {
    const client = new FakeClient([{ ok: false, kind: from, detail: 'boom', partial: 'par' }]);
    const adapter = make(client, new FakeResolver([ENDPOINT]));
    expect(await adapter.complete([])).toEqual({
      ok: false, kind: to, detail: 'boom', partial: 'par',
    });
  });

  it('translates a network failure to unavailable once the retry is spent', async () => {
    const client = new FakeClient([{ ok: false, kind: 'network', detail: 'boom', partial: 'par' }]);
    // Nothing fresh resolves, so the original failure stands.
    const adapter = make(client, new FakeResolver([ENDPOINT, null]));
    expect(await adapter.complete([])).toEqual({
      ok: false, kind: 'unavailable', detail: 'boom', partial: 'par',
    });
  });

  it('reports unavailable when no endpoint resolves at all', async () => {
    const client = new FakeClient([{ ok: true, content: 'unreachable' }]);
    const adapter = make(client, new FakeResolver([null]));
    const result = await adapter.complete([]);
    expect(result).toMatchObject({ ok: false, kind: 'unavailable' });
    expect(client.calls).toHaveLength(0);
  });

  it('reports unavailable when the uplink is not configured', async () => {
    const client = new FakeClient([{ ok: true, content: 'x' }]);
    const adapter = make(client, new FakeResolver([ENDPOINT]), false);
    expect(await adapter.complete([])).toMatchObject({ ok: false, kind: 'unavailable' });
    expect(client.calls).toHaveLength(0);
  });

  it('retries a network failure exactly once against a freshly resolved endpoint', async () => {
    const client = new FakeClient([
      { ok: false, kind: 'network', detail: 'moved', partial: '' },
      { ok: true, content: 'second try' },
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
    const client = new FakeClient([{ ok: false, kind: 'http', detail: 'HTTP 500', partial: '' }]);
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
        return { ok: true, content: signal.aborted ? 'aborted' : 'tok' };
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
});
