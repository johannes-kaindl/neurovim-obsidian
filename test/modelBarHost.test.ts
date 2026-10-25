import { describe, it, expect, vi } from 'vitest';
import { makeFakeEl } from './vendor/kit/obsidian-mock';
import { mountModelBarHost, THINKING_STRINGS, type ModelBarHostOptions } from '../src/llm/modelBarHost';
import { MODE, setCipherThinking } from '../src/llm/cipherRequest';
import { DEFAULT_REQUEST_SETTINGS, thinkingFor, type RequestSettings, type ThinkingLevel } from '../src/vendor/kit/sampling-profiles';

// `buildModelBar` imports `setIcon` and `DropdownComponent` from "obsidian"; the plugin's own mini mock (vitest alias) has neither, so this
// file alone swaps in the kit's fake (the alias stays, the other tests keep their mock). The kit's `makeFakeEl` is a DOM without a CSS cascade:
// the layout and the 500 ms repaint in the real pane are measured by the GUI smoke, not here.
vi.mock('obsidian', async () => await import('./vendor/kit/obsidian-mock'));

interface FakeEl {
  children: FakeEl[]; disabled?: boolean; value: string;
  querySelector(sel: string): FakeEl | null; querySelectorAll(sel: string): FakeEl[];
  getAttribute(k: string): string | null; dispatchEvent(e: unknown): boolean;
}
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const flush = async (): Promise<void> => { await tick(); await tick(); };

/** What the plugin holds and the host reads live: the model in use, the busy flag, the thinking level. */
function setup(init: { model?: string; busy?: boolean } = {}) {
  const state = { model: init.model ?? 'm1', list: ['m1', 'm2', 'm3'], busy: init.busy ?? false, level: 'off' as ThinkingLevel, family: null as string | null };
  const llm = {
    models: vi.fn(async () => ({ models: [...state.list], reachable: true })),
    setModel: vi.fn(async (m: string) => { state.model = m; }),
    modelInUse: () => state.model,
    source: () => ({ family: state.family, familySource: 'none', backend: 'unknown', backendSource: 'none', model: state.model, sentModel: state.model }),
  };
  const levels: ThinkingLevel[] = [];
  const opts = (): ModelBarHostOptions => ({
    app: { plugins: { plugins: {} } } as unknown as ModelBarHostOptions['app'],
    llm: llm as unknown as ModelBarHostOptions['llm'],
    label: 'CIPHER',
    busy: () => state.busy,
    thinking: {
      family: () => llm.source().family as ReturnType<ModelBarHostOptions['thinking']['family']>,
      current: () => state.level,
      onLevel: () => 'medium',
      setLevel: async (l) => { levels.push(l); state.level = l; },
      levelPicker: () => false,
      strings: THINKING_STRINGS,
    },
  });
  const el = makeFakeEl() as unknown as FakeEl & HTMLElement;
  return { state, llm, levels, el, opts };
}

const select = (el: FakeEl): FakeEl => el.querySelector('.okit-model-bar-select') as FakeEl;
const bars = (el: FakeEl): FakeEl[] => el.querySelectorAll('.okit-model-bar');

