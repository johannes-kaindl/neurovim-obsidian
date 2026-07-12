# Roadmap — vim-dojo → store-ready

**Datum:** 2026-07-12
**Status:** approved (Brainstorm mit Jay)
**Ausgangspunkt:** MVP + Editor-HUD fertig, in Obsidian verifiziert, Release **0.1.0** live
(Codeberg `jkaindl/neurovim-obsidian` + GitHub `johannes-kaindl/neurovim-obsidian`, via BRAT
installierbar). Plugin-id: `neurovim`.

## Ziel

vim-dojo vor der **Community-Store-Submission (Stufe C)** auf einen *store-ready-Kern* bringen,
indem die Feature-Schicht aus dem `neurovim-standalone`-Monorepo-Plugin (v0.2.4) nachgezogen wird.
Nicht 1:1-Vollparität — ein rundes, lernwirksames, poliertes Plugin. Extras folgen per Updates.

## Prinzipien

1. **Portierung, nicht Copy-Paste.** vim-dojo hat bewusst eine schlankere Architektur (Bundle = SSOT,
   Wegwerf-Notizen, `MissionSession`) als das Monorepo-Plugin (Vault als Content-SSOT, frontmatter-healing,
   path-based detection). Features werden auf die neue Architektur *neu gebaut*, alte Mechaniken bleiben
   obsolet. (So gemacht beim HUD: `MissionHud` statt `FloatHUD` gezwungen.)
2. **`vendor/core` = Bausteine.** Der ganze vendored `core` (Engines/Audio/Views) liegt schon in
   `src/vendor/neurovim/core/` — es geht ums Verdrahten + Portieren, nicht um Neuerfindung.
3. **Store-ready-Kern, nicht Vollparität.** Schnitt bewusst nach Block E; Sandbox/Audio/ASCII/ParTier
   post-launch.
4. **Stats-Hub kehrt die SSOT-Richtung um (Inkubator).** Der Profil/Stats-Hub (Block D) entsteht *zuerst*
   in vim-dojo. Damit er später ins Monorepo-`core` fließen kann (für web/tauri), wird seine Kern-Logik
   (Rang-/Skill-Berechnung) als **reine, testbare Funktionen plugin-lokal** gebaut (NICHT in `vendor/`),
   dann sauber ins `core` promotebar.
5. **Jeder Block = eigene Iteration**: Brainstorm → Spec → Plan → Build (TDD für pure Logik) →
   Obsidian-Smoke-Test (via `/user-handover`) → Minor-Release. Wie beim HUD.

## Gap-Analyse (Monorepo-Plugin hat es, vim-dojo noch nicht)

| Block | Was | Store-Wert | Aufwand | Roadmap |
|---|---|---|---|---|
| Result-Modal | Nach Submit: Zeit/Bestzeit/Deltas/XP statt Notice | hoch | klein | **A** |
| Drill-Mode | Mission zum Üben wiederholen (`toggle-drill`) | mittel | klein | **B** |
| Cheatsheet/Reference-Overlay | Vim-Spickzettel während der Mission (`CheatSheetModule`, hints) | hoch | mittel | **C** |
| Profil/Stats-Hub 🆕 | Bestzeiten · completed · Rang · Skill-Werte · Story-Archiv | hoch | mittel-groß | **D** |
| Guidance/Onboarding | Diegetisches CIPHER-Coaching + Onboarding (`GuidanceEngine`, cipher-quotes) | hoch | groß | **E** |
| Lore/Chapters/Level-Choreografie | Story-Artefakte, level-basierte Unlocks | mittel | mittel | in D/E aufgehen |
| Modulare Sidebar | `NavHub`/`Progress`-Module statt reiner Liste | mittel | mittel | post-launch |
| Sandbox / THE RAVEN | Glitch-Übungsfeld (`GlitchEngine`, `SandboxHUD`) | mittel | groß | post-launch |
| Audio | Ambient + SFX + Vim-Command-Sounds | mittel | mittel | post-launch |
| ASCII-Art-Processors | `ascii`/`glitch`/`scanlines`-Codeblock-Rendering | niedrig | klein | post-launch |
| ParTier | Par-Zeit-Bewertung / Medaillen | niedrig | klein | post-launch |

## Roadmap

**Phase 1 · Feedback-Schleife** (klein, hoher Gewinn, Momentum)
- **A — Result-Modal**: Modal nach Submit mit Zeit/Bestzeit/Deltas/XP. Voraussetzung für Drill.
- **B — Drill-Mode**: „nochmal üben" direkt aus dem Result-Modal.

**Phase 2 · Lern-Kern**
- **C — Cheatsheet/Reference-Overlay**: Vim-Spickzettel während der Mission, kontextuell zur
  Mission-Kategorie.

**Phase 3 · Charakter sichtbar (das „Save File")**
- **D — Profil/Stats-Hub** 🆕: persönliches Hub mit Bestzeiten, abgeschlossenen Missionen, **Rang**
  (aus Level), **Skill-Werten** (neues Konzept — vermutlich Kompetenz-Score pro Vim-Kategorie aus
  absolvierten Missionen), und **Story-Archiv** (Lore nachlesen, absorbiert das Lore-Archiv).
  Offene Design-Fragen für den Block-Brainstorm: eigene Pane vs. materialisierte Notiz; Definition
  „Skill-Wert"; welche Kern-Logik plugin-lokal (→ `core`-promotebar).

**Phase 4 · Erstnutzer-Erlebnis**
- **E — Guidance/Onboarding**: diegetisches CIPHER-Coaching + Onboarding-Flow.

**→ 🏁 Store-Submit-Schnitt (Stufe C) nach A–E.**

**Post-launch (per Updates):**
- Sandbox / THE RAVEN · Audio · ASCII-Processors · ParTier · modulare Sidebar-Feinheiten.
- **LLM-Ad-Hoc-Missionen** 🆕 (geparkt): LLM-Endpunkt-Konfiguration aus `obsidian-kit` übernehmen
  (`parseEndpointList`/`classifyEndpointStatus`/`ENDPOINT_PRESETS` etc.), lokales Modell generiert
  Ad-Hoc-Missionen zur Laufzeit. Rein lokal, opt-in.

## Nicht in dieser Roadmap

Stufe C (Community-Store-PR an `obsidianmd/obsidian-releases`) ist ein eigener, mehrwöchiger
Review-Prozess *nach* A–E. Die Plugin-id `neurovim` ist frei (2026-07-12 geprüft).
