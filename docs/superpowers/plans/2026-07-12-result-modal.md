# Result-Modal (Block A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nach erfolgreichem Mission-Submit statt einer `Notice` ein Result-Modal mit Zeit/Keystrokes/KS·MIN (je Delta + NEW BEST) und XP anzeigen.

**Architecture:** Reine View-Model-Berechnung (`buildResultView`) getrennt von der Obsidian-/Preact-Präsentation (`ResultModal`). `main.ts` ersetzt nur die Erfolgs-`Notice` durchs Modal; die bestehende Aufräum-Logik (`clearHighlight`/`session.end`/`restoreVim`) läuft davor.

**Tech Stack:** TypeScript · Preact (`render`/`h`, JSX automatic) · Obsidian `Modal` · Vitest · esbuild.

## Global Constraints

- **Portierung, nicht Copy-Paste**: Monorepo-`ResultModal.tsx` ist React — hier Preact neu gebaut.
- **RunResult trägt alle Daten** — kein Engine-/Storage-Umbau.
- **Delta-Konvention**: `▲` = Verbesserung / `▼` = Verschlechterung (hoch = besser); Roh-Delta `0` → neutral `—`.
- **Button-Farbe mit Kontext-Spezifität**: CSS unter `.nv-result .nv-btn { … }` (sonst überschreibt Obsidian; aktive LESSON 2026-07-12).
- **Scheme-Vars**: Modal-Root braucht Klasse `nv-${scheme}` (`nv-crt`/`nv-native`), damit `--nv-*` greifen.
- **Tests** liegen in `test/`, Namensschema `*.test.ts`; `test` = `vitest run`, `typecheck` = `tsc --noEmit`, `build` = `node esbuild.config.mjs production`.

---

### Task 1: Pures View-Model `buildResultView` (TDD)

**Files:**
- Create: `src/result/resultView.ts`
- Test: `test/resultView.test.ts`

**Interfaces:**
- Consumes: `RunResult` aus `@neurovim/core` (`mission_id`, `elapsed_ms`, `keystrokes`, `ks_per_min`, `xp_earned`, `is_new_best_time`, `is_new_best_ks`, `delta_time_ms`, `delta_keystrokes`, `delta_ks_per_min`).
- Produces:
  - `formatDuration(ms: number): string`
  - `buildResultView(r: RunResult): ResultView`
  - `interface ResultView { title: string; rows: MetricRow[]; xp: number }`
  - `interface MetricRow { label: string; value: string; delta: DeltaView | null; newBest: boolean }`
  - `interface DeltaView { arrow: '▲' | '▼'; magnitude: string; good: boolean }`

- [ ] **Step 1: Write the failing test**

