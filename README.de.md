# NeuroVim (vim-dojo)

> [🇬🇧 English](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/README.md) · 🇩🇪 Deutsch

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/LICENSE)
[![Docs: CC BY-SA 4.0](https://img.shields.io/badge/docs-CC%20BY--SA%204.0-lightgrey.svg)](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/LICENSE-DOCS)
[![Release](https://img.shields.io/gitea/v/release/jkaindl/neurovim-obsidian?gitea_url=https%3A%2F%2Fgit.jkaindl.de&label=release)](https://git.jkaindl.de/jkaindl/neurovim-obsidian/releases)
[![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22neurovim%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=neurovim)
![Platform](https://img.shields.io/badge/platform-Obsidian%201.7.2%2B%20·%20desktop%20%26%20mobile-7c3aed)

> Lerne Vim, indem du einen Cyberpunk-Agententhriller spielst — mitten in Obsidian.

Ein KI-Handler namens **CIPHER** vergibt „Missionen", die in Wahrheit Vim-Übungen sind:
CORP-korrumpierte Transmissionen wiederherstellen, die Uhr schlagen, XP verdienen. Du lernst
Vim fast nebenbei; die Geschichte ist der Haken.

NeuroVim begann als Obsidian-Plugin, wuchs dann zu einem Multi-Target-Spiel heran
([`neurovim-standalone`](https://git.jkaindl.de/jkaindl/NeuroVIM): Web + Desktop + Obsidian).
**vim-dojo** holt es als eigenständiges, vollwertiges Obsidian-Plugin zurück nach Hause.

## Funktionen

- **54 spielbare Missionen** über zwei Story-Bögen — 40 Story-Transmissionen und 14 Katas,
  jede davon eine Vim-Übung im Gewand eines Reparaturauftrags. Missionen schalten sich mit
  steigendem Level frei.
- **Echtes Vim, echte Notizen.** Missionen materialisieren als Wegwerf-Notizen, die du mit
  Obsidians eigenem Vim-Modus bearbeitest — kein Simulator, kein Sandbox-Widget.
- **Missions-HUD** mit Live-Zeilenfortschritt, verstrichener Zeit, Tastenanschlägen und einer
  Diff-Markierung, die jede Zeile in dem Moment freigibt, in dem sie stimmt.
- **Hinweise auf Abruf** — zeichengenau, sie zeigen exakt, wo deine Zeile abweicht
  (`ex»it«` statt `ex»fil«`).
- **XP, Level und Bestwerte** pro Mission (Zeit und Tastenanschläge), sodass eine bereits
  gelöste Mission zum Speedrun-Ziel wird.
- **Pausensicher.** Verlässt du die Missionsnotiz, stoppt die Uhr, der Vim-Modus wird
  zurückgesetzt, und ein Banner bietet RETURN oder ABORT — keine Phantom-Tastenanschläge
  durch Tippen an anderer Stelle.
- **CIPHER-Uplink** (optional) — Vim-Rat in Rolle und Debriefings nach dem Lauf, geliefert von
  jedem OpenAI-kompatiblen LLM-Endpunkt, auch einem rein lokalen.
- **Spickzettel** — eine durchsuchbare Vim-Referenz direkt im Plugin-Bereich.

## Voraussetzungen

- **Obsidian 1.7.2 oder neuer**, Desktop oder Mobil.
- **Obsidians Vim-Modus** (Einstellungen → Editor → Vim-Tastenbelegung) für das gedachte
  Erlebnis. Ohne ihn funktioniert das Spiel zwar weiterhin — du reparierst Transmissionen
  dann nur ohne Vim-Tastenbelegung, was den Sinn der Sache verfehlt.
- **Optional, nur für CIPHER:** ein OpenAI-kompatibler Endpunkt (LM Studio, Ollama,
  OpenRouter, …). Lässt du die Endpunktliste leer, bleibt die Funktion vollständig aus. Wie
  du einen lokalen LLM-Server aufsetzt, steht zentral im
  [Setup-Guide für lokale LLMs](https://uplink.jkaindl.de/llm-setup) — inklusive der
  `/v1`-Falle und dem Zugriff vom Handy auf den Rechner.

## Installation

**Aus dem Community-Store:** Einstellungen → Community-Plugins → Durchsuchen → „NeuroVim"
suchen → Installieren → Aktivieren.

**Manuell, aus einem Release:** `main.js`, `manifest.json` und `styles.css` aus dem
[neuesten Release](https://git.jkaindl.de/jkaindl/neurovim-obsidian/releases) nach
`<vault>/.obsidian/plugins/neurovim/` legen und NeuroVim unter Community-Plugins aktivieren.

Das Bauen aus dem Quelltext ist unter [Entwickeln / aus dem Quelltext bauen](#entwickeln--aus-dem-quelltext-bauen) beschrieben.

## Verwendung

Öffne den Bereich über das Terminal-Symbol in der Seitenleiste oder den Befehl
**NeuroVim: Open**. Er ist in Reiter gegliedert:

- **NEXUS** — dein Status (Level/XP), die Willkommens-Transmission und ein Knopf für die
  nächste Mission.
- **MISSIONS** — die vollständige Missionsliste.
- **GUIDE** — ein durchsuchbarer Vim-Spickzettel (nach Taste oder Beschreibung filtern).
- **UPLINK** — der CIPHER-Chat (erscheint, sobald ein Endpunkt konfiguriert ist).

Eine Mission läuft so ab:

1. Wähle eine Mission (oder nimm „nächste Mission"). Ein Briefing erklärt das Ziel;
   **BEGIN MISSION** materialisiert die Transmission als Notiz und startet die Uhr.
2. Repariere die korrumpierten Zeilen in der Notiz mit Vim. Das HUD verfolgt Fortschritt,
   Zeit und Tastenanschläge; **HINT** zeigt auf die erste noch abweichende Zeile.
3. **SUBMIT**, sobald der Text stimmt. Du erhältst XP, Zeit und Tastenanschläge werden
   festgehalten — sie später zu unterbieten, ist das eigentliche Spiel.

Verfügbare Befehle in der Palette: **NeuroVim: Open**, **NeuroVim: Submit mission**,
**NeuroVim: Reset mission**.

## Konfiguration

Einstellungen → NeuroVim, gegliedert in **Missions**, **Appearance** und **CIPHER uplink**;
jede Gruppe merkt sich, ob du sie offen oder geschlossen gelassen hast.

### Missionen

- **Mission folder** — wo Wegwerf-Missionsnotizen angelegt werden (Vorgabe `_neurovim/`).
- **Auto Vim mode** — schaltet Obsidians Vim-Modus ein, solange eine Mission läuft, und
  stellt deine vorherige Einstellung danach wieder her. Beachte: das ändert für diese Dauer
  deine *globale* Editor-Einstellung.
- **Open pane on startup** — standardmäßig aus; der Bereich öffnet sich nur auf Zuruf.
- **Paused reminder after** — Minuten, die eine pausierte Mission ruhen darf, bevor die
  schwebende Erinnerung erscheint; `0` schaltet sie ab. In der Statusleiste erscheint eine
  pausierte Mission ohnehin immer.
- **Record run traces** — siehe [Aufzeichnungen & Privatsphäre](#aufzeichnungen--privatsphäre).

### Darstellung

- **HUD placement** — wo die Missionssteuerung (Uhr, Submit/Reset/Abort) während einer
  Mission erscheint. Der schwebende Kasten lässt sich pro Mission über sein ×-Symbol
  schließen.
- **CRT color scheme** — an: ein fester Cyberpunk-Look (dunkler Hintergrund, Phosphorgrün),
  themenunabhängig und immer lesbar. Aus: adaptive Farben, die sich in dein helles oder
  dunkles Obsidian-Theme einfügen.

### CIPHER-Uplink

- **Endpoints** — eine geordnete Liste statt einer einzelnen URL. Der erste erreichbare
  Endpunkt gewinnt, sodass eine synchronisierte Liste denselben lokalen LLM-Server abdeckt,
  der am Schreibtisch als `localhost` und unterwegs als LAN-IP auftaucht. Endpunkte lassen
  sich über Vorlagen oder durch Eintippen einer URL hinzufügen; „Test all" prüft jeden
  Eintrag und markiert den aktiven. Bestehende Einzel-Endpunkt-Konfigurationen aus 0.4.x
  werden automatisch migriert — beim Update ist nichts zu tun.
- **Model** — aus einer Liste gewählt, die der aktive Endpunkt über `/v1/models` liefert, mit
  freier Texteingabe als Rückfallebene, falls die Liste leer oder der Endpunkt nicht
  erreichbar ist. Meldet der Endpunkt sie (LM Studio, Ollama), wird die Kontextlänge des
  Modells daneben angezeigt.
- **Model thinking** — standardmäßig aus, das ist der schnellere Weg: CIPHER antwortet
  direkt, statt zu überlegen. Schalte es ein, wenn das Modell vor der Antwort nachdenken
  soll. Modelle, die immer denken (gpt-oss/harmony), werden erkannt; der Schalter
  deaktiviert sich dann mit einer Erklärung, weil er daran ohnehin nichts ändern kann.
- **API key** — optional, für Endpunkte, die einen verlangen.

## Funktionsweise

- **Der Inhalt steckt im Plugin** — die Geschichte wird *erspielt*, nicht durch Dateien im
  Vault vorweggenommen. Missionen schalten sich nach und nach mit dem Level frei.
- **Menüs, Story und Fortschritt leben im Plugin-Bereich** (NEXUS). XP und Bestzeiten
  speichert das Plugin selbst (`data.json`).
- **Missionen materialisieren als Wegwerf-Notizen** in einem Ordner deiner Wahl (Vorgabe
  `_neurovim/`). Du reparierst die Transmission in einer **echten Obsidian-Notiz mit echtem
  Vim-Modus**. Eine Missionsnotiz — oder den ganzen Ordner — zu löschen, kostet keinen
  Fortschritt; die nächste Mission legt sie neu an. (Passt zur Lore: Transmissionen sind
  flüchtig.)

Das Plugin **fasst niemals Dateien außerhalb des konfigurierten Missionsordners an.**

## CIPHER-Uplink (experimentell, optional)

Frag CIPHER um Vim-Rat — in Rolle, betrieben von jedem OpenAI-kompatiblen Endpunkt
(LM Studio, Ollama, OpenRouter, …). Endpunkt und Modell stellst du unter
Einstellungen → NeuroVim → CIPHER uplink ein; lässt du die Endpunktliste leer, bleibt die
Funktion vollständig aus. Während einer Mission bekommt das HUD einen CIPHER-Knopf, der den
Uplink mit dem Kontext der Mission öffnet.

Privatsphäre: Deine Fragen und die Metadaten der aktiven Mission (Titel, Kategorie, Ziel)
gehen an den Endpunkt, den du konfiguriert hast — niemals sonstige Vault-Inhalte.

## Aufzeichnungen & Privatsphäre

NeuroVim kann die Tastenfolge jeder erfolgreichen Mission in eine lokale Datei schreiben
(`traces.jsonl`, im Plugin-Ordner). Das speist CIPHERs Debriefing („du bist mit `l l l` zu
Wort 3 gelaufen — `3w` ist ein einziger Sprung") und erlaubt es, die Missionsbalance offline
auszuwerten.

- **Nur lokal.** Aufzeichnungen landen im Plugin-Ordner deines Vaults und werden nirgendwohin
  automatisch gesendet. Forderst du ein CIPHER-Debriefing an, geht die Sequenz dieses Laufs
  an den von dir konfigurierten LLM-Endpunkt (ein lokales Modell via LM Studio/Ollama bleibt
  auf deinem Rechner) — dieselbe Verbindung, die der CIPHER-Chat ohnehin nutzt.
- **Eng begrenzt.** Aufgezeichnet werden nur Tastenanschläge im Editor einer aktiven Mission.
  Nichts sonst in deinem Vault wird berührt.
- **Abschaltbar.** In den Einstellungen unter „Record run traces" ausschalten. `traces.jsonl`
  kannst du jederzeit löschen.

## Entwickeln / aus dem Quelltext bauen

```bash
npm install
npm run vendor    # Snapshot von @neurovim/core + @neurovim/content aus dem Monorepo ziehen
npm run build     # → main.js
npm run gate      # Lint + Typecheck + Tests
```

`npm run vendor` liest das Monorepo aus `NEUROVIM_MONOREPO` (Vorgabe: der Maintainer-Checkout
von `neurovim-standalone` unter `../../neurovim-standalone` relativ zu diesem Repo —
Variable setzen, falls deiner woanders liegt) und schreibt einen gepinnten Snapshot nach
`src/vendor/neurovim/` (siehe `src/vendor/neurovim/VENDOR.json`). Das Monorepo bleibt die
einzige Quelle der Wahrheit für Spiellogik und Inhalte.

`npm run lint` führt `eslint-plugin-obsidianmd` aus — dasselbe Regelwerk, mit dem der
Community-Store prüft — bei `--max-warnings 0`. Manueller Smoke-Test:
[`docs/SMOKE-TEST.md`](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/docs/SMOKE-TEST.md).

Vor einem Pull Request bitte
[`CONTRIBUTING.md`](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/CONTRIBUTING.md)
lesen — vor allem, welche Änderungen hierher gehören und welche ins Monorepo. Architektur,
Konventionen und bekannte Fallstricke stehen in
[`AGENTS.md`](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/AGENTS.md).

## Release

`npm run release <version>` folgt dem Dual-Push-Ablauf des Ökosystems (Forgejo als origin +
GitHub-Spiegel; der Tag auf GitHub stößt den Community-Store-Release an). Das Release-Werkzeug
selbst liegt zentral in `../tools/release/`, ein Release verlangt also, dass das Repo im
`obsidian-plugins/`-Arbeitsbereich liegt; Bauen und Testen funktionieren auch in einem
alleinstehenden Clone. Einmalige Voraussetzungen: ein Forgejo-Repo als `origin`, ein
`github`-Remote (`git remote add github git@github.com:<owner>/<repo>.git`) und
`~/.forgejo-token`.

## Sicherheit

Das Plugin fasst keine Dateien außerhalb des konfigurierten Missionsordners an und stellt
keine Netzwerkanfragen, solange kein CIPHER-Endpunkt konfiguriert ist. Was aufgezeichnet wird,
was wohin gesendet wird und wie du eine Sicherheitslücke vertraulich meldest:
[`SECURITY.md`](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/SECURITY.md).

## Lizenz

- **Code:** [GNU AGPL-3.0-or-later](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/LICENSE).
- **Dokumentation & Texte:** [CC BY-SA 4.0](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/LICENSE-DOCS).
- **Missionen und Erzählung:** stammen aus dem [Monorepo](https://git.jkaindl.de/jkaindl/NeuroVIM)
  unter CC BY-SA 4.0.

Für Verwendungen, zu denen die AGPL nicht passt, gibt es eine kommerzielle Lizenz — siehe
[`LICENSING.md`](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/LICENSING.md).
