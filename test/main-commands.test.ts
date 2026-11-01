import { afterEach, describe, expect, it, vi } from 'vitest';
import NeuroVimPlugin from '../src/main';

/** Ein Stellvertreter, der jeden Aufruf und jeden Zugriff schluckt: dieser Test misst nur, welche
 *  Befehle `onload` registriert, nicht den Rest der Verdrahtung (die deckt der GUI-Smoke). */
function schlucker(): unknown {
  const fn = (): unknown => schlucker();
  return new Proxy(fn, {
    get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : schlucker()),
    apply: () => schlucker(),
  });
}

/** UI-STANDARD §11: Verb plus Gegenstand, Sentence case, kein Plugin-Name; die Ids bleiben,
 *  weil gebundene Hotkeys an ihnen hängen. Die Oberfläche des Plugins ist englisch (kein
 *  Deutsch-Bündel), die Namen bleiben Literale. */
describe('command names (UI-STANDARD §11)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('registers three commands with stable ids and verb-plus-object names', async () => {
    const commands: Array<{ id: string; name: string }> = [];
    const echt = new NeuroVimPlugin(schlucker() as never, { id: 'neurovim' } as never);
    const p = new Proxy(echt, {
      get: (t, k) => {
        if (k === 'addCommand') return (c: { id: string; name: string }) => { commands.push(c); };
        return k in t ? (t as never)[k] : schlucker();
      },
    });
    vi.stubGlobal('window', { setInterval: () => 0, clearInterval: () => {} });
    await p.onload();
    expect(commands.map((c) => [c.id, c.name])).toEqual([
      ['open', 'Open hub'],
      ['submit', 'Submit mission'],
      ['reset', 'Reset mission'],
    ]);
  });
});