Create `test/resultView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildResultView, formatDuration } from '../src/result/resultView';
import type { RunResult } from '@neurovim/core';

function makeResult(over: Partial<RunResult> = {}): RunResult {
  return {
    mission_id: 'M-01',
    elapsed_ms: 700,
    keystrokes: 2,
    ks_per_min: 171,
    xp_earned: 15,
    is_new_best_time: false,
    is_new_best_ks: false,
    delta_time_ms: 0,
    delta_keystrokes: 0,
    delta_ks_per_min: 0,
    ...over,
  };
}

describe('formatDuration', () => {
  it('formats sub-minute as one-decimal seconds', () => {
    expect(formatDuration(700)).toBe('0.7s');
    expect(formatDuration(12400)).toBe('12.4s');
  });
  it('formats >= 1 minute as M:SS', () => {
    expect(formatDuration(65000)).toBe('1:05');
  });
});

describe('buildResultView', () => {
  it('first clear: NEW BEST on time+ks, no deltas, no KS/MIN badge', () => {
    const v = buildResultView(makeResult({ is_new_best_time: true, is_new_best_ks: true }));
    expect(v.title).toBe('M-01');
    expect(v.xp).toBe(15);
    const [time, ks, kspm] = v.rows;
    expect(time.label).toBe('TIME');
    expect(time.value).toBe('0.7s');
    expect(time.delta).toBeNull();
    expect(time.newBest).toBe(true);
    expect(ks.newBest).toBe(true);
    expect(ks.delta).toBeNull();
    expect(kspm.label).toBe('KS/MIN');
    expect(kspm.value).toBe('171');
    expect(kspm.newBest).toBe(false);
  });

  it('improvement: all up-arrows, good, badges where new best', () => {
    const v = buildResultView(makeResult({
      is_new_best_time: true, is_new_best_ks: true,
      delta_time_ms: -3000, delta_keystrokes: -2, delta_ks_per_min: 12.4,
    }));
    const [time, ks, kspm] = v.rows;
    expect(time.delta).toEqual({ arrow: '▲', magnitude: '3.0s', good: true });
    expect(ks.delta).toEqual({ arrow: '▲', magnitude: '2', good: true });
    expect(kspm.delta).toEqual({ arrow: '▲', magnitude: '12.4', good: true });
  });

  it('regression: all down-arrows, bad, no badges', () => {
    const v = buildResultView(makeResult({
      delta_time_ms: 2000, delta_keystrokes: 3, delta_ks_per_min: -5.2,
    }));
    const [time, ks, kspm] = v.rows;
    expect(time.delta).toEqual({ arrow: '▼', magnitude: '2.0s', good: false });
    expect(ks.delta).toEqual({ arrow: '▼', magnitude: '3', good: false });
    expect(kspm.delta).toEqual({ arrow: '▼', magnitude: '5.2', good: false });
    expect(time.newBest).toBe(false);
    expect(ks.newBest).toBe(false);
  });

  it('tie: zero deltas render neutral (null), no badges', () => {
    const v = buildResultView(makeResult());
    for (const row of v.rows) {
      expect(row.delta).toBeNull();
      expect(row.newBest).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/resultView.test.ts`
Expected: FAIL — `Cannot find module '../src/result/resultView'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/result/resultView.ts`:

```ts
import type { RunResult } from '@neurovim/core';

export interface DeltaView {
  arrow: '▲' | '▼';
  magnitude: string;
  good: boolean;
}

export interface MetricRow {
  label: string;
  value: string;
  delta: DeltaView | null;
  newBest: boolean;
}

export interface ResultView {
  title: string;
  rows: MetricRow[];
  xp: number;
}

/** Sub-minute → "0.7s" (one decimal); >= 1 min → "M:SS". */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function delta(raw: number, betterWhenNegative: boolean, magnitude: string): DeltaView | null {
  if (raw === 0) return null;
  const good = betterWhenNegative ? raw < 0 : raw > 0;
  return { arrow: good ? '▲' : '▼', magnitude, good };
}

export function buildResultView(r: RunResult): ResultView {
  return {
    title: r.mission_id,
    xp: r.xp_earned,
    rows: [
      {
        label: 'TIME',
        value: formatDuration(r.elapsed_ms),
        delta: delta(r.delta_time_ms, true, `${(Math.abs(r.delta_time_ms) / 1000).toFixed(1)}s`),
        newBest: r.is_new_best_time,
      },
      {
        label: 'KEYSTROKES',
        value: String(r.keystrokes),
        delta: delta(r.delta_keystrokes, true, String(Math.abs(r.delta_keystrokes))),
        newBest: r.is_new_best_ks,
      },
      {
        label: 'KS/MIN',
        value: String(Math.round(r.ks_per_min)),
        delta: delta(r.delta_ks_per_min, false, Math.abs(r.delta_ks_per_min).toFixed(1)),
        newBest: false,
      },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/resultView.test.ts`
Expected: PASS (4 + 2 assertions groups green).

- [ ] **Step 5: Commit**

```bash
git add src/result/resultView.ts test/resultView.test.ts
git commit -m "feat(result): pure buildResultView view-model + formatDuration (TDD)"
```

---

### Task 2: `ResultModal` (Preact + Obsidian Modal) + CSS

**Files:**
- Create: `src/result/ResultModal.tsx`
- Modify: `styles.css` (append `.nv-result*` block after the diff-line rule at line 102)

