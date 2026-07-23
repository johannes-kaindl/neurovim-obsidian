import { describe, it, expect } from 'vitest';
import { App } from 'obsidian';
import { NeuroVimSettingTab } from '../src/SettingsTab';
import { DEFAULT_SETTINGS, type VimDojoSettings } from '../src/settings';

/** Builds a settings tab over a fake plugin, tracking saveSettings() calls. The declarative
 *  control layer (getControlValue/setControlValue) is what Obsidian 1.13 reads/writes and what
 *  the ≤1.12 imperative fallback drives too — one truth, so it's worth testing in isolation. */
function makeTab(overrides: Partial<VimDojoSettings> = {}) {
  const settings: VimDojoSettings = { ...DEFAULT_SETTINGS, ...overrides };
  let saves = 0;
  const plugin = { settings, saveSettings: async () => { saves += 1; } };
  const tab = new NeuroVimSettingTab(new App() as never, plugin as never);
  return { tab, settings, saves: () => saves };
}

describe('SettingsTab declarative control layer', () => {
  it('surfaces colorScheme as a boolean toggle (crt = on)', () => {
    expect(makeTab({ colorScheme: 'crt' }).tab.getControlValue('colorScheme')).toBe(true);
    expect(makeTab({ colorScheme: 'native' }).tab.getControlValue('colorScheme')).toBe(false);
  });

  it('maps the colorScheme toggle back to the stored crt/native string', async () => {
    const { tab, settings } = makeTab({ colorScheme: 'native' });
    await tab.setControlValue('colorScheme', true);
    expect(settings.colorScheme).toBe('crt');
    await tab.setControlValue('colorScheme', false);
    expect(settings.colorScheme).toBe('native');
  });

  it('coerces an empty mission folder back to the default (never the vault root)', async () => {
    const { tab, settings } = makeTab({ missionFolder: 'Custom/' });
    await tab.setControlValue('missionFolder', '   ');
    expect(settings.missionFolder).toBe('_neurovim/');
    await tab.setControlValue('missionFolder', 'Drills/');
    expect(settings.missionFolder).toBe('Drills/');
  });

  it('passes plain boolean/string settings straight through', async () => {
    const { tab, settings } = makeTab({ autoVim: false, hudPlacement: 'auto' });
    expect(tab.getControlValue('autoVim')).toBe(false);
    await tab.setControlValue('autoVim', true);
    expect(settings.autoVim).toBe(true);
    await tab.setControlValue('hudPlacement', 'sidebar');
    expect(settings.hudPlacement).toBe('sidebar');
  });

  it('persists on every control write', async () => {
    const h = makeTab();
    await h.tab.setControlValue('autoVim', true);
    await h.tab.setControlValue('recordTraces', false);
    expect(h.saves()).toBe(2);
  });
});
