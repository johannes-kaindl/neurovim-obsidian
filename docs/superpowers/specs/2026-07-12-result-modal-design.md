# Design-Spec — Block A: Result-Modal

**Datum:** 2026-07-12
**Status:** approved (Brainstorm mit Jay)
**Roadmap:** `docs/superpowers/plans/2026-07-12-store-ready-roadmap.md` → Block A (Phase 1)
**Ausgangspunkt:** MVP + Editor-HUD live (0.1.0). Nach erfolgreichem Submit feuert aktuell nur
eine `Notice` (`src/main.ts:151`).

## Ziel

Nach erfolgreichem Mission-Submit statt der schlichten `Notice` ein **Result-Modal** zeigen:
Zeit, Keystrokes, KS/MIN — jeweils mit Delta zur Bestzeit und `NEW BEST`-Badge — plus verdiente
XP. Erste Iteration der store-ready-Roadmap.

## Scope-Schnitt (bewusst minimal)

**Drin (Block A):**
- Header „MISSION COMPLETE" + Missionstitel
- Drei Metrik-Zeilen: TIME / KEYSTROKES / KS·MIN mit Delta + `NEW BEST`
- `+XP` groß
- Ein Button „← ZURÜCK ZUM NEXUS" (schließt das Modal)

**Bewusst NICHT (spätere Blöcke / post-launch):**
- ParTier-Medaille (★ GOLD/SILBER/BRONZE) → post-launch
- Guidance-/CIPHER-Zeile („Next: …") → Block E
- Drill-Again-Button → Block B
- Next-Mission / Review-Navigation → Block D/E

Begründung: sauberer Blockschnitt, keine neue Datenverdrahtung nötig — `RunResult` trägt bereits
alle Felder (`elapsed_ms`, `keystrokes`, `ks_per_min`, `xp_earned`, `is_new_best_time`,
`is_new_best_ks`, `delta_time_ms`, `delta_keystrokes`, `delta_ks_per_min`).

## Prinzipien-Bezug

- **Portierung, nicht Copy-Paste** (Roadmap-Prinzip 1): Die Monorepo-`ResultModal.tsx` ist **React**
  (`react-dom/client`); vim-dojo rendert **Preact** (`render(h(Comp, props), container)`). Neu gebaut
  auf die schlanke Architektur.
- **TDD für pure Logik** (Prinzip 5): Die Präsentations-Berechnung wird als reine Funktion isoliert
  und unit-getestet; die Obsidian-/Preact-Glue bleibt dünn und wird per Smoke-Test verifiziert.

## Architektur & Komponenten

| Datei | Verantwortung | Verifikation |
|---|---|---|
| `src/result/resultView.ts` | **PURE.** `buildResultView(result: RunResult): ResultView` + Helper `formatDuration`. Formt `RunResult` in ein reines View-Model. Kein Obsidian, kein Preact, kein DOM. | Vitest (ohne Mock), `test/resultView.test.ts` |
| `src/result/ResultModal.ts` | Obsidian-`Modal`-Subklasse `(app, view, scheme)`. `onOpen` → Preact-`render` des View-Models in `contentEl` (Root `nv-result nv-${scheme}`); `onClose` → `render(null, contentEl)`. Button ruft `this.close()`. | Smoke-Test |
| `src/main.ts` (`handleSubmit`) | Erfolgs-`Notice` (`main.ts:151`) → `new ResultModal(this.app, buildResultView(res.result)).open()`. | Smoke-Test |

Die Preact-Komponente kann inline in `ResultModal.ts` liegen (via `h(...)`) oder als `.tsx` — beides
zulässig, Idiom wie `MissionHud.tsx` / `ObsidianHudDom.ts`.

## Datenfluss

```
handleSubmit()
  → session.submit()  → { ok: true, result }
  → [wie bisher] clearHighlight(cm); session.end(); restoreVim()
  → buildResultView(result)
  → new ResultModal(app, view).open()
  → repaint()
```

Das Modal ist **rein informativ**. Datenpersistenz + XP-Verbuchung passieren bereits in
`MissionSession.submit()`. Die bestehende Aufräum-Logik (`clearHighlight`, `session.end`,
`restoreVim`) läuft **vor** dem Öffnen des Modals und bleibt unverändert. `onClose` des Modals
braucht daher keine zusätzliche Aufräum-Logik.

Die **Fail-Notice** (`main.ts:157`, „N lines differ — keep going") sowie Reset-/Abort-Notices
bleiben unangetastet — nur der Erfolgsfall wird zum Modal.

## Das pure View-Model

```ts
interface DeltaView {
  arrow: '▲' | '▼';    // ▲ = Verbesserung, ▼ = Verschlechterung (NICHT Roh-Metrik-Richtung)
  magnitude: string;   // z.B. "3s", "2", "12.4"
  good: boolean;       // steuert good/bad-Farbe; deckt sich mit arrow ('▲' ⇔ good)
}

interface MetricRow {
  label: string;       // "TIME" | "KEYSTROKES" | "KS/MIN"
  value: string;       // formatierter Wert
  delta: DeltaView | null;  // null → neutral "—"
  newBest: boolean;    // zeigt NEW-BEST-Badge
}

interface ResultView {
  title: string;       // mission_id
  rows: MetricRow[];
  xp: number;          // result.xp_earned
}
```

Zeilen-Regeln:
- **TIME** — `value = formatDuration(elapsed_ms)` (lokaler pure Helper; unter 1 Min → Sekunden
  mit einer Nachkommastelle „0.7s", ab 1 Min → „M:SS". Der Vendor-`formatTime` ist `MM:SS` und
  zeigt für sub-Minuten-Missionen „00:00" — daher hier ungeeignet.)
  Delta aus `delta_time_ms`, **besser wenn < 0**. `newBest = is_new_best_time`.
  Delta-`magnitude` in Sekunden mit einer Nachkommastelle: `(|delta_time_ms| / 1000).toFixed(1) + "s"`.
- **KEYSTROKES** — `value = keystrokes`. Delta aus `delta_keystrokes`, **besser wenn < 0**.
  `newBest = is_new_best_ks`. `magnitude` = Ganzzahl.
- **KS/MIN** — `value = ks_per_min`. Delta aus `delta_ks_per_min`, **besser wenn > 0**.
  **Kein** NEW-BEST-Badge (wie Vorlage). `magnitude` = eine Nachkommastelle.

Delta-Regel allgemein (Konvention: **hoch = besser**, wie Monorepo-Vorlage): Roh-Delta `0`
→ `delta = null` (Anzeige neutral `—`, kein Pfeil). Sonst pro Zeile `good` gemäß der
richtungsabhängigen Regel oben bestimmen; `arrow = good ? '▲' : '▼'`. Der Pfeil kodiert also
**Verbesserung/Verschlechterung**, nicht die Roh-Richtung der Metrik (schnellere Zeit →
`▼ der Sekunden`, aber angezeigt als `▲` good).

## Edge-Cases

Alle fallen natürlich aus den Daten (`MissionSession.submit()` setzt `delta_* = 0` und
`is_new_best_* = true`, wenn kein `old`-Record existiert):

- **Erst-Clear** (kein voriger Record): `delta_* = 0`, `is_new_best_time/ks = true`
  → Zeigt `NEW BEST` + neutral `—` (kein Pfeil). Korrekt.
- **Gleichstand** (== Bestzeit): `is_new_best_*` nur bei strikt besser (`<` in `MissionSession`)
  → kein Badge, Delta `—`.
- **Regression** (schlechter als Best): Delta-Pfeil in bad-Farbe, kein Badge.

## Styling

- `.nv-result`-Block in `styles.css`, Cyberpunk-CRT-Ästhetik konsistent mit der HUD
  (comply-or-explain-Ausnahme zu `UI-STANDARD.md` gilt bereits fürs Plugin: Spiel-Oberfläche).
- Bestehende CSS-Variablen / `colorScheme` (CRT/Native) berücksichtigen.
- **Button-Farbe mit Kontext-Spezifität** (`.nv-result .nv-btn { color: … }`) — aktive LESSON
  (2026-07-12): bare Plugin-Button-Klassen werden sonst von Obsidian überschrieben.

## Testing

- **Unit (TDD, `src/result/resultView.test.ts`):**
  - Erst-Clear → beide `NEW BEST`, alle Deltas `null`.
  - Verbesserung → alle `▲` good (TIME/KS/KS·MIN), passende `NEW BEST`-Badges.
  - Regression → alle `▼` bad, keine Badges.
  - Gleichstand → keine Badges, Deltas `null`.
  - Delta-`magnitude`-Formatierung je Zeile (Sekunden / Ganzzahl / eine Nachkommastelle).
- **Smoke (Obsidian, via `/user-handover`):** Missions-Loop end-to-end, Modal erscheint mit
  korrekten Werten, Button schließt. **Zuerst Build-Reload verifizieren** (aktive LESSON:
  neuen Build aktiv? — vor jedem Device-Test/Debug).

## Release

Minor-Bump → `npm run release 0.2.0` (Dual-Push Codeberg + GitHub), nach grünem Smoke-Test.

## Nicht in dieser Spec

- Sidebar-Auto-Open-Verhalten (öffnet bei jedem Obsidian-Start; soll weg oder Opt-In-Setting) —
  separater Fix, im Projekt-Memory notiert (`sidebar-auto-open-unwanted`), nicht Block A.