**Interfaces:**
- Consumes: `ResultView`, `MetricRow` aus `./resultView`; `ColorScheme` aus `../settings`; Obsidian `App`/`Modal`; Preact `render`/`h`.
- Produces: `class ResultModal extends Modal` mit Konstruktor `(app: App, view: ResultView, scheme: ColorScheme)` und Methode `.open()` (von `Modal` geerbt).

- [ ] **Step 1: Create the modal component**

Create `src/result/ResultModal.tsx`:

```tsx
import { App, Modal } from 'obsidian';
import { h, render } from 'preact';
import type { ResultView, MetricRow } from './resultView';
import type { ColorScheme } from '../settings';

function Row({ row }: { row: MetricRow }) {
  return (
    <div class="nv-result-row">
      <span class="nv-result-label">{row.label}</span>
      <span class="nv-result-value">{row.value}</span>
      {row.delta ? (
        <span class={`nv-result-delta ${row.delta.good ? 'is-good' : 'is-bad'}`}>
          {row.delta.arrow} {row.delta.magnitude}
        </span>
      ) : (
        <span class="nv-result-delta is-neutral">—</span>
      )}
      {row.newBest && <span class="nv-result-newbest">NEW BEST</span>}
    </div>
  );
}

function ResultApp({ view, onClose }: { view: ResultView; onClose: () => void }) {
  return (
    <div class="nv-result-body">
      <div class="nv-result-title">✓ MISSION COMPLETE</div>
      <div class="nv-result-mission">{view.title}</div>
      <div class="nv-result-xp">+{view.xp} XP</div>
      <div class="nv-result-metrics">
        {view.rows.map((row) => (
          <Row row={row} />
        ))}
      </div>
      <div class="nv-result-actions">
        <button class="nv-btn nv-btn-nexus" onClick={onClose}>← ZURÜCK ZUM NEXUS</button>
      </div>
    </div>
  );
}

export class ResultModal extends Modal {
  constructor(app: App, private view: ResultView, private scheme: ColorScheme) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.addClass('nv-result', `nv-${this.scheme}`);
    render(h(ResultApp, { view: this.view, onClose: () => this.close() }), this.contentEl);
  }

  onClose(): void {
    render(null, this.contentEl);
    this.contentEl.empty();
  }
}
```

- [ ] **Step 2: Append CSS**

Append to `styles.css` (after line 102):

