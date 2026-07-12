import { describe, it, expect } from 'vitest';
import { HudMount, type HudDom, type HudHandle, type HudRenderProps } from '../src/HudMount';

class FakeHandle implements HudHandle {
  rendered: HudRenderProps[] = [];
  destroyed = false;
  constructor(public el: unknown) {}
  render(p: HudRenderProps): void { this.rendered.push(p); }
  destroy(): void { this.destroyed = true; }
}

function makeFakeDom(visible: Set<string>) {
  const created: FakeHandle[] = [];
  const dom: HudDom = {
    editorElFor: (path) => (visible.has(path) ? { path } : null),
    create: (el) => { const h = new FakeHandle(el); created.push(h); return h; },
  };
  return { dom, created, visible };
}

function props(over: Partial<HudRenderProps> = {}): HudRenderProps {
  return {
    id: 'M-01', title: 'The Three Modes', elapsedMs: 0, keystrokes: 0, vimActive: true,
    scheme: 'crt', onSubmit() {}, onReset() {}, onAbandon() {}, ...over,
  };
}

const active = (path: string, p: HudRenderProps = props()) => ({ notePath: path, props: p });

describe('HudMount', () => {
  it('mounts and renders when the mission note is visible', () => {
    const f = makeFakeDom(new Set(['NeuroVim/M-01.md']));
    const mount = new HudMount(f.dom);
    mount.sync(active('NeuroVim/M-01.md'));
    expect(f.created).toHaveLength(1);
    expect(mount.isAttached).toBe(true);
    expect(f.created[0].rendered).toHaveLength(1);
  });

  it('is idempotent — syncing the same visible note twice mounts once, renders twice', () => {
    const f = makeFakeDom(new Set(['NeuroVim/M-01.md']));
    const mount = new HudMount(f.dom);
    mount.sync(active('NeuroVim/M-01.md', props({ elapsedMs: 100 })));
    mount.sync(active('NeuroVim/M-01.md', props({ elapsedMs: 600 })));
    expect(f.created).toHaveLength(1);
    expect(f.created[0].rendered.map((r) => r.elapsedMs)).toEqual([100, 600]);
  });

  it('does not mount when the note is not in a visible leaf', () => {
    const f = makeFakeDom(new Set());
    const mount = new HudMount(f.dom);
    mount.sync(active('NeuroVim/M-01.md'));
    expect(f.created).toHaveLength(0);
    expect(mount.isAttached).toBe(false);
  });

  it('detaches when there is no active mission', () => {
    const f = makeFakeDom(new Set(['NeuroVim/M-01.md']));
    const mount = new HudMount(f.dom);
    mount.sync(active('NeuroVim/M-01.md'));
    mount.sync(null);
    expect(f.created[0].destroyed).toBe(true);
    expect(mount.isAttached).toBe(false);
  });

  it('detaches when the active note stops being visible', () => {
    const visible = new Set(['NeuroVim/M-01.md']);
    const f = makeFakeDom(visible);
    const mount = new HudMount(f.dom);
    mount.sync(active('NeuroVim/M-01.md'));
    visible.delete('NeuroVim/M-01.md'); // user navigated away
    mount.sync(active('NeuroVim/M-01.md'));
    expect(f.created[0].destroyed).toBe(true);
    expect(mount.isAttached).toBe(false);
  });

  it('re-mounts on a fresh handle when the active note path changes', () => {
    const f = makeFakeDom(new Set(['NeuroVim/M-01.md', 'NeuroVim/M-02.md']));
    const mount = new HudMount(f.dom);
    mount.sync(active('NeuroVim/M-01.md'));
    mount.sync(active('NeuroVim/M-02.md'));
    expect(f.created).toHaveLength(2);
    expect(f.created[0].destroyed).toBe(true);
    expect(mount.isAttached).toBe(true);
  });

  it('detach() is a no-op when nothing is mounted', () => {
    const f = makeFakeDom(new Set());
    const mount = new HudMount(f.dom);
    expect(() => mount.detach()).not.toThrow();
    expect(mount.isAttached).toBe(false);
  });
});
