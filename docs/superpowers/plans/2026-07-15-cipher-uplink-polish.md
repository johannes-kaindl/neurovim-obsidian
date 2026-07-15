# CIPHER Uplink Polish — Smoke-Findings, Tab-Navigation, Settings-QoL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jays Smoke-Findings fixen (Titel-Umbruch, CRT-Härtung gegen Custom-Themes), die Hub-Pane in Tabs `NEXUS · MISSIONS · GUIDE · UPLINK` strukturieren (inkl. durchsuchbarem Cheatsheet und Welcome-Surfacing) und die LLM-Settings auf vault-rag-Niveau heben (Test-Button mit Diagnose, Presets, Modell-Dropdown).

**Architecture:** Reine CSS-Fixes zuerst. Dann Kit-`endpoint_diagnostics` vendorn (verbatim; deutsche Klartexte werden über eine eigene pure EN-Map per Status-`kind` ersetzt) plus ein dünner `requestUrl`-Probe/ModelList-Layer. Die Pane behält ihr setProps/repaint-Muster: Tab-State und Guide-Suchquery leben als nicht-persistierte Felder in `main.ts` und fließen als Props; alle neuen Logikbausteine (Tab-Fallback, nächste Mission, Welcome-Parsing, Cheatsheet-Filter, EN-Maps, Model-ID-Extraktion) sind pure, TDD-getestete Module.

**Tech Stack:** TypeScript, Preact, Obsidian API (`requestUrl`), Vitest (node-Env), vendored `obsidian-kit` + `@neurovim/core+content`.

**Spec:** `docs/superpowers/specs/2026-07-15-cipher-uplink-polish-design.md` (approved). Branch: `feat/cipher-uplink` (auf dem bestehenden Feature aufsetzen, KEIN neuer Branch).

## Global Constraints

- **CRT-Prinzip (Jay):** Im CRT-Scheme werden Textfarben **hart und element-spezifisch** gesetzt — keine Abhängigkeit von Theme-Variablen-Vererbung. Das Result-Modal braucht KEINE Härtung (rendert nur eigene `nv-result-*`-Klassen mit expliziten Farben); nur das Briefing-Modal rendert Obsidian-Markdown.
- **Store-Invariante unverändert:** UPLINK-Tab nur sichtbar, wenn `isLlmConfigured(settings)`; ohne Konfiguration verhält sich alles wie ohne Feature.
- **Vendor-Dateien verbatim:** `src/vendor/kit/*` nie hand-editieren; deutsche Kit-Texte bleiben drin — EN-Mapping lebt in vim-dojo (`endpointText.ts`), gemappt über `kind`/`rule`, nie über die deutschen Strings.
- **Alle User-sichtbaren Texte englisch** (Store-Plugin); Code-Kommentare englisch.
- **Tests:** `npx vitest run` und `npm run typecheck` nach jedem Task grün. Tests flach in `test/`. Preact wird im node-Env nicht gerendert — testbare Logik lebt in puren Modulen.
- **Kein Multi-Endpoint, kein Guide-Content-Nachzug, keine Chat-Persistenz** (Spec-Nicht-Ziele).
- **Probe-Timeout:** 5 000 ms fest (`PROBE_TIMEOUT_MS`).

---

### Task 1: CSS-Fixes — Missionstitel-Umbruch + CRT-Härtung des Briefing-Modals

**Files:**
- Modify: `styles.css` (Regel `.nv-mission .nv-mission-title`, ~Zeile 58; neuer Block nach den bestehenden `.nv-briefing`-Regeln, ~Zeile 196)

**Interfaces:**
- Consumes: bestehende CRT-Variablen `--nv-text`, `--nv-text-dim`, `--nv-accent`, `--nv-panel`.
- Produces: — (reine CSS-Änderung).

- [ ] **Step 1: Missionstitel umbrechen lassen**

Die Regel `.nv-mission .nv-mission-title { color: var(--nv-text); }` ersetzen durch:

```css
.nv-mission .nv-mission-title { color: var(--nv-text); white-space: normal; overflow-wrap: anywhere; }
```

(Das Grid `auto 1fr auto` der `.nv-mission` bleibt unverändert — die Titelspalte ist `1fr` und wächst in die Höhe.)

- [ ] **Step 2: CRT-Härtung fürs Briefing-Modal anhängen**

Direkt NACH dem bestehenden Block `.nv-briefing-modal.nv-crt .nv-briefing-body .callout { … }` (endet ~Zeile 196) einfügen:

```css
/* CRT hardening: custom themes (e.g. Minimal derivatives) style markdown/callout
   content with rules MORE SPECIFIC than our CSS-variable remap above — the remap
   alone cannot win. On a fixed-dark container text must be forced per element:
   theme-agnostic means theme-agnostic. (Sibling lesson to the mix-blend-mode fix.) */
.nv-briefing-modal.nv-crt .nv-briefing-body p,
.nv-briefing-modal.nv-crt .nv-briefing-body li,
.nv-briefing-modal.nv-crt .nv-briefing-body em,
.nv-briefing-modal.nv-crt .nv-briefing-body strong,
.nv-briefing-modal.nv-crt .nv-briefing-body blockquote,
.nv-briefing-modal.nv-crt .nv-briefing-body blockquote p,
.nv-briefing-modal.nv-crt .nv-briefing-body .callout-content,
.nv-briefing-modal.nv-crt .nv-briefing-body .callout-content p,
.nv-briefing-modal.nv-crt .nv-briefing-body .callout-content em {
  color: var(--nv-text);
}
.nv-briefing-modal.nv-crt .nv-briefing-body h1,
.nv-briefing-modal.nv-crt .nv-briefing-body h2,
.nv-briefing-modal.nv-crt .nv-briefing-body h3,
.nv-briefing-modal.nv-crt .nv-briefing-body h4,
.nv-briefing-modal.nv-crt .nv-briefing-body h5,
.nv-briefing-modal.nv-crt .nv-briefing-body h6,
.nv-briefing-modal.nv-crt .nv-briefing-body .callout-title,
.nv-briefing-modal.nv-crt .nv-briefing-body .callout-title-inner {
  color: var(--nv-accent);
}
.nv-briefing-modal.nv-crt .nv-briefing-body code {
  color: var(--nv-text);
  background: var(--nv-panel);
}
```

