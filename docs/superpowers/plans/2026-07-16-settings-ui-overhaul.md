# Settings-UI-Overhaul + Multi-Endpoint-Fallback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** vim-dojos Settings in einklappbare Sektionen gliedern, den CIPHER-Endpoint auf eine geordnete Fallback-Liste umstellen (erster erreichbarer gewinnt) und zwei Kit-QoL-Module (Thinking-Suppression, Kontextlänge) nutzbar machen.

**Architecture:** Kit-first — `collapsibleSection`, `reasoning`, `model-context` werden aus `obsidian-kit@0.14.0` vendored, `resolveActiveEndpoint`/`parseEndpointList` liegen bereits im Vendor. Neuer eigener Code ist dünn und pure: ein Zeilen-Editor-Modell (Vorlage vault-crews), ein Session-Cache-Resolver für den Failover (die Orchestrierung überlässt das Kit bewusst dem Aufrufer) und eine Settings-Migration (Vorlage vault-rag). Die Render-Schicht in `SettingsTab.ts` bleibt dünn und ruft nur pure Funktionen.

**Tech Stack:** TypeScript, Obsidian API (`PluginSettingTab`, `Setting`, `requestUrl`, `setIcon`), Vitest, esbuild.

**Spec:** `docs/superpowers/specs/2026-07-16-settings-ui-overhaul-design.md`

## Global Constraints

- **Kit-Vendoring ist verbatim.** Vendor-Dateien nie von Hand editieren — nur aus `obsidian-kit` kopieren. Quelle: `/Users/Shared/code/obsidian-plugins/obsidian-kit`, Stand `0.14.0` / SHA `644603c` (bereits in `src/vendor/kit/VENDOR.json` gepinnt).
- **Vendor-Code wird nicht doppelt getestet.** `test/vendorKit.test.ts` ist ein Drift-Test (prüft, dass die vendorierte Kopie sich verhält wie erwartet), keine Neu-Abdeckung der Kit-Logik.
- **Code und Kommentare in `src/` sind Englisch** (bestehende Repo-Konvention). Specs/Pläne sind Deutsch.
- **UI-STANDARD:** Der Settings-Tab bleibt Obsidian-nativ. Nur Theme-CSS-Variablen (`var(--…)`), keine festen Farben. Das CRT-Schema gilt ausschließlich in der Plugin-Pane, nicht in den Settings.
- **`isLlmConfigured` bleibt eine reine Konfigurations-Prüfung** — nie Erreichbarkeit prüfen (sonst verschwindet der Chat bei totem Endpoint, statt eine Fehlermeldung zu zeigen).
- **Kein Reasoning im Chat.** `CipherClient` verwirft Reasoning weiterhin by design.
- Testlauf: `npx vitest run` (alle) bzw. `npx vitest run test/<datei> -t "<name>"` (einzeln). Typecheck: `npm run typecheck`. Build: `npm run build`.

---

### Task 1: Kit-Module vendoren

Holt die drei fehlenden Kit-Module in den Vendor-Snapshot und pinnt sie mit einem Drift-Test ab. Das CSS des Collapsible-Moduls wandert in `styles.css`, weil das Kit bewusst kein CSS injiziert.

**Files:**
- Create: `src/vendor/kit/collapsible.ts` (Kopie von `obsidian-kit/src/obsidian/collapsible.ts`)
- Create: `src/vendor/kit/reasoning.ts` (Kopie von `obsidian-kit/src/pure/reasoning.ts`)
- Create: `src/vendor/kit/model-context.ts` (Kopie von `obsidian-kit/src/pure/model-context.ts`)
- Modify: `src/vendor/kit/VENDOR.json`
- Modify: `styles.css` (ans Ende anhängen)
- Test: `test/vendorKit.test.ts`

**Interfaces:**
- Consumes: nichts (erste Task)
- Produces:
  - `collapsibleSection(containerEl: HTMLElement, opts: CollapsibleOptions): HTMLElement`
  - `interface CollapsibleOptions { title: string; defaultCollapsed?: boolean; key?: string; storage?: CollapsibleStorage }`
  - `interface CollapsibleStorage { getCollapsed(key: string): boolean | undefined; setCollapsed(key: string, collapsed: boolean): void }`
  - `resolveCollapsed(key: string | undefined, defaultCollapsed: boolean, storage?: CollapsibleStorage): boolean`
  - `COLLAPSIBLE_CSS: string`
  - `suppressParams(suppress: boolean): Record<string, unknown>`
  - `isAlwaysOnThinker(model: string): boolean`
  - `reasoningHappened(content: string, reasoning: string | undefined): boolean`
  - `type ThinkingSupport = "none" | "hybrid" | "always"`
  - `parseLmStudioContext(json: unknown, model: string): ModelContext | null`
  - `parseOllamaContext(json: unknown): ModelContext | null`
  - `interface ModelContext { maxContextLength?: number; loadedContextLength?: number }`

- [ ] **Step 1: Module verbatim kopieren**

```bash
cd /Users/Shared/code/obsidian-plugins/vim-dojo
KIT=/Users/Shared/code/obsidian-plugins/obsidian-kit/src
cp "$KIT/obsidian/collapsible.ts" src/vendor/kit/collapsible.ts
cp "$KIT/pure/reasoning.ts"      src/vendor/kit/reasoning.ts
cp "$KIT/pure/model-context.ts"  src/vendor/kit/model-context.ts
```

- [ ] **Step 2: VENDOR.json fortschreiben**

Ersetze das `vendored`-Feld (Version und SHA bleiben — der Stand ist derselbe):

```json
{
  "source": "obsidian-kit",
  "version": "0.14.0",
  "sha": "644603c",
  "vendored": "pure/sse.ts, pure/think-splitter.ts (als think.ts), pure/endpoint.ts, pure/endpoint_diagnostics.ts, pure/reasoning.ts, pure/model-context.ts, obsidian/clock.ts, obsidian/collapsible.ts",
  "note": "Verbatim snapshot. Never hand-edit. Re-copy from obsidian-kit to update."
}
```

- [ ] **Step 3: Drift-Test schreiben**

An `test/vendorKit.test.ts` anhängen:

```typescript
import { resolveCollapsed } from '../src/vendor/kit/collapsible';
import { suppressParams, isAlwaysOnThinker } from '../src/vendor/kit/reasoning';
import { parseLmStudioContext, parseOllamaContext } from '../src/vendor/kit/model-context';

describe('vendored collapsible', () => {
  it('resolveCollapsed prefers a stored value over the default', () => {
    const storage = { getCollapsed: () => false, setCollapsed: () => {} };
    expect(resolveCollapsed('cipher', true, storage)).toBe(false);
  });

  it('resolveCollapsed falls back to the default without a stored value', () => {
    const storage = { getCollapsed: () => undefined, setCollapsed: () => {} };
    expect(resolveCollapsed('cipher', true, storage)).toBe(true);
    expect(resolveCollapsed('cipher', false, undefined)).toBe(false);
  });
});

describe('vendored reasoning', () => {
  it('suppressParams is empty when not suppressing and a union of params when it is', () => {
    expect(suppressParams(false)).toEqual({});
    expect(suppressParams(true)).toEqual({
      reasoning_effort: 'none',
      chat_template_kwargs: { enable_thinking: false },
      reasoning_budget: 0,
    });
  });

  it('isAlwaysOnThinker matches gpt-oss and harmony only', () => {
    expect(isAlwaysOnThinker('gpt-oss-20b')).toBe(true);
    expect(isAlwaysOnThinker('qwen3-8b')).toBe(false);
  });
});

describe('vendored model-context', () => {
  it('parseLmStudioContext reads per-model context lengths', () => {
    const json = { data: [{ id: 'qwen3-8b', max_context_length: 32768, loaded_context_length: 8192 }] };
    expect(parseLmStudioContext(json, 'qwen3-8b')).toEqual({ maxContextLength: 32768, loadedContextLength: 8192 });
    expect(parseLmStudioContext(json, 'other')).toBeNull();
  });

  it('parseOllamaContext finds the arch-prefixed context_length', () => {
    expect(parseOllamaContext({ model_info: { 'qwen3.context_length': 40960 } })).toEqual({ maxContextLength: 40960 });
    expect(parseOllamaContext({ model_info: {} })).toBeNull();
  });
});
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run test/vendorKit.test.ts`
Expected: PASS (alle, inkl. der drei neuen describe-Blöcke)

