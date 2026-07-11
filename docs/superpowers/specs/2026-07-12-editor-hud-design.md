# Editor-HUD — schwebendes Mission-Control

**Datum:** 2026-07-12
**Status:** Design approved, in Umsetzung
**Vorgänger:** MVP (`2026-07-11-vim-dojo-mvp.md`) — der Loop läuft; das HUD ersetzt die bewusst vertagte Mission-Control-in-der-Pane.

## Motivation

Heute lebt das Mission-Control (Timer, Keystrokes, Submit/Reset/Abandon) in der Sidebar-Pane,
während man in der geöffneten Missions-Notiz editiert. Das erzwingt einen Blick-/Klick-Wechsel
Notiz ↔ Pane bei jedem Submit. Das HUD verlagert die Steuerung als schwebendes CRT-Overlay direkt
über den Editor — man bleibt in der Notiz. Laut Handoff der größte Feel-Gewinn der Post-MVP-Iteration.

## Entscheidungen (Brainstorming 2026-07-12)

1. **HUD ersetzt die Mission-Control-Pane** — die Sidebar-Pane zeigt während einer Mission weiterhin
   NEXUS (Missionsliste/Level). Timer + Aktionen wandern komplett ins HUD. Kein redundantes Control,
   kein doppelter State-Pfad.
2. **In-Editor-Diff-Highlight kommt mit** — ein fehlgeschlagener Submit markiert die erste abweichende
   Zeile farbig im CM6-Editor (zusätzlich zur bestehenden Notice). Passt zum „im-Editor-bleiben"-Feel;
   Vorlage existiert.