describe('mountModelBarHost', () => {
  it('builds the row exactly once, however often update() runs (the pane repaints every 500 ms)', async () => {
    const s = setup();
    const host = mountModelBarHost(s.el, s.opts);
    await flush();
    const first = bars(s.el)[0];
    expect(bars(s.el)).toHaveLength(1);
    for (let i = 0; i < 6; i++) host.update();
    s.state.busy = true; host.update(); s.state.busy = false; host.update();
    expect(bars(s.el)).toHaveLength(1);
    expect(bars(s.el)[0]).toBe(first);
    expect(s.llm.models).toHaveBeenCalledTimes(1);
  });

  it('update() leaves an unchanged row alone (an open dropdown stays open) and redraws once the state changed', async () => {
    const s = setup();
    const host = mountModelBarHost(s.el, s.opts);
    await flush();
    const option = select(s.el).children[0];
    host.update(); host.update();
    expect(select(s.el).children[0]).toBe(option);
    s.state.model = 'm2';   // changed outside the row (settings tab, manager)
    host.update();
    expect(select(s.el).children[0]).not.toBe(option);
    expect(select(s.el).value).toBe('m2');
  });

  it('redraws when the family of the model changed (the thinking control depends on it), and only then', async () => {
    const s = setup();
    const host = mountModelBarHost(s.el, s.opts);
    await flush();
    const option = select(s.el).children[0];
    host.update();
    expect(select(s.el).children[0]).toBe(option);
    s.state.family = 'qwen3';
    host.update();
    expect(select(s.el).children[0]).not.toBe(option);
  });

  it('busy locks the row, idle frees it; the host reads the latest state, not the state at mount', async () => {
    const s = setup();
    const host = mountModelBarHost(s.el, s.opts);
    await flush();
    expect(select(s.el).disabled).toBe(false);
    s.state.busy = true; host.update();
    expect(select(s.el).disabled).toBe(true);
    s.state.busy = false; host.update();
    expect(select(s.el).disabled).toBe(false);
  });

  it('a change calls llm.setModel, and the row then shows the chosen model', async () => {
    const s = setup();
    mountModelBarHost(s.el, s.opts);
    await flush();
    const dd = select(s.el);
    dd.value = 'm3';
    dd.dispatchEvent({ type: 'change' });
    await flush();
    expect(s.llm.setModel).toHaveBeenCalledWith('m3');
    expect(s.llm.modelInUse()).toBe('m3');
    expect(select(s.el).value).toBe('m3');
  });

  it('puts the thinking control IN the row (no second button) and redraws it when the level changed outside', async () => {
    const s = setup();
    const host = mountModelBarHost(s.el, s.opts);
    await flush();
    expect(s.el.querySelectorAll('.okit-thinking-control')).toHaveLength(1);
    expect(bars(s.el)[0]?.querySelectorAll('.okit-thinking-control')).toHaveLength(1);
    const toggle = (): FakeEl => s.el.querySelector('.okit-thinking-toggle') as FakeEl;
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    s.state.level = 'high'; host.update();
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
  });

  it('reloads the model list when the endpoint changed (listKey), and only then', async () => {
    const s = setup();
    let key = 'a';
    const host = mountModelBarHost(s.el, () => ({ ...s.opts(), listKey: () => key }));
    await flush();
    expect(s.llm.models).toHaveBeenCalledTimes(1);
    host.update(); host.update();
    await flush();
    expect(s.llm.models).toHaveBeenCalledTimes(1);
    key = 'b'; host.update();
    await flush();
    expect(s.llm.models).toHaveBeenCalledTimes(2);
    host.update();
    await flush();
    expect(s.llm.models).toHaveBeenCalledTimes(2);
  });

  it('destroy() removes the row; a later update() builds nothing', async () => {
    const s = setup();
    const host = mountModelBarHost(s.el, s.opts);
    await flush();
    host.destroy();
    expect(bars(s.el)).toHaveLength(0);
    host.update();
    expect(bars(s.el)).toHaveLength(0);
  });
});

describe('setCipherThinking (the call around the kit\'s withThinkingLevel)', () => {
  it('writes the level for CIPHER\'s mode, remembers the last on-level, and saves once', async () => {
    const settings: { request: RequestSettings } = { request: { ...DEFAULT_REQUEST_SETTINGS } };
    const save = vi.fn(async () => undefined);
    await setCipherThinking(settings, 'high', save);
    expect(thinkingFor(settings.request, MODE)).toBe('high');
    expect(settings.request.lastOnLevel[MODE]).toBe('high');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('switching off keeps the last on-level for the next switch-on', async () => {
    const settings: { request: RequestSettings } = { request: { ...DEFAULT_REQUEST_SETTINGS } };
    const save = vi.fn(async () => undefined);
    await setCipherThinking(settings, 'low', save);
    await setCipherThinking(settings, 'off', save);
    expect(thinkingFor(settings.request, MODE)).toBe('off');
    expect(settings.request.lastOnLevel[MODE]).toBe('low');
  });

  it('leaves the other modes alone', async () => {
    const settings: { request: RequestSettings } = { request: { ...DEFAULT_REQUEST_SETTINGS, thinking: { agent: 'high' } } };
    await setCipherThinking(settings, 'low', async () => undefined);
    expect(settings.request.thinking.agent).toBe('high');
  });
});
