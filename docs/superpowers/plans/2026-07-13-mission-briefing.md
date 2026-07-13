# Mission-Briefing-Anzeige Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beim Missionsstart das Briefing (CIPHER-Story) in einem Modal als natives Obsidian-Markdown zeigen; „▶ Mission beginnen" öffnet dann die Transmission und startet den Timer.

**Architecture:** `handleStart` fetcht die Mission, zeigt bei vorhandenem `briefingBody` ein `BriefingModal` (Obsidian-`MarkdownRenderer`), dessen CTA den bisherigen Start-Rumpf (`beginMission`) auslöst. Pure `stripTransmissionLink` säubert die tote CTA-Zeile.

**Tech Stack:** TypeScript · Obsidian `Modal` + `MarkdownRenderer` + `Component` · Vitest · esbuild.

## Global Constraints

- **Content ist im Bundle** — `getMission(id)` liefert `briefingBody` bereits; kein Content-Nachzug.
- **`session.start()` bleibt unverändert** — Timer startet dort, nur erst nach dem Briefing.
- **Kein Briefing** (`briefingBody === ''`) → Modal überspringen, direkt starten.
- **Button-Farbe mit Kontext-Spezifität** (`.nv-briefing .nv-btn`) — aktive LESSON.
- **Scheme-Vars**: Modal-Frame braucht `nv-${scheme}` auf `modalEl`.
- `MarkdownRenderer.render(app, md, el, sourcePath, component)` (Obsidian 1.12.3, nicht-deprecated).
- Tests in `test/`, `*.test.ts`; `test`=`vitest run`, `typecheck`=`tsc --noEmit`, `build`=`node esbuild.config.mjs production`.

---

### Task 1: Pure `stripTransmissionLink` (TDD)

**Files:**
- Create: `src/briefing/briefingText.ts`
- Test: `test/briefingText.test.ts`

**Interfaces:**
- Produces: `stripTransmissionLink(md: string): string`

- [ ] **Step 1: Write the failing test**

Create `test/briefingText.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stripTransmissionLink } from '../src/briefing/briefingText';

describe('stripTransmissionLink', () => {
  it('removes the trailing transmission CTA line and dangling callout markers', () => {
    const md = [
      '> [!abstract] DIRECTIVE',
      '> Restore the document.',
      '>',
      '> → **[[M-01-TRANSMISSION|The Three Modes]]** — open to begin. Timer starts on file open.',
    ].join('\n');
    expect(stripTransmissionLink(md)).toBe(
      ['> [!abstract] DIRECTIVE', '> Restore the document.'].join('\n'),
    );
  });

  it('leaves briefings without a CTA line unchanged', () => {
    const md = '> [!quote] CIPHER\n> Use Vim.';
    expect(stripTransmissionLink(md)).toBe(md);
  });

  it('keeps story prose that uses an arrow but no wikilink', () => {
    const md = 'Normal → Insert → Escape. That is the loop.';
    expect(stripTransmissionLink(md)).toBe(md);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/briefingText.test.ts`
Expected: FAIL — `Cannot find module '../src/briefing/briefingText'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/briefing/briefingText.ts`:

```ts
/**
 * Remove the trailing "→ [[…TRANSMISSION…]] — open to begin" CTA line from a briefing body.
 * The BriefingModal's "Mission beginnen" button replaces it, so the wikilink would be a dead
 * link. Highly specific (an arrow marker AND a wikilink); story prose won't match.
 */
export function stripTransmissionLink(md: string): string {
  const lines = md.split('\n');
  const kept = lines.filter((line) => !(/→/.test(line) && /\[\[.+\]\]/.test(line)));
  // Trim trailing blank / callout-empty (">", "> ") lines left behind.
  while (kept.length && /^\s*>?\s*$/.test(kept[kept.length - 1])) kept.pop();
  return kept.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/briefingText.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/briefing/briefingText.ts test/briefingText.test.ts
git commit -m "feat(briefing): pure stripTransmissionLink (TDD)"
```

---

### Task 2: `BriefingModal` + CSS

**Files:**
- Create: `src/briefing/BriefingModal.ts`
- Modify: `styles.css` (append `.nv-briefing*` block)

**Interfaces:**
- Consumes: `stripTransmissionLink` (Task 1); `ColorScheme` from `../settings`; Obsidian `App`/`Modal`/`Component`/`MarkdownRenderer`.
- Produces: `class BriefingModal extends Modal` mit Konstruktor `(app: App, title: string, body: string, scheme: ColorScheme, onBegin: () => void)` und `.open()`.

- [ ] **Step 1: Create the modal**

Create `src/briefing/BriefingModal.ts`:

```ts
import { App, Component, MarkdownRenderer, Modal } from 'obsidian';
import type { ColorScheme } from '../settings';
import { stripTransmissionLink } from './briefingText';

/** Shows a mission briefing (rendered Obsidian markdown) before the transmission opens. */
export class BriefingModal extends Modal {
  private comp = new Component();

  constructor(
    app: App,
    private title: string,
    private body: string,
    private scheme: ColorScheme,
    private onBegin: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass('nv-briefing-modal', `nv-${this.scheme}`);
    this.comp.load();
    const { contentEl } = this;
    contentEl.addClass('nv-briefing');
    contentEl.createDiv({ cls: 'nv-briefing-title', text: `>_ MISSION BRIEFING — ${this.title}` });
    const md = contentEl.createDiv({ cls: 'nv-briefing-body' });
    void MarkdownRenderer.render(this.app, stripTransmissionLink(this.body), md, '', this.comp);
    const actions = contentEl.createDiv({ cls: 'nv-briefing-actions' });
    const btn = actions.createEl('button', { cls: 'nv-btn nv-btn-begin', text: '▶ MISSION BEGINNEN' });
    btn.onclick = () => { this.close(); this.onBegin(); };
  }

  onClose(): void {
    this.comp.unload();
    this.contentEl.empty();
  }
}
```

