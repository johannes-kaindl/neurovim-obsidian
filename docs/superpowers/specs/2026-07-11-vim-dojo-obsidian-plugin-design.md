# vim-dojo — NeuroVim als eigenständiges Obsidian-Plugin (Design)

**Datum:** 2026-07-11
**Status:** freigegeben (Brainstorming abgeschlossen, → writing-plans)
**Kontext-Repo:** `/Users/Shared/code/obsidian-plugins/vim-dojo` (neu, eigenständiges Git-Repo)
**Quell-Monorepo (SSOT der Spiellogik):** `/Users/Shared/code/neurovim-standalone`

---

## Motivation — der Kreis schließt sich

NeuroVim ist ein Vim-Lernspiel im Cyberpunk-Spy-Thriller-Gewand (Handler **CIPHER**
vergibt „Missionen", die in Wahrheit Vim-Übungen sind). Es **entstand ursprünglich als
Obsidian-Plugin**, wuchs dann zu einem Multi-Target-Monorepo (plattformneutraler `core`
+ `content` + Adapter für Web/Obsidian/Desktop). Der Obsidian-Adapter existiert und
funktioniert (v0.2.4, 204 Tests grün) — aber **nicht als verteilbares Plugin**: der
Monorepo liefert nur `main.js`, das per Swap-Skript in ein `neurovim-trainer`-Plugin im
persönlichen `32_NeuroVim`-Vault kopiert wird. Kein manifest/styles im Repo, kein
Community-Store, nicht in der `obsidian-plugins`-Familie.

`vim-dojo` holt NeuroVim als **erstklassiges, Community-Store-fähiges Standalone-Plugin**
zurück in das `obsidian-plugins`-Ökosystem. Damit schließt sich der Kreis: die Idee kehrt
als Plugin dorthin zurück, wo sie begann.

## Getroffene Entscheidungen (Brainstorming)

1. **SSOT-Verhältnis:** `vim-dojo` = eigenständiges Repo; `core`+`content` werden aus dem
   Monorepo **vendored** (gepinnter Snapshot). Der Monorepo bleibt SSOT der Spiellogik;
   `vim-dojo` ist der kanonische Obsidian-Delivery.
2. **Oberflächen-Modell: Hybrid.** Content ist **im Plugin gebündelt** (nicht im Vault) →
   Story wird **erspielt, nicht gespoilert**, progressiv freigeschaltet. Menüs/Story/
   Sandbox/Progression leben in einer **Plugin-Pane**; XP/Bestzeiten/Fortschritt in
   `data.json`. Missionen **materialisieren als Wegwerf-Notizen** in einem konfigurierbaren
   Ordner → editiert wird in einer **echten Obsidian-Notiz mit echtem Vim-Modus**. Notiz/
   Ordner löschbar ohne Schaden; nächste Mission legt neu an (passt zur Lore ephemerer
   Transmissions).
3. **Content-Quelle umgedreht:** Beim Alt-Plugin war der Vault die Content-SSOT; jetzt ist
   der **Bundle** die SSOT und die Notizen sind *Ausgaben* (Arbeitskopien), keine Eingaben.
4. **Scope: MVP-Scheibe zuerst** — eine Mission komplett end-to-end durchs Hybrid-Modell,
   dann Content-/Feature-Fan-out.
5. **Ansatz ①:** Web-Shell (aus `adapter-web/App`) für die Pane portieren, `core`+`content`
   bündeln, neue Materialisierungs-Glue schreiben.

## Bewusste Ausnahme (comply-or-explain)

`UI-STANDARD.md` fordert „Obsidian-nativ first, nur Theme-CSS-Variablen". NeuroVims Reiz ist
die bewusste Cyberpunk-CRT-Ästhetik (Phosphor-Grün „Kuro"). Für ein **Spiel** ist der
eigene Look der Zweck, nicht ein Defekt. → Dokumentierte Ausnahme: Spiel-Oberfläche ≠
Produktiv-Panel; die eigene Ästhetik wird beibehalten statt die Identität zu opfern.

---

## Architektur

### Repo-Skelett (`vim-dojo/`)

```
manifest.json          # id: TBD (community-unique; Vorschlag "neurovim"), name "NeuroVim"
package.json · esbuild.config.mjs · tsconfig.json · eslint.config.mjs
styles.css             # CRT/Kuro-Theme, aus adapter-web/styles adaptiert
versions.json
src/
  main.ts              # Plugin-Entry (Lifecycle, View, Ribbon, Commands, Settings)
  HubView.tsx          # ItemView, hostet den Preact-Pane-Baum
  MissionSession.ts    # NEU: Materialisierungs-Controller (das Herz)
  storage/ObsidianStorage.ts    # StoragePort → loadData/saveData
  content/BundledContent.ts     # ContentPort → aus Vendor-Bundle (nicht Vault!)
  vendor/neurovim/     # gepinnter Snapshot von core + content (TS-Source)
scripts/
  vendor-neurovim.mjs  # Snapshot-Skript, an Monorepo-Tag gebunden
  release.mjs          # Dual-Push (byte-identisch aus dem Ökosystem)
docs/superpowers/specs/  # dieses Dokument
```

esbuild bündelt `vendor/` + `src/` in **ein** `main.js` — keine Cross-Package-Resolution
zur Laufzeit. `core` wird als **TS-Source** vendored und mitgebündelt; `content` als
bereits generiertes JSON (Build-Output des `content`-Workspaces).

### Laufzeit-Units (je eine Aufgabe, definierte Schnittstellen)

| Unit | Aufgabe | Abhängigkeiten |
|---|---|---|
| `NeuroVimPlugin` (`main.ts`) | Lifecycle; besitzt `PluginData` (via `ObsidianStorage`); registriert `HubView`, Ribbon, Commands, Settings-Tab; hält die aktive `MissionSession` | obsidian, alle unten |
| `HubView` (ItemView) | Preact-Pane, aus `adapter-web/App` adaptiert. MVP: **NEXUS** (Mission-Picker + Level/XP). Später: Welcome/Briefing/Result/Sandbox/Lore/Reference. Liest gebündelten Content, liest/schreibt `PluginData`, emittiert „Mission starten"-Intent | obsidian, core (UI+engines), BundledContent |
| `MissionSession` (NEU) | Materialisierung: Mission-ID → gebündelter *corrupted*-Body → schreibt Wegwerf-Notiz → öffnet, erzwingt Source+Vim → `FloatHUD` über CM6-Editor → Keystrokes/Diff → Submit: Notiz lesen → `MissionEngine.verify` gegen gebündelte Solution → `ProgressionEngine` XP/Best → save | obsidian, core (MissionEngine/ProgressionEngine/MetricsTracker/FloatHUD), BundledContent |
| `ObsidianStorage` | `StoragePort`-Impl über `plugin.loadData/saveData` | obsidian, core (StoragePort-Typ) |
| `BundledContent` | `ContentPort`-Impl, Quelle = Vendor-JSON (Missionen/Solutions/Lore) — **nicht** der Vault | core (ContentPort-Typ), vendor/content |

**Wiederverwendung aus dem Monorepo:**
- `core`: Engines (pur), `FloatHUD`/`SandboxHUD`/`AsciiArt`/Module (Preact), Audio, Daten,
  Port-Typen — plattformneutral, nie `obsidian`-abhängig.
- `content`: generiertes JSON (`content.ts`/`sandbox.ts`/`welcome.ts`) + Solution-Markdowns.
- `adapter-web`: UI-Shell (`App`, `WelcomeView`, `BriefingView`, `MissionResult`,
  `SandboxView`, `LoreView`, `ReferenceOverlay`, `CommsRail`, `VimPrimer`, `cm6-theme`) —
  für die Pane adaptiert; Storage von IndexedDB → `ObsidianStorage` getauscht.
- `adapter-obsidian`: Editor-Integration (CM6-HUD-Overlay-Muster, VimModeWatcher,
  Keystroke-Zählung, Diff-Highlight, Submit-Flow) — als Vorlage für `MissionSession`.

## Materialisierungs-Lifecycle (Kern-Datenfluss)

1. NEXUS → freigeschaltete Mission wählen → `plugin.startMission(id)`
2. `MissionSession`: `content.getMission(id)` (Bundle) → *corrupted*-Body → Ordner
   sicherstellen → `<settings.missionFolder>/<id>-<slug>.md` schreiben (Wegwerf) → öffnen →
   Source+Vim erzwingen → `MetricsTracker.start()` → `FloatHUD` über den CM6-Editor mounten
3. Nutzer editiert in **echtem Obsidian-Vim**; Keystrokes gezählt
4. Submit (Command/HUD) → Notiz-Body lesen → `MissionEngine.verify(body, solution)`
   - **Mismatch** → divergente Zeile highlighten + Notice, weiterspielen
   - **Match** → `MetricsTracker.getResult` → `ProgressionEngine.recordMissionRun` +
     `addXp` (+ Unlocks) → `saveData` → Result-Screen (Pane/Modal) → Session endet
5. Notiz/Ordner löschen ist **folgenlos**; nächster Start legt neu an

## Fehlerbehandlung & Sicherheits-Invariante

- **Sicherheits-Invariante (zentral fürs Community-Review):** `vim-dojo` fasst **nie**
  Dateien außerhalb des konfigurierten Missions-Ordners an. Kein In-Place-Mutieren von
  Nutzer-Notizen, kein Frontmatter-Healing im übrigen Vault (Bruch mit dem Alt-Plugin).
- Notiz mitten in Mission gelöscht → beim Submit erkennen (Datei fehlt) →
  Re-Materialisieren anbieten.
- Ordner nicht anlegbar / Vendor-Solution fehlt → Notice, sauberer Abbruch, keine Exception
  nach außen.
- **Vim-Modus-Abhängigkeit:** Anders als Web (bündelt `@replit/codemirror-vim`) nutzt das
  Plugin **Obsidians eigenen Vim-Modus** (Editor-Setting). Ist er aus → Hinweis mit
  Ein-Klick-Erklärung; das Spiel läuft, aber ohne Vim-Keybindings.

## Testing

`obsidian-plugin-test-pattern` (vitest + `obsidian-kit/testing`-Mock, node-env, DOM-frei).
Neu zu testen: `MissionSession` (Slug-/Pfad-Bau, Session-State-Übergänge, verify-Wiring
gegen Mock-Vault), `BundledContent` (Auflösung Mission/Solution aus Bundle),
`ObsidianStorage` (Merge/Defaults). Vendored `core` bringt eigene Tests mit; diese laufen
weiterhin im Monorepo (nicht dupliziert).

## MVP-Scheibe (v0.1.0)

**Drin:**
- Pane mit **minimalem NEXUS** (Missionsliste aus Bundle + XP/Level)
- **Eine Mission** (z.B. M-01 „The Three Modes") komplett end-to-end durchs Hybrid-Modell:
  materialisieren → in echtem Vim editieren → Submit → verify → XP/Best in `data.json` →
  Result
- Settings: **Missions-Ordner-Pfad** (Default-Vorschlag `NeuroVim/`)
- Storage via `data.json`; Content aus Bundle; Basis-CRT-Styling
- Infra: Vendor-Skript + Repo-Scaffold + Dual-Push-Release-Wiring

**Draußen (Folge-Iterationen):** Sandbox/THE RAVEN, Lore-Archiv, Reference-Overlay,
Guidance-Backbone, Audio, volle Unlock-Choreografie, Briefing-Politur.

## Lizenz & Identität

- Erbt **AGPL-3.0** (Code) + **CC-BY-SA 4.0** (Content), Dual-License/CLA aus dem Monorepo
  mitführen (AGPL ist Community-Store-kompatibel).
- **Neue** `data.json` — keine Migration vom persönlichen `neurovim-trainer`-Speicherstand.

## Offene Punkte (in writing-plans festzurren)

- **Exakte Plugin-`id`** gegen die Community-Plugin-Liste prüfen und festlegen
  (Vorschlag `neurovim`; Display-Name „NeuroVim").
- **Default-Ordnername** der Wegwerf-Notizen (Vorschlag `NeuroVim/`).
- **Auto-Cleanup:** stale Notizen automatisch löschen oder liegen lassen?
- **Vendor-Snapshot-Detail:** `core` als TS-Source vendoren (empfohlen, ein esbuild-Bundle)
  vs. gebautes JS; Pin-Mechanik an Monorepo-Tag im `vendor-neurovim.mjs`.
- **Kit-first:** vor Implementierung `REGISTRY.md`/`obsidian-kit` prüfen (u.a.
  `mergeSettings`, Settings-API, Obsidian-Mock, Endpoint-/Listen-Editoren) — Übernahme statt
  Neubau, wo passend.