- [ ] **Step 5: CSS übernehmen**

`COLLAPSIBLE_CSS` aus dem Kit ist reines Theme-Variablen-CSS. Ans Ende von `styles.css` anhängen:

```css
/* --- Kit: collapsible settings sections (obsidian-kit 0.14.0, COLLAPSIBLE_CSS) --------
   The kit ships CSS as a string and injects nothing itself; consumers paste it.
   Settings stay theme-native — the CRT scheme applies to the plugin pane only. */
.okit-collapsible-header {
  display: flex; align-items: center; gap: var(--size-4-2);
  cursor: pointer; padding: var(--size-4-2) 0;
  font-weight: var(--font-semibold); color: var(--text-normal);
  border-bottom: 1px solid var(--background-modifier-border);
}
.okit-collapsible-header:hover { color: var(--text-accent); }
.okit-collapsible-header:focus-visible {
  outline: 2px solid var(--interactive-accent);
  outline-offset: 2px;
  border-radius: var(--radius-s);
}
.okit-collapsible-chevron { display: inline-flex; color: var(--text-muted); }
.okit-collapsible-body { padding-top: var(--size-4-2); }
.okit-collapsible-body.is-collapsed { display: none; }
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: keine Ausgabe (Erfolg)

- [ ] **Step 7: Commit**

```bash
git add src/vendor/kit/ test/vendorKit.test.ts styles.css
git commit -m "chore(vendor): collapsible + reasoning + model-context aus obsidian-kit 0.14.0"
```

---

### Task 2: Settings-Datenmodell + Migration

Stellt `llmEndpoint: string` auf `llmEndpoints: string[]` um und ergänzt `llmSuppressThinking` + `uiCollapsed`. Die Migration ist pure und getestet; sie greift auf das rohe `data.json`, **bevor** die Defaults gemerged werden.

Nach dieser Task ist der Baum vorübergehend rot (`SettingsTab.ts` und `main.ts` lesen noch `llmEndpoint`) — Step 5 zieht beide Aufrufstellen minimal nach, damit die Task für sich compiliert und testbar bleibt. Die volle Editor-UI kommt in Task 5.

**Files:**
- Modify: `src/settings.ts` (komplett, siehe Step 3)
- Modify: `src/main.ts:50-51` (Laden), `src/main.ts:252-256` (cfg)
- Modify: `src/SettingsTab.ts:95-140` (provisorisch auf `llmEndpoints[0]`)
- Test: `test/settings.test.ts`

**Interfaces:**
- Consumes: nichts aus Task 1
- Produces:
  - `interface VimDojoSettings` mit `llmEndpoints: string[]`, `llmSuppressThinking: boolean`, `uiCollapsed: Record<string, boolean>` (und unverändert `missionFolder`, `hudPlacement`, `colorScheme`, `autoVim`, `openPaneOnStartup`, `llmApiKey`, `llmModel`)
  - `migrateEndpointList(single: string | undefined, list: string[] | undefined): string[]`
  - `isLlmConfigured(s: Pick<VimDojoSettings, 'llmEndpoints' | 'llmModel'>): boolean`
  - `DEFAULT_SETTINGS: VimDojoSettings`

- [ ] **Step 1: Failing tests schreiben**

`test/settings.test.ts` komplett ersetzen:

```typescript
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, isLlmConfigured, migrateEndpointList } from '../src/settings';

describe('LLM settings', () => {
  it('defaults to unconfigured (feature off)', () => {
    expect(DEFAULT_SETTINGS.llmEndpoints).toEqual([]);
    expect(DEFAULT_SETTINGS.llmApiKey).toBe('');
    expect(DEFAULT_SETTINGS.llmModel).toBe('');
    expect(isLlmConfigured(DEFAULT_SETTINGS)).toBe(false);
  });

  it('suppresses thinking by default (short vim tips, faster answers)', () => {
    expect(DEFAULT_SETTINGS.llmSuppressThinking).toBe(true);
  });

  it('starts with no persisted section states', () => {
    expect(DEFAULT_SETTINGS.uiCollapsed).toEqual({});
  });

  it('requires at least one endpoint and a model', () => {
    expect(isLlmConfigured({ llmEndpoints: ['http://localhost:1234'], llmModel: '' })).toBe(false);
    expect(isLlmConfigured({ llmEndpoints: [], llmModel: 'qwen3' })).toBe(false);
    expect(isLlmConfigured({ llmEndpoints: ['http://localhost:1234'], llmModel: 'qwen3' })).toBe(true);
  });
});