- [ ] **Step 3: Build-Check**

Run: `npm run build`
Expected: erfolgreich (CSS wird nicht kompiliert, aber der Build validiert das Gesamtpaket).

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "fix(ui): mission-title wrapping + CRT hardening of briefing text vs custom themes"
```

---

### Task 2: Kit `endpoint_diagnostics` vendorn

**Files:**
- Create: `src/vendor/kit/endpoint_diagnostics.ts` (Kopie von `obsidian-kit/src/pure/endpoint_diagnostics.ts`)
- Modify: `src/vendor/kit/VENDOR.json`
- Test: `test/vendorKit.test.ts` (erweitern)

**Interfaces:**
- Consumes: —
- Produces (aus dem Vendor-Modul): `type EndpointStatusKind = "ok" | "refused" | "unknown-host" | "timeout" | "not-an-llm-api" | "unknown"` · `interface EndpointStatus { reachable: boolean; kind: EndpointStatusKind; klartext: string; raw?: string }` · `type ProbeInput = { kind: "response"; status: number; body: unknown } | { kind: "error"; message: string } | { kind: "timeout" }` · `classifyEndpointStatus(input: ProbeInput): EndpointStatus` · `ENDPOINT_PRESETS: { label: string; url: string }[]` (LM Studio `http://localhost:1234`, Ollama `http://localhost:11434`) · `interface EndpointWarning { rule: string; message: string }` · `validateEndpointInput(url: string): EndpointWarning[]` (rules: `scheme`, `malformed`, `port`, `placeholder-ip`).

- [ ] **Step 1: Verbatim kopieren + VENDOR.json erweitern**

```bash
cp /Users/Shared/code/obsidian-plugins/obsidian-kit/src/pure/endpoint_diagnostics.ts src/vendor/kit/endpoint_diagnostics.ts
```

In `src/vendor/kit/VENDOR.json` das Feld `vendored` ersetzen durch:

```json
"vendored": "pure/sse.ts, pure/think-splitter.ts (als think.ts), pure/endpoint.ts, pure/endpoint_diagnostics.ts",
```

(`version`/`sha` bleiben `0.13.0`/`80abae9` — gleicher Kit-Stand.)

- [ ] **Step 2: Sanity-Tests ergänzen**

In `test/vendorKit.test.ts` Import ergänzen und ein `describe` anhängen:

```ts
import { classifyEndpointStatus, ENDPOINT_PRESETS, validateEndpointInput } from '../src/vendor/kit/endpoint_diagnostics';

describe('vendored endpoint_diagnostics', () => {
  it('classifies a model-list response as ok', () => {
    const s = classifyEndpointStatus({ kind: 'response', status: 200, body: { data: [] } });
    expect(s.reachable).toBe(true);
    expect(s.kind).toBe('ok');
  });

  it('classifies ECONNREFUSED as refused and timeout as timeout', () => {
    expect(classifyEndpointStatus({ kind: 'error', message: 'ECONNREFUSED' }).kind).toBe('refused');
    expect(classifyEndpointStatus({ kind: 'timeout' }).kind).toBe('timeout');
  });

  it('ships LM Studio and Ollama presets and warns on a missing scheme', () => {
    expect(ENDPOINT_PRESETS.map((p) => p.label)).toEqual(['LM Studio', 'Ollama']);
    expect(validateEndpointInput('localhost:1234').map((w) => w.rule)).toContain('scheme');
  });
});
```

- [ ] **Step 3: Tests laufen lassen**

Run: `npx vitest run test/vendorKit.test.ts && npm run typecheck`
Expected: 6 Tests PASS (3 alte + 3 neue), typecheck sauber.

- [ ] **Step 4: Commit**

```bash
git add src/vendor/kit/endpoint_diagnostics.ts src/vendor/kit/VENDOR.json test/vendorKit.test.ts
git commit -m "chore(vendor): vendor obsidian-kit endpoint_diagnostics @0.13.0"
```

---

### Task 3: `endpointText.ts` — pure EN-Maps für Status + Warnungen (TDD)

**Files:**
- Create: `src/llm/endpointText.ts`
- Test: `test/endpointText.test.ts`

**Interfaces:**
- Consumes: `EndpointStatusKind` aus `../vendor/kit/endpoint_diagnostics` (Task 2).
- Produces: `endpointStatusEn(kind: EndpointStatusKind, raw?: string): string` · `endpointWarningEn(rule: string): string`.

- [ ] **Step 1: Failing Tests schreiben**

`test/endpointText.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { endpointStatusEn, endpointWarningEn } from '../src/llm/endpointText';
import type { EndpointStatusKind } from '../src/vendor/kit/endpoint_diagnostics';

describe('endpointStatusEn', () => {
  it('maps every status kind to a non-empty English message', () => {
    const kinds: EndpointStatusKind[] = ['ok', 'refused', 'unknown-host', 'timeout', 'not-an-llm-api', 'unknown'];
    for (const k of kinds) {
      const msg = endpointStatusEn(k, 'boom');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toMatch(/[äöüß]|Verbindung|Zeitüberschreitung/); // no German leaking through
    }
  });

  it('includes the raw error for unknown', () => {
    expect(endpointStatusEn('unknown', 'ECONNRESET')).toContain('ECONNRESET');
  });
});

describe('endpointWarningEn', () => {
  it('maps all known rules and falls back to the rule name', () => {
    for (const rule of ['scheme', 'malformed', 'port', 'placeholder-ip']) {
      expect(endpointWarningEn(rule).length).toBeGreaterThan(0);
      expect(endpointWarningEn(rule)).not.toMatch(/[äöüß]/);
    }
    expect(endpointWarningEn('future-rule')).toBe('future-rule');
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run test/endpointText.test.ts`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implementieren**

`src/llm/endpointText.ts`:

