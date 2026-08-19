# GUI-Smoke — NeuroVim

Prüfpunkte, die gegen ein **laufendes** Obsidian gefahren werden, nicht gegen einen Mock.
Was hier steht, kann die vitest-Suite strukturell nicht sehen: echtes Theme-CSS, Obsidians
eigene `<button>`-Defaults, echte Panel-Breiten, echtes Markdown-Rendering.

> **Anlass:** Am 2026-08-15 fand ein Durchklick fünf Darstellungsfehler in THE ARCHIVE.
> 208 grüne Unit-Tests sahen keinen davon — alle fünf saßen in der Naht zum Host.

## Ausführen

```bash
# Einmalig: Obsidian mit offenem Debug-Port (der einzige Handgriff von Hand)
osascript -e 'quit app "Obsidian"'
open -a Obsidian --args --remote-debugging-port=9222

# Bauen + in den Vault legen
OBSIDIAN_PLUGIN_DIR="$VAULT/.obsidian/plugins/neurovim" npm run deploy

# Fahren
npm run smoke:gui -- --vault <vault-name>
npm run smoke:gui -- --vault <vault-name> --reload   # lädt das Plugin vorher neu
```

`--reload` schaltet das Plugin im laufenden Obsidian aus und wieder ein, damit neu
deployter Code übernommen wird — ein Obsidian-Neustart würde den Debug-Port schließen.

## Prüfpunkte

| # | Prüft | Gemessener Effekt |
|---|---|---|
| R2-1 | Tab-Leiste bleibt bei schmaler Sidebar bedienbar | Kein Tab ragt über die Panel-Kante **und** kein Label ist abgeschnitten (`scrollWidth > clientWidth`), bei per `rightSplit.setSize(240)` verschmälerter Sidebar |
| R2-2 | Archiv-Gruppen klappen zu | Karten verschwinden, `aria-expanded=false`, Zähler bleibt im Kopf stehen, Zustand steht in `settings.uiCollapsed` |
| R2-3 | Reader folgt dem CRT-Schema | Hintergrund des Modals **gleich** dem des Hub-Panes — beide aus derselben Palette |
| R2-4 | ASCII-Rahmen brechen nicht um | Gerenderte Zeilenzahl ≤ Textzeilenzahl + 1; dazu: kein sichtbarer Kopier-Knopf |
| R2-5 | Karten richten sich einheitlich aus | Abzeichen der offenen (`<button>`) und der gesperrten (`<div>`) Karte beginnen an derselben x-Position |

**Nicht automatisiert** (bleibt Hand-Runde): „wirkt der Gruppenkopf klickbar?", Ästhetik,
Lesefluss. Der Treiber misst, was mechanisch entscheidbar ist — nicht, was gefällt.

## Warum diese Messungen und nicht die naheliegenden

Drei Prüfpunkte waren im ersten Entwurf **im Defektfall grün**. Die Gegenprobe hat sie
entlarvt; die Korrekturen stehen als Kommentar im Treiber:

- **R2-1** verschmälerte das Panel über `pane.style.width` — wirkungslos, das Blatt bekommt
  seine Breite vom Split. Jetzt über `app.workspace.rightSplit.setSize()`.
- **R2-3** maß die **Titelfarbe**. Die kommt aus `.nv-lore-title`, einer Regel, die es schon
  vor dem Fix gab. Kaputt war der *Rahmen*, also wird jetzt der Hintergrund gegen den des
  Hubs verglichen.
- **R2-4** maß `white-space`. Der Wert stand auch im Defektfall auf `pre` — gebrochen hat es
  am `code` darin. Jetzt wird der Bruch selbst gezählt (gerenderte gegen textliche Zeilen).

Merksatz: **den Schaden messen, nicht die Regel, die ihn beheben soll.**

## Durchläufe

| Datum | Obsidian | Ergebnis | Gegenprobe |
|---|---|---|---|
| 2026-08-16 | 1.13.7 | **8/8** | **3/8** mit ausgebauten Fixes — R2-1/R2-3/R2-4/R2-5 rot mit dem historischen Symptom (Tabs abgeschnitten; Modal `rgb(40,42,55)` gegen Hub `rgb(8,18,12)`; 5 Textzeilen auf 13 gerenderten; Abzeichen 80px gegen 11px). Die drei R2-2-Punkte blieben grün — korrekt, ihr Code war nicht Teil der Gegenprobe. |