- [ ] **Step 2: Append CSS**

Append to `styles.css` (after the `.nv-result*` block):

```css
/* ── Briefing modal (shown before a mission's transmission opens) ── */
/* Dark CRT frame (CRT scheme only); native scheme keeps Obsidian's themed modal. */
.modal.nv-briefing-modal.nv-crt {
  background: var(--nv-pane-bg); border: 1px solid var(--nv-border);
  box-shadow: 0 0 28px rgba(0, 0, 0, 0.55);
}
.nv-briefing-modal .modal-close-button { color: var(--nv-text-dim); }
.nv-briefing-modal .modal-close-button:hover { color: var(--nv-accent); }
.nv-briefing .nv-briefing-title {
  color: var(--nv-accent); font-family: var(--font-monospace); letter-spacing: 0.1em;
  font-weight: 700; margin-bottom: 10px; text-shadow: 0 0 8px var(--nv-accent);
}
.nv-briefing .nv-briefing-body { max-height: 60vh; overflow-y: auto; }
.nv-briefing .nv-briefing-actions { display: flex; justify-content: center; margin-top: 12px; }
/* Button scoped under .nv-briefing so our color outranks Obsidian's button rule. */
.nv-briefing .nv-btn {
  padding: 6px 16px; font-size: 0.85em; letter-spacing: 0.06em; border-radius: 4px; cursor: pointer;
  background: var(--nv-submit-bg); border: 1px solid var(--nv-accent); color: var(--nv-submit-fg);
}
.nv-briefing .nv-btn:hover { box-shadow: 0 0 10px var(--nv-accent); }
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: no type errors; `main.js` written.

- [ ] **Step 4: Commit**

```bash
git add src/briefing/BriefingModal.ts styles.css
git commit -m "feat(briefing): BriefingModal renders briefing markdown before the mission"
```

---

### Task 3: Wire briefing gate into `handleStart`

**Files:**
- Modify: `src/main.ts` (import; `handleStart` at `src/main.ts:134-143`)

**Interfaces:**
- Consumes: `BriefingModal` (Task 2), `this.content.getMission(id)` → `MissionDoc` (`briefingBody`, `title`), `this.settings.colorScheme`.
- Produces: split `handleStart` + new `beginMission(id)`.

- [ ] **Step 1: Add import**

In `src/main.ts`, after the existing local imports (near the `./result/*` imports), add:

```ts
import { BriefingModal } from './briefing/BriefingModal';
```

- [ ] **Step 2: Replace `handleStart` and add `beginMission`**

Replace this block:

```ts
  private async handleStart(id: string): Promise<void> {
    try {
      await this.session.start(id);
      this.boxDismissed = false;
      this.enterAutoVim();
      this.repaint();
    } catch (e) {
      new Notice(`NeuroVim: ${(e as Error).message}`);
    }
  }
```

with:

```ts
  private async handleStart(id: string): Promise<void> {
    let doc;
    try {
      doc = await this.content.getMission(id);
    } catch (e) {
      new Notice(`NeuroVim: ${(e as Error).message}`);
      return;
    }
    if (doc.briefingBody) {
      new BriefingModal(
        this.app, doc.title, doc.briefingBody, this.settings.colorScheme,
        () => void this.beginMission(id),
      ).open();
    } else {
      await this.beginMission(id);
    }
  }

  /** Actually start the mission: materialize + open the transmission, start the timer. */
  private async beginMission(id: string): Promise<void> {
    try {
      await this.session.start(id);
      this.boxDismissed = false;
      this.enterAutoVim();
      this.repaint();
    } catch (e) {
      new Notice(`NeuroVim: ${(e as Error).message}`);
    }
  }
```

- [ ] **Step 3: Typecheck + build + full test run**

Run: `npm run typecheck && npm run build && npm test`
Expected: no type errors; `main.js` written; all tests green (existing + 3 new briefingText tests).

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(briefing): show BriefingModal on mission start, gate the actual start behind it"
```

---

## After the plan (orchestrator)

1. **Deploy + Obsidian-Smoke** (`/user-handover` bzw. direkt): Build-Reload zuerst (LESSON), dann Mission wählen → Briefing-Modal mit gerenderten Callouts/ASCII → „Mission beginnen" → Transmission öffnet, Timer läuft → Submit → Result-Modal.
2. **Minor-Release 0.3.0** (Dual-Push) nach grünem Smoke + Publish-Freigabe.
3. **Cockpit/Memory** aktualisieren; zurück auf Roadmap (Block B Drill oder Timer-Idee).

## Self-Review (durchgeführt)

- **Spec-Coverage:** stripTransmissionLink (Task 1), BriefingModal+MarkdownRenderer+CSS (Task 2), handleStart-Gate + beginMission + Timer-nach-Briefing (Task 3), Edge-Cases (kein Briefing → skip; toter Link → strip). ASCII-Prozessor/Lore-Surfacing bewusst ausgeschlossen.
- **Placeholder-Scan:** keine TBD/TODO; jeder Code-Step vollständig.
- **Typ-Konsistenz:** `stripTransmissionLink` (Task 1) → BriefingModal (Task 2); `BriefingModal(app,title,body,scheme,onBegin)`-Signatur konsistent in Task 2/3; `ColorScheme`, `MissionDoc.briefingBody/title` aus vendored types.
