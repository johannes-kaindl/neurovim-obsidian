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
  let visibilityCalls = 0;
  const plugin = {
    settings,
    saveSettings: async () => { saves += 1; },
    applyMissionFolderVisibility: () => { visibilityCalls += 1; },
  };
  const tab = new NeuroVimSettingTab(new App() as never, plugin as never);
  return { tab, settings, saves: () => saves, visibilityCalls: () => visibilityCalls };
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

  it('coerces the paused-banner threshold from its text control to a sane number', async () => {
    const { tab, settings } = makeTab({ pausedBannerMinutes: 5 });
    await tab.setControlValue('pausedBannerMinutes', '10');
    expect(settings.pausedBannerMinutes).toBe(10);
    await tab.setControlValue('pausedBannerMinutes', '0');   // 0 disables the banner
    expect(settings.pausedBannerMinutes).toBe(0);
    await tab.setControlValue('pausedBannerMinutes', 'abc'); // never write NaN to data.json
    expect(settings.pausedBannerMinutes).toBe(5);
    await tab.setControlValue('pausedBannerMinutes', '-3');
    expect(settings.pausedBannerMinutes).toBe(5);
  });

  it('coerces an empty mission folder back to the default (never the vault root)', async () => {
    const { tab, settings } = makeTab({ missionFolder: 'Custom/' });
    await tab.setControlValue('missionFolder', '   ');
    expect(settings.missionFolder).toBe('_neurovim/');
    await tab.setControlValue('missionFolder', 'Drills/');
    expect(settings.missionFolder).toBe('Drills/');
  });

  it('re-derives folder visibility after either the folder or the hide toggle changes', async () => {
    const { tab, visibilityCalls } = makeTab({ missionFolder: '_neurovim/', hideMissionFolder: false });
    await tab.setControlValue('missionFolder', 'Drills/');
    expect(visibilityCalls()).toBe(1);
    await tab.setControlValue('hideMissionFolder', true);
    expect(visibilityCalls()).toBe(2);
    // An unrelated setting must not trigger a needless stylesheet re-derive.
    await tab.setControlValue('autoVim', true);
    expect(visibilityCalls()).toBe(2);
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

describe('status bar row (UI-STANDARD §8 Statusleisten-Eintrag)', () => {
  type Row = { name?: string; render?: (s: unknown) => void };
  const rowOf = (tab: NeuroVimSettingTab): Row | undefined => {
    const groups = tab.getSettingDefinitions() as unknown as Array<{ type?: string; items?: Row[] }>;
    return groups.flatMap((g) => g.items ?? []).find((i) => i.name === 'Status bar');
  };
  const stubSetting = (): { setting: Record<string, unknown>; value: () => boolean | undefined; change: (v: boolean) => void } => {
    let value: boolean | undefined; let onChange: ((v: boolean) => void) | undefined;
    const setting: Record<string, unknown> = {
      setName: () => setting, setDesc: () => setting,
      addToggle: (cb: (t: unknown) => void) => {
        const t: Record<string, unknown> = { setValue: (v: boolean) => { value = v; return t; }, onChange: (f: (v: boolean) => void) => { onChange = f; return t; } };
        cb(t); return setting;
      },
    };
    return { setting, value: () => value, change: (v) => onChange?.(v) };
  };

  it('is a row in the Appearance group, shows the stored state and saves showStatusBar when flipped', async () => {
    const { tab, settings, saves } = makeTab();
    const row = rowOf(tab);
    expect(row).toBeDefined();
    const s = stubSetting();
    row!.render!(s.setting);
    expect(s.value()).toBe(true);   // on by default
    s.change(false);
    await Promise.resolve(); await Promise.resolve();
    expect(settings.showStatusBar).toBe(false);
    expect(saves()).toBe(1);
  });

  it('shows an off switch when the stored value is off', () => {
    const { tab } = makeTab({ showStatusBar: false });
    const s = stubSetting();
    rowOf(tab)!.render!(s.setting);
    expect(s.value()).toBe(false);
  });
});

describe('SettingsTab LLM connection section', () => {
  // NeuroVim is English-only on purpose (no UI language switch, `src/llm/modelBarHost.ts`): the kit's
  // section must say so explicitly instead of relying on the kit default, and must not follow Obsidian's language.
  it('draws the kit connection in English, whatever language Obsidian runs in', () => {
    const calls: unknown[][] = [];
    const plugin = {
      settings: { ...DEFAULT_SETTINGS },
      llm: { renderSettings: (...args: unknown[]) => { calls.push(args); }, hideSettings: () => undefined },
    };
    const tab = new NeuroVimSettingTab(new App() as never, plugin as never);
    const host = { createDiv: () => ({}) };
    const setting = { settingEl: { empty: () => undefined, removeClass: () => undefined, createDiv: host.createDiv } };
    (tab as unknown as { renderConnection: (s: unknown) => void }).renderConnection(setting);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toEqual({ lang: 'en' });
  });
});
