import { describe, expect, it, vi } from 'vitest';
import NeuroVimPlugin from '../src/main';
import { DEFAULT_SETTINGS } from '../src/settings';

/** The plugin's save path is where the switch reaches the kit handle (setVisible); the repaint after it
 *  is what puts the mission text back when the entry was just re-created. */
describe('status bar switch wiring', () => {
  it('saveSettings passes the switch to the handle before the repaint', async () => {
    const calls: string[] = [];
    const p = new NeuroVimPlugin({} as never, { id: 'neurovim' } as never) as unknown as {
      settings: typeof DEFAULT_SETTINGS; statusBar: { setVisible(v: boolean): void };
      persist(): Promise<void>; repaint(): void; saveSettings(): Promise<void>;
    };
    p.settings = { ...DEFAULT_SETTINGS, showStatusBar: false };
    p.statusBar = { setVisible: (v) => { calls.push(`setVisible:${v}`); } };
    p.persist = vi.fn(async () => { calls.push('persist'); });
    p.repaint = vi.fn(() => { calls.push('repaint'); });
    await p.saveSettings();
    expect(calls).toEqual(['persist', 'setVisible:false', 'repaint']);
    p.settings.showStatusBar = true;
    await p.saveSettings();
    expect(calls.slice(3)).toEqual(['persist', 'setVisible:true', 'repaint']);
  });
});