Die Gegenprobe deckte außerdem **zwei Mängel im Treiber selbst** auf: `setViewState` in einer
Poll-Schleife erzeugte pro Runde ein weiteres Hub-Blatt (16 verwaiste nach mehreren Läufen),
und nach `enablePlugin` greift `getRightLeaf(false)` eine vom Workspace abgetrennte Hülle, die
ohne Fehler ins Nichts rendert. Beides ist behoben; der Lauf räumt seine Blätter im `finally` ab.

## Abweichungen zur Vorlage (`3d-codeblocks`)

Material für die spätere Kit-Extraktion (Dach-`AGENTS.md`, Extraktions-Schwelle):

- `scripts/lib/cdp.ts` **unverändert** übernommen (Herkunftsstempel in Zeile 1; *seit dem
  Abend des 2026-08-16 nicht mehr im Repo, sondern importiert aus
  `obsidian-plugins/tools/obsidian-cdp/cdp.ts` — Extraktion vollzogen*). Genutzt
  werden `Cdp`, `attachTo`, `closeExtraLeaves`, `pollUntil` — die Notiz-Helfer (`openNote`,
  `reopenNote`, `openExisting`) braucht vim-dojo nicht: geprüft wird eine **Sidebar-View**,
  keine Notiz im Hauptbereich. Das ist der erste sichtbare Schnitt zwischen „Brücke" und
  „Notiz-Werkzeug".
- Neu gegenüber der Vorlage: **`PreconditionError`** — eine verletzte Umgebungsbedingung
  bricht mit Ansage ab, statt rote Prüfpunkte am Plugin zu melden (LESSONS.md 2026-08-14,
  paperless-storage). Kandidat für die Brücke, sobald ein zweites Repo ihn braucht.
- Neu: **`--reload`**. In `3d-codeblocks` steht das Neuladen nur als Snippet in der Anleitung;
  als Schalter im Treiber ist es bei jeder Gegenprobe einen Handgriff weniger.

## R3 — CIPHER-Uplink

Seit Slice A (2026-08-18) kommen Prompt-Bau, Chat-Session und Turn-Choreografie aus
`@neurovim/core`. Hier unten bleibt die **Verdrahtung** (`uplink()` baut den
`CorePortAdapter` aus den Settings) — und die hat in `main.ts` keine Test-Naht: Wäre sie
falsch, blieben alle Kern- und Adapter-Tests grün, weil die ihre Settings vom Test
bekommen statt vom Plugin.

Der Treiber **stubbt den Transport**, statt ein Modell zu befragen: geprüft wird die
Verdrahtung, nicht die Antwortqualität (dafür `scripts/debrief-lab.mjs`). Damit läuft der
Abschnitt auch ohne erreichbaren LLM-Endpunkt. Gepatcht wird nur im Speicher — `data.json`
bleibt unberührt, der Stub wird im `finally` zurückgebaut.

| Prüfpunkt | Was er misst |
|---|---|
| R3-0 Modellwahl erreicht den Transport | `effectiveModel(ep, settings.llmModel)` kommt als `cfg.model` beim Client an |
| R3-1 CUT behält das Teilergebnis und gibt die Eingabe frei | Der abgebrochene Turn behält seine Identität, hängt `— signal cut` an und räumt `busy` ab |
| R3-2 RST leert den Kanal | Der enteignete Turn schreibt nicht mehr in den geleerten Verlauf |
| R3-3 ein voller Turn landet als Antwort | Genau zwei Zeilen: `user`, `assistant` |

**R3-1 ist der eigentliche Punkt.** CUT und RST sehen im Code fast gleich aus, sind aber
zwei Operationen: CUT lässt dem gekillten Turn die Identität (er räumt auf und zeigt sein
Teilergebnis), RST enteignet ihn. Wer beides zu einer Methode zusammenzieht, strandet
`busy` auf `true` und verwirft den Teiltext — beim Umzug in den Kern ist genau das
passiert und nur an einem klemmenden Test aufgefallen.

### Gotcha — die gemeldete Plugin-Version nach `--reload`

`disablePlugin`/`enablePlugin` lädt `main.js` neu, liest `manifest.json` aber **nicht**:
`app.plugins.manifests[id].version` bleibt bis zum nächsten Obsidian-Neustart auf dem
Stand vom App-Start. Gemessen 2026-08-19 (deployt 0.8.0, gemeldet 0.7.5).

Die Nummer taugt deshalb **nicht** als Beleg dafür, welcher Code läuft. Der Treiber
vergleicht sie seit dem mit der `manifest.json` im Repo und meldet den Unterschied als
Hinweis statt als Befund. Wer die Manifest-Version tatsächlich prüfen will (etwa nach
einem `minAppVersion`-Wechsel), braucht einen echten Neustart.