```ts
/** English texts for the vendored (German) endpoint diagnostics: vim-dojo is an
 *  English store plugin, so we map by status kind / warning rule — never by the
 *  vendor's German strings. Keep in sync with EndpointStatusKind. */
import type { EndpointStatusKind } from '../vendor/kit/endpoint_diagnostics';

export function endpointStatusEn(kind: EndpointStatusKind, raw?: string): string {
  switch (kind) {
    case 'ok': return 'Connected.';
    case 'refused': return 'Connection refused — server not running or wrong port.';
    case 'unknown-host': return 'Unknown host — typo in the address?';
    case 'timeout': return 'Timed out — network unreachable (wrong network / VPN off?).';
    case 'not-an-llm-api': return 'Responds, but not an OpenAI-compatible endpoint — wrong path or service?';
    case 'unknown': return `Unreachable — ${raw ?? 'unknown error'}`;
  }
}

export function endpointWarningEn(rule: string): string {
  switch (rule) {
    case 'scheme': return 'Address needs http:// or https://';
    case 'malformed': return 'Not a valid URL';
    case 'port': return 'Local LLM servers almost always need a port (e.g. :1234)';
    case 'placeholder-ip': return 'Looks like an example/placeholder address';
    default: return rule;
  }
}
```

- [ ] **Step 4: Tests laufen lassen — müssen passen**

Run: `npx vitest run test/endpointText.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/llm/endpointText.ts test/endpointText.test.ts
git commit -m "feat(llm): English mapping for vendored endpoint diagnostics (kind/rule based)"
```

---

### Task 4: `modelList.ts` + `endpointProbe.ts` — Modell-Liste und Verbindungs-Probe

**Files:**
- Create: `src/llm/modelList.ts` (pure)
- Create: `src/llm/endpointProbe.ts` (Obsidian-Runtime, dünn)
- Test: `test/modelList.test.ts`

**Interfaces:**
- Consumes: `normalizeEndpoint` (`../vendor/kit/endpoint`), `classifyEndpointStatus`, `EndpointStatus`, `ProbeInput` (`../vendor/kit/endpoint_diagnostics`), Obsidians `requestUrl`.
- Produces: `extractModelIds(body: unknown): string[]` (pure) · `interface ProbeResult { status: EndpointStatus; models: string[] }` · `probeEndpoint(endpoint: string, apiKey: string): Promise<ProbeResult>` (nie throwend).

- [ ] **Step 1: Failing Tests schreiben (nur der pure Teil)**

`test/modelList.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractModelIds } from '../src/llm/modelList';

describe('extractModelIds', () => {
  it('extracts ids from an OpenAI-style model list', () => {
    const body = { data: [{ id: 'qwen3-8b' }, { id: 'llama-3.1' }] };
    expect(extractModelIds(body)).toEqual(['qwen3-8b', 'llama-3.1']);
  });

  it('skips entries without a string id', () => {
    const body = { data: [{ id: 'ok' }, { id: 42 }, 'garbage', null, {}] };
    expect(extractModelIds(body)).toEqual(['ok']);
  });

  it('returns [] for malformed bodies', () => {
    expect(extractModelIds(null)).toEqual([]);
    expect(extractModelIds({})).toEqual([]);
    expect(extractModelIds({ data: 'nope' })).toEqual([]);
    expect(extractModelIds('html error page')).toEqual([]);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run test/modelList.test.ts`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: `src/llm/modelList.ts` implementieren**

```ts
/** Pure parsing of an OpenAI-compatible GET /v1/models response body. */
export function extractModelIds(body: unknown): string[] {
  const data = (body as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((m) => (m !== null && typeof m === 'object' && typeof (m as { id?: unknown }).id === 'string'
      ? (m as { id: string }).id
      : null))
    .filter((id): id is string => id !== null);
}
```

- [ ] **Step 4: Tests laufen lassen — müssen passen**

Run: `npx vitest run test/modelList.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 5: `src/llm/endpointProbe.ts` implementieren (dünner Runtime-Teil, nicht unit-getestet — Repo-Muster wie XhrSseTransport)**

```ts
/** One-shot reachability probe + model listing against GET /v1/models via Obsidian's
 *  requestUrl (CORS-free, throw:false so error bodies classify instead of throwing).
 *  Never throws — every failure maps to a classified EndpointStatus. */
import { requestUrl } from 'obsidian';
import { normalizeEndpoint } from '../vendor/kit/endpoint';
import { classifyEndpointStatus, type EndpointStatus } from '../vendor/kit/endpoint_diagnostics';
import { extractModelIds } from './modelList';

const PROBE_TIMEOUT_MS = 5_000;

export interface ProbeResult { status: EndpointStatus; models: string[] }

export async function probeEndpoint(endpoint: string, apiKey: string): Promise<ProbeResult> {
  const url = `${normalizeEndpoint(endpoint)}/v1/models`;
  const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const timeout = new Promise<'timeout'>((res) => setTimeout(() => res('timeout'), PROBE_TIMEOUT_MS));
  try {
    const r = await Promise.race([requestUrl({ url, method: 'GET', headers, throw: false }), timeout]);
    if (r === 'timeout') return { status: classifyEndpointStatus({ kind: 'timeout' }), models: [] };
    let body: unknown = null;
    try { body = JSON.parse(r.text); } catch { body = null; }
    const status = classifyEndpointStatus({ kind: 'response', status: r.status, body });
    return { status, models: status.reachable ? extractModelIds(body) : [] };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: classifyEndpointStatus({ kind: 'error', message }), models: [] };
  }
}
```

- [ ] **Step 6: Voller Check + Commit**

Run: `npx vitest run && npm run typecheck`
Expected: alles grün.

```bash
git add src/llm/modelList.ts src/llm/endpointProbe.ts test/modelList.test.ts
git commit -m "feat(llm): model-list parsing + classified endpoint probe (requestUrl)"
```

---

### Task 5: Settings-QoL — Presets, Test-Button, Warnungen, Modell-Dropdown

**Files:**
- Modify: `src/SettingsTab.ts` (die CIPHER-Sektion ab `new Setting(containerEl).setName('CIPHER uplink (experimental)')` bis zum Ende von `display()` ersetzen)

**Interfaces:**
- Consumes: `probeEndpoint`, `ProbeResult` (Task 4) · `endpointStatusEn`, `endpointWarningEn` (Task 3) · `ENDPOINT_PRESETS`, `validateEndpointInput` (Task 2) · bestehende Settings-Felder `llmEndpoint`/`llmApiKey`/`llmModel`.
- Produces: — (reines Settings-UI; keine neuen Exporte).

- [ ] **Step 1: Imports ergänzen**

Am Kopf von `src/SettingsTab.ts`:

```ts
import { ENDPOINT_PRESETS, validateEndpointInput } from './vendor/kit/endpoint_diagnostics';
import { endpointStatusEn, endpointWarningEn } from './llm/endpointText';
import { probeEndpoint } from './llm/endpointProbe';
```

- [ ] **Step 2: Instanzfelder für Probe-Zustand ergänzen**

In der Klasse `NeuroVimSettingTab` (nach dem Konstruktor):

```ts
  /** Result of the last "Test connection" run — survives display() re-renders. */
  private probeText: string | null = null;
  private probeOk = false;
  private models: string[] = [];