```css
/* ── Result modal (shown after a successful submit) ───────────── */
.nv-result .nv-result-body {
  font-family: var(--font-monospace); color: var(--nv-text);
  display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
}
.nv-result .nv-result-title {
  color: var(--nv-accent); font-size: 1.3em; font-weight: 700; letter-spacing: 0.14em;
  text-shadow: 0 0 8px var(--nv-accent);
}
.nv-result .nv-result-mission { color: var(--nv-text-dim); letter-spacing: 0.1em; font-size: 0.85em; }
.nv-result .nv-result-xp {
  color: var(--nv-accent); font-size: 2em; font-weight: 800;
  text-shadow: 0 0 12px var(--nv-accent); margin: 4px 0;
}
.nv-result .nv-result-metrics { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.nv-result .nv-result-row {
  display: grid; grid-template-columns: 6em 1fr auto auto; align-items: center; gap: 10px;
  padding: 6px 10px; background: var(--nv-panel); border: 1px solid var(--nv-border-soft);
  border-radius: 6px; font-variant-numeric: tabular-nums;
}
.nv-result .nv-result-label { color: var(--nv-text-dim); font-size: 0.78em; letter-spacing: 0.08em; text-align: left; }
.nv-result .nv-result-value { color: var(--nv-text); font-weight: 600; text-align: left; }
.nv-result .nv-result-delta { font-size: 0.82em; }
.nv-result .nv-result-delta.is-good { color: var(--nv-accent); }
.nv-result .nv-result-delta.is-bad { color: var(--nv-danger); }
.nv-result .nv-result-delta.is-neutral { color: var(--nv-text-dim); }
.nv-result .nv-result-newbest {
  color: var(--nv-submit-fg); background: var(--nv-submit-bg); border: 1px solid var(--nv-accent);
  font-size: 0.68em; letter-spacing: 0.08em; padding: 1px 6px; border-radius: 4px;
}
.nv-result .nv-result-actions { margin-top: 6px; }
/* Button scoped under .nv-result so our color outranks Obsidian's button rule. */
.nv-result .nv-btn {
  padding: 6px 14px; font-size: 0.8em; letter-spacing: 0.06em; border-radius: 4px; cursor: pointer;
  background: var(--nv-btn-bg); border: 1px solid var(--nv-border-soft); color: var(--nv-text);
}
.nv-result .nv-btn:hover { border-color: var(--nv-accent); color: var(--nv-accent); }
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: no type errors; `main.js` written.

- [ ] **Step 4: Commit**

```bash
git add src/result/ResultModal.tsx styles.css
git commit -m "feat(result): ResultModal (Preact + Obsidian Modal) + CRT styling"
```

---

### Task 3: Wire modal into `handleSubmit`

**Files:**
- Modify: `src/main.ts` (imports near top; `handleSubmit` success branch at `src/main.ts:149-153`)

**Interfaces:**
- Consumes: `buildResultView` (Task 1), `ResultModal` (Task 2), `this.settings.colorScheme: ColorScheme`, `res.result: RunResult`.
- Produces: replaced success-branch behavior (no new exports).

- [ ] **Step 1: Add imports**

In `src/main.ts`, after the existing local imports (e.g. the line importing `showDivergentLine`/`clearHighlight`), add:

```ts
import { buildResultView } from './result/resultView';
import { ResultModal } from './result/ResultModal';
```

- [ ] **Step 2: Replace the success branch**

In `handleSubmit`, replace this block:

```ts
    if (res.ok) {
      if (cm) clearHighlight(cm);
      new Notice(`>_ Mission ${res.result.mission_id} restored — +${res.result.xp_earned} XP`);
      this.session.end();
      this.restoreVim();
    } else {
```

with:

```ts
    if (res.ok) {
      if (cm) clearHighlight(cm);
      this.session.end();
      this.restoreVim();
      new ResultModal(this.app, buildResultView(res.result), this.settings.colorScheme).open();
    } else {
```

(The `Notice` import stays — it is still used by the fail/reset/abort/start branches.)

- [ ] **Step 3: Typecheck + build + full test run**

Run: `npm run typecheck && npm run build && npm test`
Expected: no type errors; `main.js` written; all tests green (existing 29 + new resultView tests).

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(result): show ResultModal after successful submit (replaces Notice)"
```

---

## After the plan (out of plan-execution, done by orchestrator)

1. **Deploy + Obsidian-Smoke** via `/user-handover`: **zuerst Build-Reload verifizieren** (aktive LESSON), dann Missions-Loop → Modal erscheint mit korrekten Werten (Delta/NEW BEST/XP), Button schließt.
2. **Minor-Release**: `npm run release 0.2.0` (Dual-Push) nach grünem Smoke.
3. **Cockpit/Memory** aktualisieren; Block B (Drill) anschließen.

## Self-Review (durchgeführt)

- **Spec-Coverage:** Metriken+XP (Task 1), Modal-Darreichung+Styling (Task 2), Notice-Ersatz+Aufräum-Reihenfolge (Task 3), Delta-Konvention/Edge-Cases (Task 1 Tests), Button-Gotcha+Scheme-Vars (Task 2 CSS). ParTier/Guidance/Drill bewusst ausgeschlossen — kein Task, korrekt.
- **Placeholder-Scan:** keine TBD/TODO; jeder Code-Step trägt vollständigen Code.
- **Typ-Konsistenz:** `ResultView`/`MetricRow`/`DeltaView` in Task 1 definiert, in Task 2 konsumiert; `ColorScheme` aus `settings.ts` (`'crt' | 'native'`); `buildResultView`/`ResultModal`-Signaturen über Tasks stabil.
