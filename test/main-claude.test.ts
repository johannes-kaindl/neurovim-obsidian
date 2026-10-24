import { describe, expect, it } from 'vitest';
import NeuroVimPlugin from '../src/main';

/** A manager that records which transports the connection asks for. Without the opt-in
 *  `transports: { anthropic: true }` the plugin would never see a manager endpoint with
 *  `provider: "anthropic"` (the connection then asks for `http` only). */
function managerApp() {
  const asked: Array<{ via: string; transports: unknown }> = [];
  const api = {
    version: 1,
    list: (filter?: { transports?: unknown }) => { asked.push({ via: 'list', transports: filter?.transports }); return []; },
    get: () => null,
    resolve: (_capability: string, opts?: { transports?: unknown }) => { asked.push({ via: 'resolve', transports: opts?.transports }); return Promise.resolve({ error: 'no-endpoint' }); },
    materialize: () => Promise.resolve({ error: 'no-endpoint' }),
    models: () => Promise.resolve([]),
    importEndpoints: () => Promise.resolve({ error: 'no-endpoint' }),
    on: () => () => {},
  };
  const app = { plugins: { plugins: { 'llm-endpoint-manager': { api } } } };
  return { app, asked };
}

describe('Claude as an endpoint of the endpoint manager', () => {
  it('the connection asks the manager for endpoints with transport "anthropic" too', async () => {
    const { app, asked } = managerApp();
    const p = new NeuroVimPlugin(app as never, { id: 'neurovim' } as never);
    await p.llm.resolve();
    const resolved = asked.filter((a) => a.via === 'resolve');
    // Probe: the fake was asked at all (otherwise "never anthropic" would prove nothing).
    expect(resolved.length).toBeGreaterThan(0);
    for (const a of resolved) expect(a.transports).toEqual(['http', 'anthropic']);
  });
});
