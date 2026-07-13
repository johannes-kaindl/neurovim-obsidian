# Design-Spec — Mission-Briefing-Anzeige

**Datum:** 2026-07-13
**Status:** approved (Brainstorm mit Jay)
**Roadmap-Bezug:** vorgezogenes Surfacing-Feature (Story). Der Rest des Content-Surfacings
(Lore/Manual/Welcome) bleibt in Blöcken C/D/E.

## Ausgangslage (wichtig)

Die Briefings **fehlen nicht** — sie liegen vollständig im vendored Content (`v0.2.4`, 173
Einträge, jede Mission hat einen `role: 'briefing'`-Eintrag). `getMission(id)` liefert
`briefingBody` **bereits** (`src/vendor/neurovim/content/index.ts:71`). Der einzige Grund, warum
das Briefing nicht sichtbar ist: `MissionSession.start()` schreibt nur `doc.transmissionBody`
und ignoriert `doc.briefingBody`. **→ reine Surfacing-Lücke, kein Content-Nachzug.**

## Ziel

Beim Missionsstart das Briefing (CIPHER-Story + Directive) in einem **Modal** zeigen, gerendert
als natives Obsidian-Markdown (Callouts/ASCII). Ein „▶ Mission beginnen"-Button öffnet dann die
Transmission und startet den Timer. Bookend zum Result-Modal (Briefing davor, Ergebnis danach).

## Flow

```
handleStart(id)
  → doc = content.getMission(id)
  → doc.briefingBody vorhanden?
       nein ──▶ beginMission(id)
       ja   ──▶ BriefingModal(title, briefingBody, scheme, onBegin) .open()
                  → "▶ Mission beginnen" → beginMission(id)

beginMission(id)   [= bisheriger handleStart-Rumpf]
  → session.start(id)      // materialisiert Transmission, öffnet Notiz, Timer startet
  → boxDismissed = false; enterAutoVim(); repaint()
```

`session.start()` bleibt **unverändert**; der Timer startet weiterhin dort — nur eben erst nach
dem Briefing, sodass die Lesezeit nicht zählt.

## Komponenten

| Datei | Verantwortung | Verifikation |
|---|---|---|
| `src/briefing/briefingText.ts` | **PURE.** `stripTransmissionLink(md)` — entfernt die abschließende „→ [[…TRANSMISSION…]] — open to begin"-CTA-Zeile (unser Button ersetzt sie) und trailing leere/Callout-`>`-Zeilen. Kein Obsidian. | Vitest, `test/briefingText.test.ts` |
| `src/briefing/BriefingModal.ts` | Obsidian-`Modal`. Rendert das (gestrippte) `briefingBody` via `MarkdownRenderer.render(app, md, el, '', component)` in `contentEl`; Header = Missionstitel; Button „▶ Mission beginnen" → `onBegin`. Eigener `Component` (load/unload mit Modal-Lifecycle). CRT-Scheme auf `modalEl`. | Smoke |
| `src/main.ts` | `handleStart` → Briefing-Gate; neuer `beginMission(id)` mit dem bisherigen Start-Rumpf. | Smoke |

## `stripTransmissionLink` (pure)

```ts
export function stripTransmissionLink(md: string): string {
  const lines = md.split('\n');
  // Drop CTA lines: an arrow marker plus a wikilink (the "→ [[…]] — open to begin" line).
  const kept = lines.filter((line) => !(/→/.test(line) && /\[\[.+\]\]/.test(line)));
  // Trim trailing blank / callout-empty (">", "> ") lines left behind.
  while (kept.length && /^\s*>?\s*$/.test(kept[kept.length - 1])) kept.pop();
  return kept.join('\n');
}
```

Regel: hoch spezifisch für die CTA-Zeile (`→` **und** Wikilink); Story-Prosa enthält diese
Kombination nicht. Worst case rein kosmetisch.

## BriefingModal (Skizze)

```ts
import { App, Component, MarkdownRenderer, Modal } from 'obsidian';
import type { ColorScheme } from '../settings';
import { stripTransmissionLink } from './briefingText';

export class BriefingModal extends Modal {
  private comp = new Component();
  constructor(
    app: App,
    private title: string,
    private body: string,
    private scheme: ColorScheme,
    private onBegin: () => void,
  ) { super(app); }

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

Plain Obsidian-DOM (createDiv/createEl) statt Preact — hier rendert `MarkdownRenderer` in ein
Element, Preact bringt keinen Mehrwert.

## Styling
- `.nv-briefing`-Block in `styles.css`, CRT-Rahmen wie das Result-Modal
  (`.modal.nv-briefing-modal.nv-crt { background: var(--nv-pane-bg); … }`), Close-Button gedimmt.
- Der gerenderte Markdown-Body erbt Obsidians native Callout-/Reading-Optik; nur Rahmen +
  Titel + Button-Bereich brauchen eigenes CSS.
- Button-Farbe mit Kontext-Spezifität (`.nv-briefing .nv-btn { … }`) — aktive LESSON.

## Edge-Cases
- **Kein Briefing** (`briefingBody === ''`) → Modal überspringen, direkt `beginMission`.
- **Toter Transmission-Wikilink** → per `stripTransmissionLink` entfernt.
- **` ```ascii `-Blöcke** → als Monospace-Codeblock gerendert (ASCII-Prozessor bewusst post-launch).

## Bewusst NICHT (YAGNI / spätere Blöcke)
- Briefing mid-Mission nachlesen / „Briefing erneut zeigen"-Command → Block C (Reference-Overlay).
- Lore/Fragmente/Manual/Welcome-Surfacing → Blöcke C/D/E (inkrementell, kein Autoren-Aufwand).

## Testing & Release
- **Unit (TDD, `test/briefingText.test.ts`):** CTA-Zeile entfernt (inkl. trailing `>`-Trim);
  Briefing ohne CTA unverändert; Story-Zeile mit `→` aber ohne Wikilink bleibt.
- **Smoke (Obsidian, Build-Reload zuerst — LESSON):** Mission wählen → Briefing-Modal mit
  gerenderten Callouts → „Beginnen" → Transmission öffnet, Timer läuft → Submit → Result-Modal.
- **Release:** Minor **0.3.0** (neues Feature).

## Nicht in dieser Spec
- Timer-Pause im Lesemodus (`timer-pause-in-reading-mode`) — separates Feature, geparkt.