describe('migrateEndpointList', () => {
  it('keeps an existing list and drops blank entries', () => {
    expect(migrateEndpointList(undefined, ['http://a:1', '  ', 'http://b:2'])).toEqual(['http://a:1', 'http://b:2']);
  });

  it('lifts a single 0.4.x endpoint into a one-entry list', () => {
    expect(migrateEndpointList('http://localhost:1234', undefined)).toEqual(['http://localhost:1234']);
    expect(migrateEndpointList('  http://localhost:1234  ', undefined)).toEqual(['http://localhost:1234']);
  });

  it('prefers the list when both are present (list is the newer field)', () => {
    expect(migrateEndpointList('http://old:1', ['http://new:2'])).toEqual(['http://new:2']);
  });

  it('yields an empty list when nothing is configured', () => {
    expect(migrateEndpointList(undefined, undefined)).toEqual([]);
    expect(migrateEndpointList('   ', [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run test/settings.test.ts`
Expected: FAIL — `migrateEndpointList is not a function` bzw. `llmEndpoints` ist `undefined`

- [ ] **Step 3: settings.ts implementieren**

`src/settings.ts` komplett ersetzen:

```typescript
import type { HudPlacement } from './hudPlacement';

/** Color palette: fixed CRT look vs. adaptive Obsidian-theme colors. */
export type ColorScheme = 'crt' | 'native';

export interface VimDojoSettings {
  missionFolder: string;
  hudPlacement: HudPlacement;
  colorScheme: ColorScheme;
  /** Turn Obsidian's Vim mode on for the duration of a mission, restore it after. */
  autoVim: boolean;
  /** Open the NeuroVim pane automatically when Obsidian starts. Off by default. */
  openPaneOnStartup: boolean;
  /** Ordered fallback list of OpenAI-compatible endpoints — the first reachable one
   *  wins. A local endpoint moves with the network (localhost at the host vs. LAN IP
   *  on the road); one synced list covers every network. Empty = feature off. */
  llmEndpoints: string[];
  /** Optional bearer token for cloud proxies (LM Studio/Ollama need none). */
  llmApiKey: string;
  /** Model id to request, e.g. "qwen3-8b". Empty = feature off. */
  llmModel: string;
  /** Ask the model not to think. On by default: vim tips are short, thinking is slow. */
  llmSuppressThinking: boolean;
  /** Collapsed state per settings section, keyed by section id. */
  uiCollapsed: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: VimDojoSettings = {
  missionFolder: 'NeuroVim/',
  hudPlacement: 'auto',
  colorScheme: 'crt',
  autoVim: false,
  openPaneOnStartup: false,
  llmEndpoints: [],
  llmApiKey: '',
  llmModel: '',
  llmSuppressThinking: true,
  uiCollapsed: {},
};

/** Lifts the 0.4.x single `llmEndpoint` into the 0.5.0 `llmEndpoints` list. The list wins
 *  when present (it is the newer field); a lone legacy endpoint becomes a one-entry list.
 *  Pure — the caller applies it to raw `data.json` before defaults are merged. */
export function migrateEndpointList(single: string | undefined, list: string[] | undefined): string[] {
  if (list && list.length) return list.filter((e) => e && e.trim() !== '');
  if (single && single.trim() !== '') return [single.trim()];
  return [];
}

/** The CIPHER uplink is live only when at least one endpoint and a model are set.
 *  Configuration only — reachability is deliberately not checked here, or the chat would
 *  vanish on a dead endpoint instead of reporting the error. */
export function isLlmConfigured(s: Pick<VimDojoSettings, 'llmEndpoints' | 'llmModel'>): boolean {
  return s.llmEndpoints.length > 0 && s.llmModel.trim() !== '';
}
```

- [ ] **Step 4: Tests laufen lassen — müssen grün sein**

Run: `npx vitest run test/settings.test.ts`
Expected: PASS (8 Tests)

- [ ] **Step 5: Aufrufstellen nachziehen**

In `src/main.ts` das Laden (Zeile 50-51) ersetzen — die Migration greift auf den rohen Blob, bevor gemerged wird:

```typescript
    const blob = (await this.loadData()) as StoredBlob | null;
    // Migrate before merging defaults: 0.4.x stored a single `llmEndpoint`, 0.5.0 keeps an
    // ordered fallback list. The legacy field is neither read nor written after this point.
    const raw = (blob?.__settings ?? {}) as Partial<VimDojoSettings> & { llmEndpoint?: string };
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...raw,
      llmEndpoints: migrateEndpointList(raw.llmEndpoint, raw.llmEndpoints),
    };
```

Import in `src/main.ts:22` ergänzen:

```typescript
import { DEFAULT_SETTINGS, isLlmConfigured, migrateEndpointList, type VimDojoSettings } from './settings';
```

In `src/main.ts:252-256` die cfg provisorisch auf den ersten Endpoint stellen (Task 6 ersetzt das durch den Resolver):

```typescript
    const cfg = {
      endpoint: this.settings.llmEndpoints[0] ?? '',
      apiKey: this.settings.llmApiKey,
      model: this.settings.llmModel,
    };
```

In `src/SettingsTab.ts` die vier `llmEndpoint`-Stellen provisorisch auf `llmEndpoints[0]` umbiegen (Task 5 ersetzt den ganzen Block durch den Zeilen-Editor). Zeile 95:

```typescript
      for (const w of validateEndpointInput(this.plugin.settings.llmEndpoints[0] ?? '')) {
```

Zeile 105-110 (`.setValue`/`.onChange` des Textfelds):

```typescript
        t.setPlaceholder('http://localhost:1234')
          .setValue(this.plugin.settings.llmEndpoints[0] ?? '')
          .onChange(async (v) => {
            const url = v.trim();
            this.plugin.settings.llmEndpoints = url ? [url] : [];
            renderWarnings();
            await this.plugin.saveSettings();
          }),
```

Zeile 117 (Preset-Button):

```typescript
            this.plugin.settings.llmEndpoints = [preset.url];
```

Zeile 133 (Probe):

```typescript
          const r = await probeEndpoint(this.plugin.settings.llmEndpoints[0] ?? '', this.plugin.settings.llmApiKey);
```

- [ ] **Step 6: Typecheck + volle Testsuite**

Run: `npm run typecheck && npx vitest run`
Expected: Typecheck ohne Ausgabe, alle Tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/settings.ts src/main.ts src/SettingsTab.ts test/settings.test.ts
git commit -m "feat(settings): Endpoint-Liste, Thinking-Flag, uiCollapsed + Migration aus 0.4.x"
```

---

### Task 3: Einklappbare Sektionen

Gliedert `SettingsTab.display()` in drei Sektionen. Der Auf-/Zu-Zustand persistiert, weil `display()` nach jedem „Test connection" neu rendert — ohne Persistenz klappte die CIPHER-Sektion genau dann zu, wenn der Nutzer das Ergebnis lesen will.

**Files:**
- Modify: `src/SettingsTab.ts`
- Test: keiner (reine Render-Schicht über getestetem Kit-Code; abgedeckt durch den GUI-Smoke in Task 9)

**Interfaces:**
- Consumes: `collapsibleSection`, `CollapsibleStorage` (Task 1); `settings.uiCollapsed` (Task 2)
- Produces: private `collapsibleStorage()` in `NeuroVimSettingTab` — nur intern

- [ ] **Step 1: Storage-Adapter + Sektionen einbauen**

In `src/SettingsTab.ts` den Import ergänzen:

```typescript
import { collapsibleSection, type CollapsibleStorage } from './vendor/kit/collapsible';
```

Innerhalb der Klasse (vor `display()`) den Adapter ergänzen:

```typescript
  /** Wires the kit's storage-agnostic collapsible state to our own settings blob. */
  private collapsibleStorage(): CollapsibleStorage {
    return {
      getCollapsed: (key) => this.plugin.settings.uiCollapsed[key],
      setCollapsed: (key, collapsed) => {
        this.plugin.settings.uiCollapsed[key] = collapsed;
        void this.plugin.saveSettings();
      },
    };
  }
```

In `display()` nach `containerEl.empty()` die Sektionen aufspannen:

```typescript
    const storage = this.collapsibleStorage();
    const missionsEl = collapsibleSection(containerEl, {
      title: 'Missions', key: 'missions', storage, defaultCollapsed: false,
    });
    const appearanceEl = collapsibleSection(containerEl, { title: 'Appearance', key: 'appearance', storage });
    const cipherEl = collapsibleSection(containerEl, {
      title: 'CIPHER uplink (experimental)', key: 'cipher', storage,
    });
```

- [ ] **Step 2: Settings auf die Sektionen verteilen**

Jedes `new Setting(containerEl)` bekommt seinen Sektions-Container statt `containerEl`:

- `missionsEl`: „Mission folder", „Auto Vim mode", „Open pane on startup"
- `appearanceEl`: „HUD placement", „CRT color scheme"
- `cipherEl`: der gesamte LLM-Block (Beschreibung, Endpoint, Warnungen, Connection, Model, API key)

Die alte Überschriften-Zeile ersatzlos löschen — der Sektions-Header ersetzt sie:

```typescript
    new Setting(containerEl).setName('CIPHER uplink (experimental)').setHeading();
```

Im CIPHER-Block außerdem `containerEl.createEl(...)` → `cipherEl.createEl(...)` (Beschreibungs-`<p>`, `warningsEl`, Probe-Ergebnis-`<div>`).

- [ ] **Step 3: Typecheck + Tests**

Run: `npm run typecheck && npx vitest run`
Expected: Typecheck ohne Ausgabe, alle Tests PASS

- [ ] **Step 4: Build (der Settings-Tab hat keine Unit-Tests — der Build ist hier das Netz)**

Run: `npm run build`
Expected: `main.js` wird geschrieben, keine Fehler

- [ ] **Step 5: Commit**

```bash
git add src/SettingsTab.ts
git commit -m "feat(settings): drei einklappbare Sektionen (Missions/Appearance/CIPHER)"
```

---

### Task 4: Endpoint-Editor — pure Logik

Das Zeilen-Editor-Modell, verbatim-nah an `vault-crews/src/obsidian/endpoint-editor-model.ts` (dritte Instanz des REGISTRY-Musters). Obsidian-/DOM-frei und damit in Node testbar; die Render-Schicht in Task 5 bleibt dünn.

**Files:**
- Create: `src/llm/endpointEditor.ts`
- Test: `test/endpointEditor.test.ts`

**Interfaces:**
- Consumes: `EndpointStatusKind` aus `src/vendor/kit/endpoint_diagnostics`
- Produces:
  - `applyEndpointEdit(list: string[], index: number, value: string, isAdder: boolean): string[]`
  - `activeIndexFromStatuses(statuses: (EndpointStatusKind | null)[]): number`

- [ ] **Step 1: Failing tests schreiben**

`test/endpointEditor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { applyEndpointEdit, activeIndexFromStatuses } from '../src/llm/endpointEditor';

describe('applyEndpointEdit', () => {
  it('appends a non-empty value from the adder row', () => {
    expect(applyEndpointEdit(['http://a:1'], 1, 'http://b:2', true)).toEqual(['http://a:1', 'http://b:2']);
  });

  it('ignores an empty adder row', () => {
    expect(applyEndpointEdit(['http://a:1'], 1, '   ', true)).toEqual(['http://a:1']);
  });

  it('replaces an existing row in place', () => {
    expect(applyEndpointEdit(['http://a:1', 'http://b:2'], 0, 'http://c:3', false))
      .toEqual(['http://c:3', 'http://b:2']);
  });

  it('removes a row that is cleared out', () => {
    expect(applyEndpointEdit(['http://a:1', 'http://b:2'], 0, '', false)).toEqual(['http://b:2']);
  });

  it('trims values and never persists blank entries', () => {
    expect(applyEndpointEdit([], 0, '  http://a:1  ', true)).toEqual(['http://a:1']);
    expect(applyEndpointEdit(['  ', 'http://b:2'], 1, 'http://b:2', false)).toEqual(['http://b:2']);
  });
});

describe('activeIndexFromStatuses', () => {
  it('picks the first reachable row (resolveActiveEndpoint semantics)', () => {
    expect(activeIndexFromStatuses(['refused', 'ok', 'ok'])).toBe(1);
  });

  it('returns -1 when nothing is reachable or nothing was probed yet', () => {
    expect(activeIndexFromStatuses(['refused', 'timeout'])).toBe(-1);
    expect(activeIndexFromStatuses([null, null])).toBe(-1);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run test/endpointEditor.test.ts`
Expected: FAIL — `Failed to resolve import "../src/llm/endpointEditor"`

- [ ] **Step 3: Implementieren**

`src/llm/endpointEditor.ts`:

```typescript
/**
 * Pure logic of the endpoint row editor — Obsidian-/DOM-free and node-testable, so the
 * render layer in SettingsTab stays thin. Third instance of the ecosystem's endpoint-list
 * editor pattern (vault-rag, vault-crews) — kept close to vault-crews' model on purpose.
 */
import type { EndpointStatusKind } from '../vendor/kit/endpoint_diagnostics';

/** Applies one row edit to the endpoint list.
 *  - trims the value;
 *  - `isAdder` (the trailing blank row) appends a non-empty value; an empty one is a no-op;
 *  - an existing row cleared out is removed, otherwise replaced in place;
 *  - blanks are filtered at the end — a blank entry is never persisted. */
export function applyEndpointEdit(list: string[], index: number, value: string, isAdder: boolean): string[] {
  const v = value.trim();
  let next: string[];
  if (isAdder) {
    next = v ? [...list, v] : [...list];
  } else {
    next = [...list];
    if (v) next[index] = v;
    else next.splice(index, 1);
  }
  return next.filter((e) => e.trim().length > 0);
}

/** Index of the first row with status `ok` (= the active endpoint, exactly
 *  resolveActiveEndpoint's semantics: first reachable wins), else -1.
 *  `null` = not probed yet. */
export function activeIndexFromStatuses(statuses: (EndpointStatusKind | null)[]): number {
  return statuses.findIndex((s) => s === 'ok');
}
```

- [ ] **Step 4: Tests laufen lassen — müssen grün sein**

Run: `npx vitest run test/endpointEditor.test.ts`
Expected: PASS (7 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/llm/endpointEditor.ts test/endpointEditor.test.ts
git commit -m "feat(llm): pure Zeilen-Editor-Logik für die Endpoint-Liste"
```

---

### Task 5: Endpoint-Editor — UI

Ersetzt das Einzel-Textfeld durch den Zeilen-Editor: eine Zeile je Endpoint plus Adder-Zeile, Presets hängen an, „Test all" probt alle Zeilen und markiert die erste erreichbare als aktiv.

**Files:**
- Modify: `src/SettingsTab.ts` (der CIPHER-Block)
- Modify: `styles.css` (Status-Marker)
- Test: keiner (Render-Schicht; die Logik ist in Task 4 getestet)

**Interfaces:**
- Consumes: `applyEndpointEdit`, `activeIndexFromStatuses` (Task 4); `probeEndpoint` (bestehend); `ENDPOINT_PRESETS`, `validateEndpointInput` (Vendor)
- Produces: nichts für spätere Tasks

- [ ] **Step 1: Probe-State auf die Liste umstellen**

Die Felder der Klasse ersetzen:

```typescript
export class NeuroVimSettingTab extends PluginSettingTab {
  /** Probe status per endpoint row — index-parallel to settings.llmEndpoints.
   *  `null` = not probed yet. Survives display() re-renders. */
  private statuses: (EndpointStatusKind | null)[] = [];
  /** Models reported by the active (first reachable) endpoint. */
  private models: string[] = [];
```

Import ergänzen:

```typescript
import { ENDPOINT_PRESETS, validateEndpointInput, type EndpointStatusKind } from './vendor/kit/endpoint_diagnostics';
import { applyEndpointEdit, activeIndexFromStatuses } from './llm/endpointEditor';
```

- [ ] **Step 2: Zeilen-Editor rendern**

Im CIPHER-Block den alten `endpointSetting`-Block (Textfeld + Presets + Warnungen) ersetzen:

```typescript
    cipherEl.createEl('p', {
      text: 'Endpoints are tried in order — the first reachable one is used. Handy when the '
        + 'same server is localhost at your desk and a LAN IP on the road.',
      cls: 'setting-item-description',
    });

    const rows = [...this.plugin.settings.llmEndpoints, ''];
    rows.forEach((value, index) => {
      const isAdder = index === rows.length - 1;
      const status = isAdder ? null : (this.statuses[index] ?? null);
      const active = activeIndexFromStatuses(this.statuses) === index;

      const row = new Setting(cipherEl)
        .setName(isAdder ? 'Add endpoint' : `Endpoint ${index + 1}${active ? ' — active' : ''}`)
        .addText((t) =>
          t.setPlaceholder('http://localhost:1234')
            .setValue(value)
            .onChange(async (v) => {
              this.plugin.settings.llmEndpoints = applyEndpointEdit(
                this.plugin.settings.llmEndpoints, index, v, isAdder,
              );
              await this.plugin.saveSettings();
            }),
        );

      if (!isAdder) {
        row.setDesc(status ? endpointStatusEn(status, undefined) : 'Not tested yet.');
        row.descEl.addClass(active ? 'nv-endpoint-active' : 'nv-endpoint-row');
        row.addExtraButton((b) =>
          b.setIcon('trash-2').setTooltip('Remove').onClick(async () => {
            this.plugin.settings.llmEndpoints = applyEndpointEdit(
              this.plugin.settings.llmEndpoints, index, '', false,
            );
            this.statuses.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          }),
        );
        for (const w of validateEndpointInput(value)) {
          row.descEl.createEl('div', { text: `⚠ ${endpointWarningEn(w.rule)}`, cls: 'nv-setting-warning' });
        }
      } else {
        ENDPOINT_PRESETS.forEach((preset) => {
          row.addButton((b) =>
            b.setButtonText(preset.label).setTooltip(`Add ${preset.url}`).onClick(async () => {
              this.plugin.settings.llmEndpoints = applyEndpointEdit(
                this.plugin.settings.llmEndpoints, index, preset.url, true,
              );
              await this.plugin.saveSettings();
              this.display();
            }),
          );
        });
      }
    });
```

Die alte `renderWarnings`-Closure und `warningsEl` entfallen — Warnungen hängen jetzt an der jeweiligen Zeile.

- [ ] **Step 3: „Test all" statt „Test connection"**

Den Connection-Block ersetzen:

```typescript
    new Setting(cipherEl)
      .setName('Connection')
      .setDesc('Test every endpoint and load the model list from the first reachable one.')
      .addButton((b) =>
        b.setButtonText('Test all').onClick(async () => {
          b.setButtonText('Testing…');
          b.setDisabled(true);
          const results = await Promise.all(
            this.plugin.settings.llmEndpoints.map((ep) => probeEndpoint(ep, this.plugin.settings.llmApiKey)),
          );
          this.statuses = results.map((r) => r.status.kind);
          const active = activeIndexFromStatuses(this.statuses);
          this.models = active >= 0 ? results[active].models : [];
          this.display();
        }),
      );
```

- [ ] **Step 4: CSS für den Aktiv-Marker**

An `styles.css` anhängen:

```css
.nv-endpoint-active { color: var(--text-success); font-weight: var(--font-semibold); }
.nv-endpoint-row { color: var(--text-muted); }
```

- [ ] **Step 5: Typecheck + Tests + Build**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: alles grün, `main.js` geschrieben

- [ ] **Step 6: Commit**

```bash
git add src/SettingsTab.ts styles.css
git commit -m "feat(settings): Endpoint-Zeilen-Editor mit Test-all und Aktiv-Marker"
```

---

### Task 6: Laufzeit-Failover

Der Resolver hinter `resolveActiveEndpoint`: einmal auflösen je Chat-Start (nicht je Nachricht — sonst zahlt jede Frage den Ping), Session-Cache, bei Request-Fehler genau einmal neu auflösen und wiederholen.

**Files:**
- Create: `src/llm/endpointResolver.ts`
- Modify: `src/main.ts` (`handleCipherAsk`, Feld `endpointResolver`)
- Test: `test/endpointResolver.test.ts`

**Interfaces:**
- Consumes: `resolveActiveEndpoint` aus `src/vendor/kit/endpoint`
- Produces:
  - `class EndpointResolver` mit:
    - `constructor(getEndpoints: () => string[], ping: (endpoint: string) => Promise<boolean>)`
    - `resolve(): Promise<string | null>` — gecacht
    - `invalidate(): void`

- [ ] **Step 1: Failing tests schreiben**

`test/endpointResolver.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EndpointResolver } from '../src/llm/endpointResolver';

describe('EndpointResolver', () => {
  it('resolves to the first reachable endpoint', async () => {
    const ping = vi.fn(async (ep: string) => ep === 'http://b:2');
    const r = new EndpointResolver(() => ['http://a:1', 'http://b:2'], ping);
    expect(await r.resolve()).toBe('http://b:2');
  });

  it('caches the result — a second resolve does not ping again', async () => {
    const ping = vi.fn(async () => true);
    const r = new EndpointResolver(() => ['http://a:1'], ping);
    await r.resolve();
    await r.resolve();
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('pings again after invalidate (endpoint moved to another network)', async () => {
    const ping = vi.fn(async (ep: string) => ep === 'http://b:2');
    const r = new EndpointResolver(() => ['http://a:1', 'http://b:2'], ping);
    expect(await r.resolve()).toBe('http://b:2');
    r.invalidate();
    expect(await r.resolve()).toBe('http://b:2');
    expect(ping).toHaveBeenCalledTimes(4);
  });

  it('returns null when nothing is reachable and does not cache the failure', async () => {
    const ping = vi.fn(async () => false);
    const r = new EndpointResolver(() => ['http://a:1'], ping);
    expect(await r.resolve()).toBeNull();
    await r.resolve();
    expect(ping).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight resolve between concurrent callers', async () => {
    const ping = vi.fn(async () => true);
    const r = new EndpointResolver(() => ['http://a:1'], ping);
    await Promise.all([r.resolve(), r.resolve()]);
    expect(ping).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run test/endpointResolver.test.ts`
Expected: FAIL — `Failed to resolve import "../src/llm/endpointResolver"`

- [ ] **Step 3: Implementieren**

`src/llm/endpointResolver.ts`:

```typescript
/**
 * Failover orchestration around the kit's resolveActiveEndpoint. The kit deliberately does
 * one resolver pass and leaves caching/re-resolve to the caller — this is that caller.
 *
 * A local LLM endpoint moves with the network (localhost at the host, LAN IP on the road),
 * so the list is resolved once per session and re-resolved only when a request actually
 * fails. Resolving per message would make every question pay the ping.
 */
import { resolveActiveEndpoint } from '../vendor/kit/endpoint';

export class EndpointResolver {
  private cached: string | null = null;
  /** In-flight resolve, shared so concurrent asks don't each ping the list. */
  private pending: Promise<string | null> | null = null;

  constructor(
    private readonly getEndpoints: () => string[],
    private readonly ping: (endpoint: string) => Promise<boolean>,
  ) {}

  /** First reachable endpoint, or null if none answers. Cached until invalidate().
   *  A failed resolve is not cached — the next ask retries (the network may be back). */
  async resolve(): Promise<string | null> {
    if (this.cached !== null) return this.cached;
    if (this.pending) return this.pending;
    this.pending = resolveActiveEndpoint(this.getEndpoints(), this.ping)
      .then((ep) => { this.cached = ep; return ep; })
      .finally(() => { this.pending = null; });
    return this.pending;
  }

  /** Drops the cached endpoint so the next resolve() probes the list again. */
  invalidate(): void {
    this.cached = null;
  }
}
```

- [ ] **Step 4: Tests laufen lassen — müssen grün sein**

Run: `npx vitest run test/endpointResolver.test.ts`
Expected: PASS (5 Tests)

- [ ] **Step 5: In main.ts verdrahten**

Import ergänzen:

```typescript
import { EndpointResolver } from './llm/endpointResolver';
import { probeEndpoint } from './llm/endpointProbe';
```

Feld anlegen (bei den anderen privaten Feldern):

```typescript
  private endpointResolver = new EndpointResolver(
    () => this.settings.llmEndpoints,
    async (ep) => (await probeEndpoint(ep, this.settings.llmApiKey)).status.reachable,
  );
```

In `handleCipherAsk` den provisorischen `cfg`-Block aus Task 2 ersetzen. Der Stream wird in eine lokale Closure gehoben, damit der Retry ihn wiederholen kann:

```typescript
    const runStream = async (endpoint: string): Promise<StreamOutcome> =>
      this.cipherClient.stream(
        { endpoint, apiKey: this.settings.llmApiKey, model: this.settings.llmModel },
        messages,
        (t) => {
          // Stale stream from a reset/superseded turn — don't write into the new turn's state.
          if (this.cipherAbort !== myAbort) return;
          // The 500ms repaint tick picks this up — no extra render plumbing.
          this.cipherSession.streaming = (this.cipherSession.streaming ?? '') + t;
        },
        myAbort.signal,
      );

    const endpoint = await this.endpointResolver.resolve();
    let outcome: StreamOutcome = endpoint === null
      ? { ok: false, kind: 'network', detail: 'no endpoint reachable', partial: '' }
      : await runStream(endpoint);

    // A network failure may just mean the cached endpoint moved (host slept, network
    // changed). Re-resolve once and retry — never twice, or a dead uplink stalls the turn.
    if (!outcome.ok && outcome.kind === 'network' && this.cipherAbort === myAbort) {
      this.endpointResolver.invalidate();
      const fresh = await this.endpointResolver.resolve();
      if (fresh !== null && fresh !== endpoint) outcome = await runStream(fresh);
    }
```

Den alten `const outcome = await this.cipherClient.stream(...)`-Aufruf samt seiner Callback-Closure dabei entfernen. `StreamOutcome` importieren:

```typescript
import { CipherClient, type StreamOutcome } from './llm/CipherClient';
```

(Falls `CipherClient` bereits importiert ist, nur `type StreamOutcome` ergänzen.)

- [ ] **Step 6: Typecheck + volle Suite + Build**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: alles grün

- [ ] **Step 7: Commit**

```bash
git add src/llm/endpointResolver.ts src/main.ts test/endpointResolver.test.ts
git commit -m "feat(llm): Endpoint-Failover mit Session-Cache und Einmal-Retry"
```

---

### Task 7: Thinking-Toggle

**Files:**
- Create: `src/llm/thinkToggle.ts`
- Modify: `src/llm/CipherClient.ts` (`CipherConfig`, Request-Body)
- Modify: `src/main.ts` (cfg um `suppressThinking`)
- Modify: `src/SettingsTab.ts` (Toggle im CIPHER-Block)
- Test: `test/thinkToggle.test.ts`, `test/CipherClient.test.ts`

**Interfaces:**
- Consumes: `isAlwaysOnThinker`, `suppressParams` (Task 1)
- Produces:
  - `effectiveSuppress(model: string, suppress: boolean): boolean`
  - `thinkToggleState(model: string, suppress: boolean): { desc: string; disabled: boolean }`
  - `CipherConfig` erweitert um `suppressThinking: boolean`

- [ ] **Step 1: Failing tests für die pure Schicht**

`test/thinkToggle.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { effectiveSuppress, thinkToggleState } from '../src/llm/thinkToggle';

describe('effectiveSuppress', () => {
  it('suppresses when the user asks for it and the model can be silenced', () => {
    expect(effectiveSuppress('qwen3-8b', true)).toBe(true);
  });

  it('never suppresses when the user does not ask for it', () => {
    expect(effectiveSuppress('qwen3-8b', false)).toBe(false);
  });

  it('never suppresses always-on thinkers (they reject reasoning_effort:none)', () => {
    expect(effectiveSuppress('gpt-oss-20b', true)).toBe(false);
    expect(effectiveSuppress('harmony-1', true)).toBe(false);
  });
});

describe('thinkToggleState', () => {
  it('disables the toggle for always-on thinkers and says so', () => {
    const s = thinkToggleState('gpt-oss-20b', true);
    expect(s.disabled).toBe(true);
    expect(s.desc).toContain('always');
  });

  it('stays enabled for silenceable models', () => {
    expect(thinkToggleState('qwen3-8b', true).disabled).toBe(false);
    expect(thinkToggleState('qwen3-8b', false).disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run test/thinkToggle.test.ts`
Expected: FAIL — `Failed to resolve import "../src/llm/thinkToggle"`

- [ ] **Step 3: Pure Schicht implementieren**

`src/llm/thinkToggle.ts`:

```typescript
/**
 * Pure mapping of (model, suppress flag) onto request behaviour and toggle state.
 * Obsidian-/DOM-free. Mirrors image-to-markdown's reasoning_toggle.ts — the app layer
 * above the kit's reasoning primitives.
 */
import { isAlwaysOnThinker } from '../vendor/kit/reasoning';

/** Suppress only when the user wants it AND the model can actually be silenced.
 *  gpt-oss/harmony reject reasoning_effort:"none" — never suppress there. */
export function effectiveSuppress(model: string, suppress: boolean): boolean {
  return suppress && !isAlwaysOnThinker(model);
}

/** Description + disabled state for the settings toggle — mirrors effectiveSuppress on
 *  the UI side so the switch never promises something the request can't deliver. */
export function thinkToggleState(model: string, suppress: boolean): { desc: string; disabled: boolean } {
  if (isAlwaysOnThinker(model)) {
    return { desc: 'This model always thinks — it cannot be turned off.', disabled: true };
  }
  return {
    desc: suppress
      ? 'Off: CIPHER answers straight away. Faster, and vim tips rarely need deliberation.'
      : 'On: the model may think before answering. Slower; the thinking itself is not shown.',
    disabled: false,
  };
}
```

- [ ] **Step 4: Test laufen lassen — muss grün sein**

Run: `npx vitest run test/thinkToggle.test.ts`
Expected: PASS (5 Tests)

- [ ] **Step 5: Failing test für den Request-Body**

An `test/CipherClient.test.ts` anhängen (der bestehende Fake-Transport im File wird wiederverwendet — passe den Namen an die dortige Hilfsfunktion an, falls er abweicht):

```typescript
describe('CipherClient thinking suppression', () => {
  it('sends suppress params when asked', async () => {
    let sent: any = null;
    const transport = {
      postStream: async (_url: string, body: unknown, _h: Record<string, string>, onChunk: (r: string) => void) => {
        sent = body;
        onChunk('data: {"choices":[{"delta":{"content":"hi"}}]}\ndata: [DONE]\n');
        return 200;
      },
    };
    const c = new CipherClient(transport);
    await c.stream(
      { endpoint: 'http://x:1', apiKey: '', model: 'qwen3-8b', suppressThinking: true },
      [{ role: 'user', content: 'q' }],
      () => {},
      new AbortController().signal,
    );
    expect(sent.reasoning_effort).toBe('none');
    expect(sent.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it('sends no suppress params when thinking is allowed', async () => {
    let sent: any = null;
    const transport = {
      postStream: async (_url: string, body: unknown, _h: Record<string, string>, onChunk: (r: string) => void) => {
        sent = body;
        onChunk('data: [DONE]\n');
        return 200;
      },
    };
    const c = new CipherClient(transport);
    await c.stream(
      { endpoint: 'http://x:1', apiKey: '', model: 'qwen3-8b', suppressThinking: false },
      [{ role: 'user', content: 'q' }],
      () => {},
      new AbortController().signal,
    );
    expect(sent.reasoning_effort).toBeUndefined();
  });

  it('never suppresses an always-on thinker even when asked', async () => {
    let sent: any = null;
    const transport = {
      postStream: async (_url: string, body: unknown, _h: Record<string, string>, onChunk: (r: string) => void) => {
        sent = body;
        onChunk('data: [DONE]\n');
        return 200;
      },
    };
    const c = new CipherClient(transport);
    await c.stream(
      { endpoint: 'http://x:1', apiKey: '', model: 'gpt-oss-20b', suppressThinking: true },
      [{ role: 'user', content: 'q' }],
      () => {},
      new AbortController().signal,
    );
    expect(sent.reasoning_effort).toBeUndefined();
  });
});
```

- [ ] **Step 6: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run test/CipherClient.test.ts -t "suppression"`
Expected: FAIL — `sent.reasoning_effort` ist `undefined` (Params werden noch nicht gesendet)

- [ ] **Step 7: CipherClient erweitern**

In `src/llm/CipherClient.ts` die Imports ergänzen:

```typescript
import { suppressParams } from '../vendor/kit/reasoning';
import { effectiveSuppress } from './thinkToggle';
```

`CipherConfig` erweitern:

```typescript
export interface CipherConfig { endpoint: string; apiKey: string; model: string; suppressThinking: boolean }
```

Den Body-Bau (Zeile 53) ersetzen:

```typescript
    const body = {
      model: cfg.model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1024,
      ...suppressParams(effectiveSuppress(cfg.model, cfg.suppressThinking)),
    };
```

- [ ] **Step 8: Test laufen lassen — muss grün sein**

Run: `npx vitest run test/CipherClient.test.ts`
Expected: PASS (alle, inkl. der drei neuen)

- [ ] **Step 9: main.ts + Settings-UI nachziehen**

In `src/main.ts` in `runStream` (Task 6) die cfg ergänzen:

```typescript
        { endpoint, apiKey: this.settings.llmApiKey, model: this.settings.llmModel, suppressThinking: this.settings.llmSuppressThinking },
```

In `src/SettingsTab.ts` im CIPHER-Block hinter dem Model-Setting einfügen:

```typescript
    const think = thinkToggleState(this.plugin.settings.llmModel, this.plugin.settings.llmSuppressThinking);
    new Setting(cipherEl)
      .setName('Model thinking')
      .setDesc(think.desc)
      .addToggle((t) =>
        t
          .setValue(!this.plugin.settings.llmSuppressThinking)
          .setDisabled(think.disabled)
          .onChange(async (v) => {
            this.plugin.settings.llmSuppressThinking = !v;
            await this.plugin.saveSettings();
            this.display();
          }),
      );
```

Import ergänzen:

```typescript
import { thinkToggleState } from './llm/thinkToggle';
```

Hinweis: Der Toggle zeigt „thinking on" (`!llmSuppressThinking`), das Setting speichert „suppress" — das ist Absicht, die Beschriftung soll positiv sein.

- [ ] **Step 10: Typecheck + volle Suite + Build**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: alles grün

- [ ] **Step 11: Commit**

```bash
git add src/llm/thinkToggle.ts src/llm/CipherClient.ts src/main.ts src/SettingsTab.ts test/thinkToggle.test.ts test/CipherClient.test.ts
git commit -m "feat(llm): Thinking-Toggle (Kit-suppressParams, Always-On-Modelle ausgenommen)"
```

---

### Task 8: Kontextlänge

**Files:**
- Create: `src/llm/modelContext.ts`
- Modify: `src/SettingsTab.ts` (Anzeige am Model-Feld)
- Test: `test/modelContext.test.ts`

**Interfaces:**
- Consumes: `parseLmStudioContext`, `parseOllamaContext` (Task 1); `normalizeEndpoint` (Vendor)
- Produces: `probeModelContext(endpoint: string, apiKey: string, model: string): Promise<number | null>`

- [ ] **Step 1: Failing tests schreiben**

`test/modelContext.test.ts` — `requestUrl` wird über den bestehenden Obsidian-Mock gestellt (siehe `test/obsidian-mock.ts` und `vitest.config.ts`; das Muster steht in `test/modelList.test.ts` bzw. `endpointText.test.ts`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const requestUrl = vi.fn();
vi.mock('obsidian', () => ({ requestUrl: (...a: unknown[]) => requestUrl(...a) }));

import { probeModelContext } from '../src/llm/modelContext';

beforeEach(() => { requestUrl.mockReset(); });

describe('probeModelContext', () => {
  it('reads the loaded context length from LM Studio', async () => {
    requestUrl.mockResolvedValueOnce({
      status: 200,
      text: JSON.stringify({ data: [{ id: 'qwen3-8b', max_context_length: 32768, loaded_context_length: 8192 }] }),
    });
    expect(await probeModelContext('http://localhost:1234', '', 'qwen3-8b')).toBe(8192);
    expect(requestUrl).toHaveBeenCalledTimes(1);
  });

  it('falls back to Ollama when LM Studio does not know the model', async () => {
    requestUrl
      .mockResolvedValueOnce({ status: 404, text: 'not found' })
      .mockResolvedValueOnce({ status: 200, text: JSON.stringify({ model_info: { 'qwen3.context_length': 40960 } }) });
    expect(await probeModelContext('http://localhost:11434', '', 'qwen3')).toBe(40960);
    expect(requestUrl).toHaveBeenCalledTimes(2);
  });

  it('returns null when neither endpoint reports a context length', async () => {
    requestUrl
      .mockResolvedValueOnce({ status: 404, text: '' })
      .mockResolvedValueOnce({ status: 404, text: '' });
    expect(await probeModelContext('http://x:1', '', 'm')).toBeNull();
  });

  it('never throws — a failing request maps to null', async () => {
    requestUrl.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await probeModelContext('http://x:1', '', 'm')).toBeNull();
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run test/modelContext.test.ts`
Expected: FAIL — `Failed to resolve import "../src/llm/modelContext"`

- [ ] **Step 3: Implementieren**

`src/llm/modelContext.ts`:

```typescript
/**
 * Best-effort context-length probe for the selected model: LM Studio first, Ollama as a
 * fallback. Purely informational — never throws, and a null result simply means "this
 * endpoint doesn't report it" (many OpenAI-compatible servers don't).
 * Probe order mirrors vault-crews' local-llm-client.
 */
import { requestUrl } from 'obsidian';
import { normalizeEndpoint } from '../vendor/kit/endpoint';
import { parseLmStudioContext, parseOllamaContext } from '../vendor/kit/model-context';

const PROBE_TIMEOUT_MS = 5_000;

function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

/** Max usable context of `model` in tokens, or null if the endpoint can't tell us. */
export async function probeModelContext(endpoint: string, apiKey: string, model: string): Promise<number | null> {
  const base = normalizeEndpoint(endpoint);
  const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const timeout = new Promise<'timeout'>((res) => window.setTimeout(() => res('timeout'), PROBE_TIMEOUT_MS));

  try {
    const lm = await Promise.race([
      requestUrl({ url: `${base}/api/v0/models`, method: 'GET', headers, throw: false }),
      timeout,
    ]);
    if (lm !== 'timeout' && lm.status >= 200 && lm.status < 300) {
      const ctx = parseLmStudioContext(parseJson(lm.text), model);
      if (ctx) return ctx.loadedContextLength ?? ctx.maxContextLength ?? null;
    }
  } catch { /* fall through to Ollama */ }

  try {
    const oll = await Promise.race([
      requestUrl({
        url: `${base}/api/show`,
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
        throw: false,
      }),
      timeout,
    ]);
    if (oll !== 'timeout' && oll.status >= 200 && oll.status < 300) {
      const ctx = parseOllamaContext(parseJson(oll.text));
      if (ctx) return ctx.maxContextLength ?? null;
    }
  } catch { /* nothing reports a context length */ }

  return null;
}
```

- [ ] **Step 4: Tests laufen lassen — müssen grün sein**

Run: `npx vitest run test/modelContext.test.ts`
Expected: PASS (4 Tests)

- [ ] **Step 5: In den Settings anzeigen**

In `src/SettingsTab.ts` ein Feld ergänzen:

```typescript
  /** Context length of the selected model in tokens, null = endpoint doesn't report it. */
  private contextLength: number | null = null;
```

Import:

```typescript
import { probeModelContext } from './llm/modelContext';
```

Eine private Hilfsfunktion in der Klasse:

```typescript
  /** Refreshes the context length for the active endpoint + selected model, then re-renders. */
  private async refreshContext(): Promise<void> {
    const active = activeIndexFromStatuses(this.statuses);
    const endpoint = active >= 0 ? this.plugin.settings.llmEndpoints[active] : undefined;
    this.contextLength = endpoint && this.plugin.settings.llmModel
      ? await probeModelContext(endpoint, this.plugin.settings.llmApiKey, this.plugin.settings.llmModel)
      : null;
    this.display();
  }
```

Im „Test all"-Handler (Task 5, Step 3) nach `this.models = ...` das `this.display()` durch den Kontext-Refresh ersetzen:

```typescript
          this.models = active >= 0 ? results[active].models : [];
          await this.refreshContext();
```

Im Model-Dropdown-`onChange` (Task 5 unverändert übernommen) nach dem Speichern ebenfalls:

```typescript
          d.onChange(async (v) => {
            this.plugin.settings.llmModel = v;
            await this.plugin.saveSettings();
            await this.refreshContext();
          });
```

Direkt hinter dem Model-Setting die Anzeige (nur wenn bekannt):

```typescript
    if (this.contextLength !== null) {
      cipherEl.createEl('div', {
        text: `Context: ${this.contextLength.toLocaleString('en-US')} tokens`,
        cls: 'setting-item-description',
      });
    }
```

- [ ] **Step 6: Typecheck + volle Suite + Build**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: alles grün

- [ ] **Step 7: Commit**

```bash
git add src/llm/modelContext.ts src/SettingsTab.ts test/modelContext.test.ts
git commit -m "feat(llm): Kontextlänge des Modells anzeigen (LM Studio + Ollama)"
```

---

### Task 9: Smoke-Test, Registry, Release

**Files:**
- Modify: `/Users/Shared/code/obsidian-plugins/REGISTRY.md` (Zeilen 76, 81, 82 + Thinking-Toggle-Eintrag)
- Modify: `README.md` (Configuration), `CHANGELOG.md`
- Test: GUI-Smoke in Obsidian (manuell, durch Jay)

**Interfaces:**
- Consumes: alles Vorherige
- Produces: Release 0.5.0

- [ ] **Step 1: GUI-Smoke in Obsidian**

Deployen und in Obsidian durchklicken:

```bash
npm run build
cp main.js manifest.json styles.css "/Users/Shared/10_ObsidianVaults/10_Pallas/.obsidian/plugins/neurovim/"
```

Prüfliste (Obsidian neu laden, Settings → NeuroVim):
1. Drei Sektionen sichtbar; „Missions" offen, „Appearance"/„CIPHER" zu.
2. Sektion auf/zu klicken, Settings schließen und neu öffnen → Zustand bleibt.
3. Tab-Taste auf einen Header → Fokus-Ring sichtbar; Enter/Leertaste klappt auf.
4. Zwei Endpoints eintragen (ein toter zuerst, dann der echte), „Test all" → der zweite ist als „active" markiert, die CIPHER-Sektion bleibt nach dem Re-Render offen.
5. Modell-Dropdown gefüllt; „Context: …" erscheint (LM Studio) oder fehlt stillschweigend.
6. Chat: eine Frage stellen → Antwort kommt über den zweiten Endpoint.
7. Thinking-Toggle aus → Antwort kommt ohne Denkpause. Modell auf `gpt-oss-*` stellen → Toggle deaktiviert mit „always" im Text.
8. Endpoint-Zeile löschen (Papierkorb) → verschwindet, bleibt nach Reload gelöscht.

- [ ] **Step 2: Migration am echten Vault verifizieren**

Der Pallas-Vault hat eine 0.4.x-`data.json` mit `llmEndpoint`. Nach dem ersten Start mit 0.5.0:

```bash
python3 -c "import json;d=json.load(open('/Users/Shared/10_ObsidianVaults/10_Pallas/.obsidian/plugins/neurovim/data.json'));print(d.get('__settings',{}))"
```

Expected: `llmEndpoints` enthält den alten Wert als Ein-Element-Liste, `llmEndpoint` ist verschwunden, XP/Bestzeiten unverändert.

- [ ] **Step 3: REGISTRY pflegen (AGENTS.md §2 — verbindlich)**

In `/Users/Shared/code/obsidian-plugins/REGISTRY.md`:
- **Zeile 76** (`collapsibleSection`): vim-dojo in die Consumer-Klammer aufnehmen → `(vendored: vault-rag @0.15.0+, vim-dojo @0.5.0)`.
- **Zeile 81** (Endpoint-Listen-Editor): vim-dojo `src/llm/endpointEditor.ts` als drittes Exemplar ergänzen; Status → **Kit-Kandidat, Regel der Drei erfüllt (3 Repos: vault-rag, vault-crews, vim-dojo) — Kit-Bewertung im nächsten drift-audit fällig**.
- **Zeile 82** (Single-Endpoint-QoL): auflösen — vim-dojo ist mit 0.5.0 kein Single-Endpoint-Plugin mehr; den Eintrag entweder streichen oder auf „historisch, aufgegangen in Zeile 81" setzen.
- **Neuer Eintrag** unter Settings: Thinking-Toggle-App-Schicht über Kit-`reasoning` → `image-to-markdown/src/reasoning_toggle.ts` · `vim-dojo/src/llm/thinkToggle.ts` — Kit-Kandidat (2 Exemplare).
- **Neuer Eintrag:** Failover-Orchestrierung über `resolveActiveEndpoint` (Session-Cache + Einmal-Retry) → `vim-dojo/src/llm/endpointResolver.ts` — erstes Exemplar.

- [ ] **Step 4: README + CHANGELOG**

README, Configuration-Sektion: die Endpoint-Liste (erster erreichbarer gewinnt, ein Backend über mehrere Netze), den Thinking-Toggle und die Sektionen beschreiben.

CHANGELOG, neuer `## 0.5.0`-Block:

```markdown
## 0.5.0

- Settings are grouped into collapsible sections (Missions / Appearance / CIPHER uplink);
  the open/closed state is remembered.
- The CIPHER endpoint is now an ordered fallback list — the first reachable one is used.
  One synced config covers localhost at your desk and a LAN IP on the road. Existing
  single-endpoint settings migrate automatically.
- New "Model thinking" toggle (off by default): CIPHER answers straight away instead of
  deliberating. Models that always think (gpt-oss/harmony) are detected and exempt.
- The model's context length is shown when the endpoint reports it (LM Studio, Ollama).
```

- [ ] **Step 5: Release**

Run: `npm run release 0.5.0`
Expected: Version-Bump, Tag, Dual-Push (Codeberg + GitHub). Braucht `~/.codeberg-token`; nur auf `main`.

- [ ] **Step 6: REGISTRY committen** (eigenes Repo — das Dach ist nicht Teil von vim-dojo)

```bash
cd /Users/Shared/code/obsidian-plugins
git add REGISTRY.md
git commit -m "docs(registry): vim-dojo 0.5.0 — collapsible-Consumer, Endpoint-Editor n=3, thinkToggle n=2"
```

---

## Self-Review

**Spec-Abdeckung:** Sektionen → Task 3 · Multi-Endpoint-Datenmodell/Migration → Task 2 · Editor-UI → Task 4+5 · Laufzeit-Failover → Task 6 · Feature-Gate `isLlmConfigured` → Task 2 · Thinking → Task 7 · Kontextlänge → Task 8 · Vendoring → Task 1 · Tests → in jeder Task · GUI-Smoke → Task 9 · REGISTRY/README/CHANGELOG/Release → Task 9. Keine Lücke.

**Typkonsistenz:** `llmEndpoints`/`llmSuppressThinking`/`uiCollapsed` (Task 2) werden in 3/5/6/7/8 identisch benannt verwendet. `CipherConfig.suppressThinking` (Task 7) passt zur cfg in `runStream` (Task 6, in 7 Step 9 ergänzt). `activeIndexFromStatuses` (Task 4) wird in 5 und 8 genutzt. `StreamOutcome` ist in `CipherClient.ts` bereits exportiert.

**Reihenfolge-Abhängigkeit:** Task 2 macht den Baum kurz rot und heilt ihn im selben Task (Step 5) — jede Task endet grün und committet für sich.
</content>
</invoke>
