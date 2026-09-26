import { describe, it, expect, vi, afterEach } from 'vitest';
import { App, Setting } from 'obsidian';
import { NeuroVimSettingTab } from '../src/SettingsTab';
import { DEFAULT_SETTINGS } from '../src/settings';

// UI-STANDARD §8 „Hilfe-Zeile (Settings)": erstes Element des Tabs, „Open documentation" auf den
// Doku-Index, `bug`-Knopf auf die Issues dieses Repos. Die Settings dieses Plugins sind nur
// englisch, deshalb bekommt die Zeile nur EN-Texte (Regel „die Hilfe-Zeile spricht die Sprache
// ihres Tabs").
const DOCS = 'https://github.com/johannes-kaindl/neurovim-obsidian/blob/main/docs/README.md';
const ISSUES = 'https://github.com/johannes-kaindl/neurovim-obsidian/issues';

function makeTab(): NeuroVimSettingTab {
  const plugin = { settings: { ...DEFAULT_SETTINGS }, saveSettings: async () => undefined, applyMissionFolderVisibility: () => undefined };
  return new NeuroVimSettingTab(new App() as never, plugin as never);
}

type Erste = { type?: string; name?: string; desc?: string; render?: (s: Setting) => unknown };

afterEach(() => { vi.unstubAllGlobals(); });

describe('Hilfe-Zeile in den Settings', () => {
  it('ist das ERSTE Element von getSettingDefinitions(), vor jeder Überschrift', () => {
    const first = makeTab().getSettingDefinitions()[0] as Erste;
    expect(first.type).not.toBe('group');
    expect(first.name).toBe('Help');
    expect(first.desc).toBe('Getting started, how-tos and troubleshooting');
    expect(typeof first.render).toBe('function');
  });

  it('öffnet Doku-Index und Issues dieses Repos', () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    const first = makeTab().getSettingDefinitions()[0] as Erste;
    const setting = new Setting({}) ;
    first.render!(setting);
    const [docsBtn, bugBtn] = (setting as unknown as { components: Array<{ text?: string; iconName?: string; tooltip?: string; clickCB: () => void }> }).components;
    expect(docsBtn.text).toBe('Open documentation');
    expect(bugBtn.iconName).toBe('bug');
    expect(bugBtn.tooltip).toBe('Report an issue');
    docsBtn.clickCB();
    bugBtn.clickCB();
    expect(open.mock.calls.map((c) => c[0])).toEqual([DOCS, ISSUES]);
  });
});