3. **Ansatz A — schlanke Preact-Komponente + eigener Lifecycle-Manager**, nicht der vendored
   `FloatHUD.tsx`. Der alte HUD trägt `MissionState`/`HudMode`/Cheatsheet-/guide-Ballast, den die
   schlanke `MissionSession`-Architektur nicht hat. Wir übernehmen **Optik und CSS-Klassennamen** des
   alten HUD (visuelle Konsistenz, Kit-first auf Muster-Ebene) und das Mount-Muster aus
   `neurovim-standalone/packages/adapter-obsidian/src/main.ts` als **Vorlage** — aber neu geschrieben
   passend zur neuen Architektur. (Lesson „aus einem Beispiel extrahiert man die falsche Abstraktion".)

## Architektur & Bausteine

Drei fokussierte Einheiten, jede mit einer Aufgabe:

| Einheit | Datei | Aufgabe |
|---|---|---|
| `MissionHud` (Komponente) | `src/MissionHud.tsx` | Reine Preact-Komponente. Props `{ id, title, elapsedMs, keystrokes, vimActive }` + `onSubmit/onReset/onAbandon`. Rendert das schwebende CRT-Control. Kein State, kein Obsidian-Bezug → unit-testbar. |
| `HudMount` (Lifecycle-Manager) | `src/HudMount.ts` | Kapselt DOM-/Root-Handling: Container an `.cm-editor` der Missions-Notiz hängen, Preact-Root mounten/re-rendern/zerstören, korrektes Editor-Leaf finden. Vorlage: `createFloatHUD/updateHUD/destroyFloatHUD`, schlank. |
| `diffHighlight` (CM6-Extension) | `src/diffHighlight.ts` | `StateField` + `StateEffect` (aus der Vorlage vendored): markiert die erste abweichende Zeile. `showDivergentLine(view, lineIndex)` / `clearHighlight(view)`. |

**Geänderte Dateien:**
- `src/HubView.tsx` — rendert künftig **immer** `Nexus`; die `MissionControl`-Komponente entfällt (ihre
  Rolle übernimmt das HUD).
- `src/main.ts` — verdrahtet `HudMount` (attach bei `handleStart`, detach bei `end`/Abandon), ruft
  `diffHighlight` bei Fail-Submit (`show`) bzw. Erfolg/Reset (`clear`), registriert `layout-change`
  fürs Re-Sync und die CM6-Extension via `registerEditorExtension`. Der bestehende 500ms-Tick ruft
  zusätzlich `hudMount.update(active)`.
- `styles.css` — HUD-CSS unter den `nv-`-Klassen (CRT-Optik des alten HUD).

## Datenfluss & Lifecycle

- **Mission-Start** (`handleStart`): `session.start(id)` schreibt+öffnet die Notiz → `hudMount.attach(notePath)`
  findet das `MarkdownView`-Leaf, hängt `div.nv-float-hud-container` an dessen `.cm-editor`, mountet den
  Preact-Root. Der 500ms-Tick (`repaint()`) ruft zusätzlich `hudMount.update(active)` → Timer/Keystrokes live.
- **Fail-Submit:** `diffHighlight.show(first_divergent_line)` + bestehende Notice.
- **Erfolg:** `clear()` → `hudMount.detach()` → `session.end()`.
- **Reset:** `clear()`, Timer-Neustart, HUD bleibt.
- **Abandon:** `clear()` + `detach()`.
- **Leaf-Wechsel / Sichtbarkeit** (`layout-change`): `hudMount.sync()` — ist die Missions-Notiz in einem
  sichtbaren Editor-Leaf? Ja & kein HUD → attach; Leaf weg/geschlossen → detach. Das HUD ist an das
  Editor-Leaf gebunden, nicht global-fixed: Notiz schließen entfernt das Control, die Mission läuft im
  `session`-State weiter, das HUD kommt beim Wiederöffnen via `sync` zurück.
- **Positionierung:** `position: absolute; top/right` innerhalb `.cm-editor` (CRT-Box oben rechts).
  `pointer-events` nur auf dem HUD → Editieren darunter ungestört.

## Edge-Cases

- **Notiz mitten in Mission gelöscht** → bestehende `submit`-Logik (re-materialisieren, „not solved")
  bleibt; `sync()` re-attached nach Neuanlage.
- **Vim-Modus aus** → HUD zeigt einen dezenten Ein-Zeilen-Hinweis (der bisherige `nv-hint`-Text wandert
  ins HUD statt in die Pane). `vimActive` aus dem Obsidian-Vim-Setting.
- **Plugin-Unload / `onClose`** → `hudMount.detach()`; `diffHighlight` via `registerEditorExtension`
  (Obsidian räumt selbst auf). Kein verwaister DOM-Knoten, kein doppelter Root.
- **Mehrere Editor-Leaves derselben Notiz** → HUD nur am aktiven/ersten sichtbaren Leaf; ein Container,
  idempotentes `attach`.

## Sicherheit

Keine neue Datei-Fläche — das HUD fasst nur die schon materialisierte Missions-Notiz an. Die Invariante
„nie außerhalb `missionFolder`" bleibt unberührt (Community-Review-relevant).

## Testing (Vitest, Obsidian-Mock)

- `MissionHud` — reine Komponenten-Renders: aktiv → Timer/Keys/Buttons da; Button-Callbacks feuern;
  `vimActive=false` → Hinweis sichtbar.
- `HudMount` — mit `makeFakeEl`-Doubles: `attach` erzeugt genau einen Container, `detach` entfernt ihn,
  doppeltes `attach` idempotent, `update` ohne attach ist ein No-Op.
- `diffHighlight` — reine StateField-Transition: `show(n)` setzt Decoration auf Zeile n+1, `clear()`
  leert, Out-of-range → leer.
- Bestehende 10 Tests bleiben grün (Regression).

## Bewusst draußen (YAGNI)

Hint-/Cheatsheet-Panel, guide-onboard/idle-Modi, Drag/Resize des HUD, Sandbox-HUD — spätere Iterationen.

## Iteration 2026-07-12 — Placement-Modi, schmaler, wegklickbar

Nach dem ersten Runtime-Blick (HUD zu breit, mitten über dem Text) verfeinert:

1. **Setting `hudPlacement`** (`auto` | `sidebar` | `box`, Default `auto`):
   - `sidebar`: Mission-Control **oben in der NEXUS-Pane** (Missionsliste bleibt darunter); Pane zu ⇒ kein HUD (Commands bleiben).
   - `box`: immer die schwebende Box über dem Editor.
   - `auto`: Pane sichtbar ⇒ Sidebar-Block; Pane zu ⇒ Box. Reagiert live auf `layout-change`.
2. **`resolveHudTarget(placement, paneVisible, boxDismissed) → 'sidebar' | 'box' | 'none'`** — pure
   Entscheidungslogik (`src/hudPlacement.ts`, 9 Tests). Einziger Ort der Placement-Regel.
3. **`MissionHud` ist jetzt die geteilte Control-Komponente** für Box *und* Sidebar-Block (DRY). Der
   Sidebar-Block rendert sie oben in `HubView`; die Box mountet sie via `ObsidianHudDom`. Box-vs-Pane-
   Optik kommt allein aus dem Wrapper-CSS (`.nv-float-hud-container .nv-hud` vs. `.nv-nexus .nv-hud`).
4. **Box wegklickbar (×)** — `onDismiss` (nur in der Box gesetzt) blendet die Box **für die laufende
   Mission** aus (transientes `boxDismissed`-Flag in `main.ts`, reset bei Start/Reset). Steuerung dann
   via Command-Palette; nächste Mission ⇒ Box wieder da.
5. **Schmaler** — Box-Breite = Content-Breite (`width: max-content`, cap 440px); Vim-Hinweis kompakt
   (`⚠ Vim mode off — Settings → Editor`) und als eigene Zeile unter der Control-Zeile, damit er die
   Box nicht mehr in die Breite streckt.
6. **`isPaneVisible()`** — DOM-Heuristik (`containerEl.offsetParent !== null`) erkennt, ob die
   NeuroVim-Pane gerade gerendert (nicht in kollabierter Sidebar) ist. Dünner Adapter, nicht unit-getestet.
7. **`saveSettings()` triggert `repaint()`** — Placement-Wechsel im Setting wirkt sofort.