```

- [ ] **Step 3: CIPHER-Sektion ersetzen**

Den gesamten Block ab `new Setting(containerEl).setName('CIPHER uplink (experimental)').setHeading();` bis zum Ende von `display()` ersetzen durch:

```ts
    new Setting(containerEl).setName('CIPHER uplink (experimental)').setHeading();
    containerEl.createEl('p', {
      text:
        'Ask CIPHER for Vim advice via any OpenAI-compatible endpoint (LM Studio, Ollama, ' +
        'OpenRouter, …). Privacy: your questions plus the active mission\'s metadata ' +
        '(title, category, goal) are sent to the endpoint you configure — never any ' +
        'other vault content. Leave endpoint or model empty to disable the feature.',
      cls: 'setting-item-description',
    });

    let warningsEl: HTMLElement;
    const renderWarnings = (): void => {
      warningsEl.empty();
      for (const w of validateEndpointInput(this.plugin.settings.llmEndpoint)) {
        warningsEl.createEl('div', { text: `⚠ ${endpointWarningEn(w.rule)}`, cls: 'nv-setting-warning' });
      }
    };

    const endpointSetting = new Setting(containerEl)
      .setName('LLM endpoint')
      .setDesc('Base URL, e.g. http://localhost:1234 — a trailing /v1 is handled either way.')
      .addText((t) =>
        t.setPlaceholder('http://localhost:1234')
          .setValue(this.plugin.settings.llmEndpoint)
          .onChange(async (v) => {
            this.plugin.settings.llmEndpoint = v.trim();
            renderWarnings();
            await this.plugin.saveSettings();
          }),
      );
    ENDPOINT_PRESETS.forEach((preset) => {
      endpointSetting.addButton((b) =>
        b.setButtonText(preset.label)
          .setTooltip(`Use ${preset.url}`)
          .onClick(async () => {
            this.plugin.settings.llmEndpoint = preset.url;
            await this.plugin.saveSettings();
            this.display();
          }),
      );
    });
    warningsEl = containerEl.createEl('div', { cls: 'nv-setting-warnings' });
    renderWarnings();

    new Setting(containerEl)
      .setName('Connection')
      .setDesc('Check the endpoint and load its model list.')
      .addButton((b) =>
        b.setButtonText('Test connection').onClick(async () => {
          b.setButtonText('Testing…');
          b.setDisabled(true);
          const r = await probeEndpoint(this.plugin.settings.llmEndpoint, this.plugin.settings.llmApiKey);
          this.probeOk = r.status.reachable;
          this.probeText = endpointStatusEn(r.status.kind, r.status.raw)
            + (r.models.length ? ` ${r.models.length} models found.` : '');
          this.models = r.models;
          this.display();
        }),
      );
    if (this.probeText !== null) {
      containerEl.createEl('div', {
        text: `${this.probeOk ? '✓' : '✗'} ${this.probeText}`,
        cls: `nv-setting-probe ${this.probeOk ? 'is-ok' : 'is-bad'}`,
      });
    }

    const modelSetting = new Setting(containerEl).setName('Model');
    if (this.models.length > 0) {
      modelSetting
        .setDesc('Pick one of the models the endpoint reports.')
        .addDropdown((d) => {
          const current = this.plugin.settings.llmModel;
          if (current && !this.models.includes(current)) d.addOption(current, `${current} (saved)`);
          for (const id of this.models) d.addOption(id, id);
          d.setValue(current || this.models[0]);
          // A dropdown has no empty state: adopt the shown value so the visible
          // selection and the saved setting can't drift apart.
          if (!current) {
            this.plugin.settings.llmModel = this.models[0];
            void this.plugin.saveSettings();
          }
          d.onChange(async (v) => {
            this.plugin.settings.llmModel = v;
            await this.plugin.saveSettings();
          });
        });
    } else {
      modelSetting
        .setDesc('Model id to request from the endpoint, e.g. qwen3-8b — or run "Test connection" to pick from a list.')
        .addText((t) =>
          t.setPlaceholder('qwen3-8b')
            .setValue(this.plugin.settings.llmModel)
            .onChange(async (v) => {
              this.plugin.settings.llmModel = v.trim();
              await this.plugin.saveSettings();
            }),
        );
    }

    new Setting(containerEl)
      .setName('API key (optional)')
      .setDesc('Bearer token for endpoints that need one. Local servers usually don\'t.')
      .addText((t) => {
        t.inputEl.type = 'password';
        t.setValue(this.plugin.settings.llmApiKey)
          .onChange(async (v) => {
            this.plugin.settings.llmApiKey = v.trim();
            await this.plugin.saveSettings();
          });
      });
```

- [ ] **Step 4: Settings-Hilfsklassen stylen**

Ans Ende von `styles.css`:

```css
/* ── Settings: CIPHER uplink diagnostics ─────────────────────── */
.nv-setting-warnings { margin: 0 0 0.75em; }
.nv-setting-warning { color: var(--text-warning, #b58900); font-size: 0.85em; }
.nv-setting-probe { margin: 0 0 0.75em; font-size: 0.9em; }
.nv-setting-probe.is-ok { color: var(--text-success, #2e7d32); }
.nv-setting-probe.is-bad { color: var(--text-error, #c62828); }
```

- [ ] **Step 5: Voller Check + Commit**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: alles grün.

```bash
git add src/SettingsTab.ts styles.css
git commit -m "feat(settings): endpoint presets, test-connection diagnostics, model dropdown"
```

---

### Task 6: Pure Hub-Helpers — `hubTabs`, `nextMission`, `welcomeBlocks`, `filterCheatsheet` (TDD)

**Files:**
- Create: `src/hubTabs.ts`, `src/nextMission.ts`, `src/welcomeBlocks.ts`, `src/filterCheatsheet.ts`
- Test: `test/hubTabs.test.ts`, `test/nextMission.test.ts`, `test/welcomeBlocks.test.ts`, `test/filterCheatsheet.test.ts`

**Interfaces:**
- Consumes: `MissionSummary`, `PluginData`, `CheatsheetCategory` aus `@neurovim/core`.
- Produces:
  - `type HubTab = 'nexus' | 'missions' | 'guide' | 'uplink'` · `effectiveTab(active: HubTab, uplinkVisible: boolean): HubTab`
  - `nextMission(missions: MissionSummary[], data: PluginData): MissionSummary | null`
  - `type WelcomeBlock = { kind: 'quote'; lines: string[] } | { kind: 'para'; text: string }` · `parseWelcomeBlocks(md: string): WelcomeBlock[]`
  - `filterCheatsheet(cats: CheatsheetCategory[], query: string): CheatsheetCategory[]`

- [ ] **Step 1: Failing Tests schreiben**

`test/hubTabs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { effectiveTab } from '../src/hubTabs';

describe('effectiveTab', () => {
  it('keeps the active tab when it is available', () => {
    expect(effectiveTab('guide', false)).toBe('guide');
    expect(effectiveTab('uplink', true)).toBe('uplink');
  });
  it('falls back to nexus when uplink is selected but not visible', () => {
    expect(effectiveTab('uplink', false)).toBe('nexus');
  });
});
```

`test/nextMission.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { nextMission } from '../src/nextMission';
import type { MissionSummary, PluginData } from '@neurovim/core';

const m = (id: string): MissionSummary => ({
  mission_id: id, mission_type: 'practice', title: id, category: 'c',
  xp_reward: 10, locked: false, tier: '',
} as MissionSummary);

const data = (unlocked: string[], completed: string[]): PluginData =>
  ({ unlocked, completed_missions: completed, total_xp: 0 } as unknown as PluginData);

describe('nextMission', () => {
  it('returns the first unlocked, not-yet-completed mission in list order', () => {
    const missions = [m('M-01'), m('M-02'), m('M-03')];
    expect(nextMission(missions, data(['M-01', 'M-02', 'M-03'], ['M-01']))?.mission_id).toBe('M-02');
  });
  it('skips locked missions', () => {
    const missions = [m('M-01'), m('M-02')];
    expect(nextMission(missions, data(['M-02'], []))?.mission_id).toBe('M-02');
  });
  it('returns null when everything unlocked is completed', () => {
    expect(nextMission([m('M-01')], data(['M-01'], ['M-01']))).toBeNull();
  });
});
```

`test/welcomeBlocks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseWelcomeBlocks } from '../src/welcomeBlocks';
import { getWelcome } from '@neurovim/content';

describe('parseWelcomeBlocks', () => {
  it('drops headings, groups quote lines, keeps paragraphs', () => {
    const md = '# TITLE\n\n> [!quote] CIPHER\n> Line one.\n> **Bold line.**\n\nPara text\nover two lines.';
    expect(parseWelcomeBlocks(md)).toEqual([
      { kind: 'quote', lines: ['Line one.', 'Bold line.'] },
      { kind: 'para', text: 'Para text over two lines.' },
    ]);
  });
  it('parses the real bundled welcome into a quote and at least one paragraph', () => {
    const blocks = parseWelcomeBlocks(getWelcome());
    expect(blocks[0].kind).toBe('quote');
    expect(blocks.some((b) => b.kind === 'para')).toBe(true);
  });
});
```

`test/filterCheatsheet.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterCheatsheet } from '../src/filterCheatsheet';
import type { CheatsheetCategory } from '@neurovim/core';

const CATS: CheatsheetCategory[] = [
  {
    id: 'fundamentals', label: 'FUNDAMENTALS',
    groups: [
      { label: 'MODES', keys: [{ key: 'i', description: 'insert before cursor' }, { key: 'ESC', description: 'back to normal' }] },
    ],
  },
  {
    id: 'navigation', label: 'NAVIGATION',
    groups: [{ label: 'MOTIONS', keys: [{ key: 'w', description: 'next word' }] }],
  },
];

describe('filterCheatsheet', () => {
  it('returns everything for an empty/whitespace query', () => {
    expect(filterCheatsheet(CATS, '')).toEqual(CATS);
    expect(filterCheatsheet(CATS, '   ')).toEqual(CATS);
  });
  it('matches on key and description, case-insensitively', () => {
    const byKey = filterCheatsheet(CATS, 'ESC');
    expect(byKey[0].groups[0].keys).toEqual([{ key: 'ESC', description: 'back to normal' }]);
    const byDesc = filterCheatsheet(CATS, 'WORD');
    expect(byDesc).toHaveLength(1);
    expect(byDesc[0].id).toBe('navigation');
  });
  it('drops empty groups and categories', () => {
    const r = filterCheatsheet(CATS, 'insert');
    expect(r).toHaveLength(1);
    expect(r[0].groups).toHaveLength(1);
    expect(r[0].groups[0].keys).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run test/hubTabs.test.ts test/nextMission.test.ts test/welcomeBlocks.test.ts test/filterCheatsheet.test.ts`
Expected: FAIL — Module existieren nicht.

- [ ] **Step 3: Implementieren**

`src/hubTabs.ts`:

```ts
/** Hub pane tabs. State lives in main.ts (not persisted) and flows in as a prop. */
export type HubTab = 'nexus' | 'missions' | 'guide' | 'uplink';

/** The uplink tab disappears when the LLM is unconfigured — fall back to home. */
export function effectiveTab(active: HubTab, uplinkVisible: boolean): HubTab {
  return active === 'uplink' && !uplinkVisible ? 'nexus' : active;
}
```

`src/nextMission.ts`:

```ts
import type { MissionSummary, PluginData } from '@neurovim/core';

/** First unlocked mission the player hasn't completed yet, in list order. */
export function nextMission(missions: MissionSummary[], data: PluginData): MissionSummary | null {
  return missions.find(
    (m) => data.unlocked.includes(m.mission_id) && !data.completed_missions.includes(m.mission_id),
  ) ?? null;
}
```

`src/welcomeBlocks.ts`:

```ts
/** Minimal, dependency-free parsing of the bundled welcome markdown into render
 *  blocks. Deliberately NOT MarkdownRenderer: the pane's CRT scheme wants full
 *  color control, and the welcome only uses headings, one quote callout, and
 *  paragraphs. Headings drop (the pane has its own title), `> [!…]`-type lines
 *  drop, `**` bold markers are stripped. */
export type WelcomeBlock = { kind: 'quote'; lines: string[] } | { kind: 'para'; text: string };

export function parseWelcomeBlocks(md: string): WelcomeBlock[] {
  const blocks: WelcomeBlock[] = [];
  for (const chunk of md.split(/\n\s*\n/)) {
    const trimmed = chunk.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('>')) {
      const lines = trimmed
        .split('\n')
        .map((l) => l.replace(/^>\s?/, '').trim())
        .filter((l) => l !== '' && !l.startsWith('[!'))
        .map((l) => l.replace(/\*\*/g, ''));
      if (lines.length) blocks.push({ kind: 'quote', lines });
    } else {
      blocks.push({ kind: 'para', text: trimmed.split('\n').map((l) => l.trim()).join(' ').replace(/\*\*/g, '') });
    }
  }
  return blocks;
}
```

`src/filterCheatsheet.ts`:

```ts
import type { CheatsheetCategory } from '@neurovim/core';

/** Case-insensitive live filter over key + description; empty groups/categories drop. */
export function filterCheatsheet(cats: CheatsheetCategory[], query: string): CheatsheetCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return cats;
  return cats
    .map((cat) => ({
      ...cat,
      groups: cat.groups
        .map((g) => ({ ...g, keys: g.keys.filter((k) => k.key.toLowerCase().includes(q) || k.description.toLowerCase().includes(q)) }))
        .filter((g) => g.keys.length > 0),
    }))
    .filter((cat) => cat.groups.length > 0);
}
```

- [ ] **Step 4: Tests laufen lassen — müssen passen**

Run: `npx vitest run test/hubTabs.test.ts test/nextMission.test.ts test/welcomeBlocks.test.ts test/filterCheatsheet.test.ts && npm run typecheck`
Expected: PASS (11 Tests), typecheck sauber.

- [ ] **Step 5: Commit**

```bash
git add src/hubTabs.ts src/nextMission.ts src/welcomeBlocks.ts src/filterCheatsheet.ts test/hubTabs.test.ts test/nextMission.test.ts test/welcomeBlocks.test.ts test/filterCheatsheet.test.ts
git commit -m "feat(hub): pure helpers — tab fallback, next mission, welcome parsing, cheatsheet filter"
```

---

### Task 7: HubView-Tabs + main.ts-Verdrahtung

**Files:**
- Modify: `src/HubView.tsx` (Nexus-Funktion wird zu einer Tab-Ansicht; neue Sub-Komponenten in derselben Datei)
- Modify: `src/main.ts` (Felder `hubTab`/`guideQuery`, Props-Erweiterung im `view.setProps`-Aufruf, HUD-`onCipher` springt auf den UPLINK-Tab)

**Interfaces:**
- Consumes: `HubTab`, `effectiveTab` (Task 6) · `nextMission` · `parseWelcomeBlocks` · `filterCheatsheet` · `getWelcome` aus `@neurovim/content` · `CHEATSHEET` aus `@neurovim/core` · bestehende `HubProps`-Felder.
- Produces: `HubProps` erweitert um `activeTab: HubTab; onSelectTab: (t: HubTab) => void; guideQuery: string; onGuideQuery: (q: string) => void`.

- [ ] **Step 1: `src/HubView.tsx` umbauen**

Datei komplett ersetzen durch:

```tsx
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { render, h, Fragment } from 'preact';
import { ProgressionEngine, CHEATSHEET } from '@neurovim/core';
import type { MissionSummary, PluginData } from '@neurovim/core';
import { getWelcome } from '@neurovim/content';
import { MissionHud } from './MissionHud';
import type { HudRenderProps } from './HudMount';
import type { ColorScheme } from './settings';
import { CipherChat, type CipherChatProps } from './CipherChat';
import { effectiveTab, type HubTab } from './hubTabs';
import { nextMission } from './nextMission';
import { parseWelcomeBlocks } from './welcomeBlocks';
import { filterCheatsheet } from './filterCheatsheet';

export const VIEW_TYPE_NEUROVIM = 'neurovim-hub';

export interface HubProps {
  missions: MissionSummary[];
  data: PluginData;
  onStart: (id: string) => void;
  /** When set, the mission-control block is shown at the top of the pane. */
  control: HudRenderProps | null;
  /** When set, the UPLINK // CIPHER chat tab is available. */
  cipher: CipherChatProps | null;
  activeTab: HubTab;
  onSelectTab: (t: HubTab) => void;
  guideQuery: string;
  onGuideQuery: (q: string) => void;
  scheme: ColorScheme;
}

const WELCOME_BLOCKS = parseWelcomeBlocks(getWelcome());

function TabBar(p: { active: HubTab; uplinkVisible: boolean; onSelect: (t: HubTab) => void }) {
  const tabs: { id: HubTab; label: string }[] = [
    { id: 'nexus', label: 'NEXUS' },
    { id: 'missions', label: 'MISSIONS' },
    { id: 'guide', label: 'GUIDE' },
    ...(p.uplinkVisible ? [{ id: 'uplink' as HubTab, label: 'UPLINK' }] : []),
  ];
  return (
    <div class="nv-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          class={`nv-tab ${p.active === t.id ? 'is-active' : ''}`}
          role="tab"
          aria-selected={p.active === t.id}
          onClick={() => p.onSelect(t.id)}
        >{t.label}</button>
      ))}
    </div>
  );
}

function NexusTab(p: HubProps) {
  const prog = ProgressionEngine.getXpProgress(p.data.total_xp);
  const next = nextMission(p.missions, p.data);
  return (
    <div class="nv-nexus-home">
      <div class="nv-level">LVL {prog.level} · {p.data.total_xp} XP</div>
      {WELCOME_BLOCKS.map((b) =>
        b.kind === 'quote'
          ? <div class="nv-welcome-quote">{b.lines.map((l) => <div>{l}</div>)}</div>
          : <p class="nv-welcome-para">{b.text}</p>,
      )}
      {next && (
        <button class="nv-btn nv-btn-submit nv-next-mission" onClick={() => p.onStart(next.mission_id)}>
          ▶ NEXT MISSION: {next.mission_id} — {next.title}
        </button>
      )}
    </div>
  );
}

function MissionsTab(p: HubProps) {
  return (
    <div class="nv-mission-list">
      {p.missions.map((m) => {
        const unlocked = p.data.unlocked.includes(m.mission_id);
        const done = p.data.completed_missions.includes(m.mission_id);
        return (
          <button
            class={`nv-mission ${unlocked ? '' : 'is-locked'} ${done ? 'is-done' : ''}`}
            disabled={!unlocked}
            onClick={() => unlocked && p.onStart(m.mission_id)}
          >
            <span class="nv-mission-id">{m.mission_id}</span>
            <span class="nv-mission-title">{m.title}</span>
            <span class="nv-mission-xp">{done ? '✓' : `+${m.xp_reward}`}</span>
          </button>
        );
      })}
    </div>
  );
}

function GuideTab(p: { query: string; onQuery: (q: string) => void }) {
  const cats = filterCheatsheet(CHEATSHEET, p.query);
  return (
    <div class="nv-guide">
      {/* Controlled on purpose (unlike CipherChat's draft): the query state lives in
          main.ts so the filter survives tab switches, and the onInput→repaint
          round-trip is synchronous, so typing never fights the 500ms tick. */}
      <input
        class="nv-guide-search"
        type="search"
        placeholder="search keys… (e.g. delete, ciw, :%s)"
        value={p.query}
        onInput={(e) => p.onQuery((e.currentTarget as HTMLInputElement).value)}
      />
      {cats.length === 0 && <div class="nv-guide-empty">No matches. CORP scrubbed that page.</div>}
      {cats.map((cat) => (
        <div class="nv-guide-cat">
          <h3 class="nv-guide-cat-title">{cat.label}</h3>
          {cat.groups.map((g) => (
            <Fragment>
              <div class="nv-guide-group">{g.label}</div>
              {g.keys.map((k) => (
                <div class="nv-guide-row">
                  <span class="nv-guide-key">{k.key}</span>
                  <span class="nv-guide-desc">{k.description}</span>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

function Hub(p: HubProps) {
  const tab = effectiveTab(p.activeTab, p.cipher !== null);
  return (
    <div class="nv-nexus">
      {p.control && <MissionHud {...p.control} />}
      <h2 class="nv-title">NEXUS</h2>
      <TabBar active={tab} uplinkVisible={p.cipher !== null} onSelect={p.onSelectTab} />
      {tab === 'nexus' && <NexusTab {...p} />}
      {tab === 'missions' && <MissionsTab {...p} />}
      {tab === 'guide' && <GuideTab key="guide" query={p.guideQuery} onQuery={p.onGuideQuery} />}
      {tab === 'uplink' && p.cipher && <CipherChat key="cipher-chat" {...p.cipher} />}
    </div>
  );
}

export class HubView extends ItemView {
  private props: HubProps | null = null;

  constructor(leaf: WorkspaceLeaf) { super(leaf); }
  getViewType(): string { return VIEW_TYPE_NEUROVIM; }
  getDisplayText(): string { return 'NeuroVim'; }
  getIcon(): string { return 'terminal'; }

  async onOpen(): Promise<void> { this.paint(); }
  async onClose(): Promise<void> { render(null, this.contentEl); }

  setProps(props: HubProps): void {
    this.props = props;
    this.paint();
  }

  private paint(): void {
    if (!this.props) return;
    render(h('div', { class: `nv-root nv-${this.props.scheme}` }, h(Hub, this.props)), this.contentEl);
  }
}
```

- [ ] **Step 2: `src/main.ts` verdrahten**

Import ergänzen:

```ts
import type { HubTab } from './hubTabs';
```

Felder ergänzen (nach `private cipherKnowledge: CipherKnowledge | null = null;`):

```ts
  /** Active hub tab + guide search query — session-local UI state, not persisted. */
  private hubTab: HubTab = 'nexus';
  private guideQuery = '';
```

Im `control`-Objekt in `repaint()` den `onCipher`-Handler ersetzen durch (springt zusätzlich auf den UPLINK-Tab):

```ts
          onCipher: isLlmConfigured(this.settings)
            ? () => { this.hubTab = 'uplink'; void this.activateView(); }
            : undefined,
```

Im `view.setProps({...})`-Aufruf nach `cipher: …` und vor `scheme: …` ergänzen:

```ts
        activeTab: this.hubTab,
        onSelectTab: (t) => { this.hubTab = t; this.repaint(); },
        guideQuery: this.guideQuery,
        onGuideQuery: (q) => { this.guideQuery = q; this.repaint(); },
```

- [ ] **Step 3: Voller Check**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck sauber, alle Tests grün (die HubProps-Pflichtfelder werden im selben Task verdrahtet — kein Übergangs-Placeholder nötig).

- [ ] **Step 4: Commit**

```bash
git add src/HubView.tsx src/main.ts
git commit -m "feat(hub): tab navigation — NEXUS home (welcome + next mission), searchable GUIDE, UPLINK tab"
```

---

### Task 8: Styling, README, REGISTRY-Seeding, Build

**Files:**
- Modify: `styles.css` (Tabs/Nexus/Guide-Block anhängen)
- Modify: `README.md` (Feature-Beschreibung Pane/Tabs/Guide ergänzen)
- Modify: `/Users/Shared/code/obsidian-plugins/REGISTRY.md` (Kit-Kandidaten seeden — anderes Repo, separater Commit dort!)

**Interfaces:**
- Consumes: CSS-Klassen aus Task 7 (`nv-tabs`, `nv-tab`, `nv-nexus-home`, `nv-welcome-quote`, `nv-welcome-para`, `nv-next-mission`, `nv-guide*`).
- Produces: fertiges, deploybares Paket.

- [ ] **Step 1: Styles anhängen**

Ans Ende von `styles.css` (Farbwerte über die bestehenden `--nv-*`-Tokens — CRT-Prinzip: alles über die Scheme-Variablen, nichts erbt vom Theme):

```css
/* ── Hub tabs ─────────────────────────────────────────────────── */
.nv-tabs { display: flex; gap: 4px; margin: 0.5em 0 1em; border-bottom: 1px solid var(--nv-border-soft); }
.nv-tab {
  background: transparent; border: none; border-bottom: 2px solid transparent;
  color: var(--nv-text-dim); font-family: inherit; font-size: 0.8em; letter-spacing: 0.12em;
  padding: 4px 8px; cursor: pointer; box-shadow: none;
}
.nv-tab:hover { color: var(--nv-text); }
.nv-tab.is-active { color: var(--nv-accent); border-bottom-color: var(--nv-accent); }

/* ── NEXUS home ──────────────────────────────────────────────── */
.nv-nexus-home { display: flex; flex-direction: column; gap: 0.9em; }
.nv-welcome-quote {
  border-left: 2px solid var(--nv-accent); padding: 0.4em 0.8em;
  color: var(--nv-text); font-style: italic; background: var(--nv-panel);
}
.nv-welcome-para { color: var(--nv-text); margin: 0; }
.nv-next-mission { text-align: left; }

/* ── GUIDE (searchable cheatsheet) ───────────────────────────── */
.nv-guide { display: flex; flex-direction: column; gap: 0.5em; }
.nv-guide-search {
  background: transparent; border: 1px solid var(--nv-border-soft); color: var(--nv-text);
  font-family: inherit; padding: 0.35em 0.6em; width: 100%;
}
.nv-guide-search:focus { border-color: var(--nv-accent); outline: none; }
.nv-guide-empty { color: var(--nv-text-dim); font-style: italic; }
.nv-guide-cat-title { color: var(--nv-accent); letter-spacing: 0.1em; font-size: 0.9em; margin: 0.8em 0 0.2em; }
.nv-guide-group { color: var(--nv-text-dim); font-size: 0.75em; letter-spacing: 0.12em; margin-top: 0.4em; }
.nv-guide-row { display: grid; grid-template-columns: minmax(72px, auto) 1fr; gap: 10px; align-items: baseline; }
.nv-guide-key {
  color: var(--nv-accent); font-weight: 600; background: var(--nv-panel);
  border: 1px solid var(--nv-border-soft); border-radius: 4px; padding: 0 6px;
  justify-self: start; white-space: nowrap;
}
.nv-guide-desc { color: var(--nv-text); }
```

- [ ] **Step 2: README ergänzen**

Im Feature-Bereich der `README.md` (nach dem bestehenden „CIPHER uplink"-Abschnitt) ergänzen:

```markdown
## Hub pane

The NeuroVim pane is organized in tabs:

- **NEXUS** — your status (level/XP), the welcome transmission, and a one-click
  "next mission" button.
- **MISSIONS** — the full mission list.
- **GUIDE** — a searchable Vim cheatsheet (filter by key or description).
- **UPLINK** — the CIPHER chat (appears once an endpoint is configured).
```

- [ ] **Step 3: Kit-Kandidaten in REGISTRY.md seeden (Repo `obsidian-plugins`, außerhalb von vim-dojo)**

`/Users/Shared/code/obsidian-plugins/REGISTRY.md` lesen, das bestehende Zeilenformat der Rubrik `[Streaming / SSE / LLM]` übernehmen und ZWEI Einträge ergänzen (Wortlaut ans Format der Nachbarzeilen anpassen):

1. `[Streaming / SSE / LLM] Model-Liste von OpenAI-kompatiblem Endpoint parsen (GET /v1/models → ids) → vim-dojo/src/llm/modelList.ts → extractModelIds (Kit-Kandidat — 3. Implementierung neben vault-crews model-info.ts/listModels und vault-rag; Kit-Nachzug + Repo-Sweep fällig)`
2. `[Settings / UI] Endpoint-Settings-QoL-Pattern: Test-Button (probe → classifyEndpointStatus → Klartext), Presets, Modell-Dropdown mit Freitext-Fallback → vim-dojo/src/SettingsTab.ts + vault-rag/src/settings.ts → (Kit-Kandidat — UI-Pattern existiert 2×, pure-Anteile schon im Kit (endpoint_diagnostics); Sweep über vault-crews/vault-rag/vim-dojo empfohlen)`

Diesen Edit im Repo `obsidian-plugins` committen (das ist ein eigenes Git-Repo auf Root-Ebene — vorher mit `git -C /Users/Shared/code/obsidian-plugins status` prüfen, ob REGISTRY.md dort versioniert ist; wenn das Root kein eigenes Repo ist, den Edit unversioniert lassen und im Report vermerken):

```bash
git -C /Users/Shared/code/obsidian-plugins add REGISTRY.md && git -C /Users/Shared/code/obsidian-plugins commit -m "docs(registry): seed kit candidates — listModels parsing + endpoint-settings QoL pattern (vim-dojo)"
```

- [ ] **Step 4: Voller Durchlauf**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: alle Tests PASS, typecheck sauber, `main.js` gebaut.

- [ ] **Step 5: Commit (vim-dojo)**

```bash
git add styles.css README.md
git commit -m "feat(ui): hub tab styling (tabs, nexus home, guide) + README pane section"
```

Deploy (Controller, nach Abschluss): `cp main.js manifest.json styles.css "/Users/Shared/10_ObsidianVaults/10_Pallas/.obsidian/plugins/neurovim/"` — dann Jays Smoke-Test: Kuro-Theme + Standard-Light (Briefing lesbar?), Titel-Umbruch, Tabs (Start = NEXUS, Guide-Suche, UPLINK nur mit Endpoint, HUD-CIPHER-Button springt auf UPLINK), Settings (Presets, Test gegen laufendes + gestopptes LM Studio, Modell-Dropdown).
