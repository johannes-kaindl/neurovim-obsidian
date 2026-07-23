# Mission-Lifecycle — Pause, Präsenz, ehrliche Metriken

**Datum:** 2026-07-23
**Status:** Design approved
**Auslöser:** Vier beim Testen der 0.6.0 gefundene Defekte — Vault-Task `25_Coding/vim-dojo/_Tasks/HINT Bug und VIM Modus Bug.md`

## Motivation

Eine laufende Mission ist heute an nichts gebunden außer an sich selbst. Verlässt man die
Missions-Notiz, läuft die Session unsichtbar weiter: der Timer tickt, Obsidians global
umgeschalteter Vim-Modus bleibt an, und in der fremden Notiz greifen plötzlich `hjkl` statt
Buchstaben. Es gibt keinen Weg zurück außer ABORT, und ABORT ist auch das Einzige, was den
Vim-Modus wieder zurücksetzt.

Aus derselben Wurzel stammt der belegte Datenschaden: ein Lauf, dessen Notiz bereits gelöst war,
wurde mit `KEYSTROKES 0` verbucht und schrieb `best_keystrokes: 0` — ein unschlagbarer Bestwert,
der für eine getippte Lösung unmöglich ist. Die Beweisführung, dass der Zähl-Code gesund ist und
die 0 ein Symptom des Lifecycles, liegt in der Vault-Task-Note und wird hier nicht wiederholt.

Zwei weitere Punkte aus derselben Testrunde sind **keine** Logikfehler, sondern
Wahrnehmungsprobleme, und werden entsprechend anders behandelt — siehe § Befunde.

## Befunde aus der Vorab-Analyse

**„exfil vs exit" ist kein Falschfehler.** Der Screenshot in der Task-Note belegt, dass in der
Notiz tatsächlich `Emergency exit:` stand, während die Lösung `Emergency exfil:` verlangt. Der
Hint hatte recht. Das reale Problem: ein Zeilen-Diff als Fließtext (`Has: … / Should be: …`)
macht einen Drei-Zeichen-Unterschied praktisch unsichtbar, und die rote Zeilenmarkierung bleibt
nach einer Korrektur stehen, bis der nächste Submit sie neu berechnet. Behandelt wird also die
Feedback-Präzision, nicht die Diff-Logik.

**Das unklare Statuszeilen-Objective hat eine Content-Wurzel.** M-02 ist ohne Lösungskenntnis
nicht lösbar: die Solution enthält vier Zeilen, die in der Transmission gar nicht vorkommen —
`Status: RESTORED`, `Drill coordinates: 52.4N / 13.4W`, `Contact codeword: THE DIFF DOES NOT LIE`,
`Response codeword: TRUST THE DIFF`. Das Briefing behauptet sogar, die Koordinaten seien im File
enthalten, nur an falscher Position. Ein Scan über alle 39 Missionen zeigt M-02 als einzige, deren
Lösung länger ist als ihre Transmission; ein Dutzend weitere haben einzelne nicht-ableitbare Zeilen
(grobe Ähnlichkeits-Heuristik, teils Fehlalarme). **Das ist ein Content-Defekt im Monorepo-SSOT
`neurovim-standalone` und ausdrücklich nicht Teil dieser Arbeit** — er bekommt einen eigenen Task
inklusive Audit. Plugin-seitig beantwortet wird nur die Frage „bin ich fertig und wie weit bin
ich?", und zwar rein datengetrieben.

## Zustandsmodell

`MissionSession` bekommt einen expliziten Zustand anstelle des heutigen impliziten
„`_id` ist gesetzt":

| Zustand | Timer | Keystrokes | Vim | Sichtbarkeit |
|---|---|---|---|---|
| `idle` | – | – | Vorzustand | – |
| `active` | läuft | zählen | an (falls `autoVim`) | HUD am Editor + Statusleiste |
| `paused` | steht | zählen **nicht** | Vorzustand wiederhergestellt | Statusleiste, Banner ab Schwelle |

Übergänge:

- `start(id)` → `active`
- Präsenz wechselt auf `away` → `pause()` → `paused`
- Präsenz wechselt auf `focused` → `resume()` → `active`
- Submit-Erfolg oder ABORT → `idle`
- `onunload` bei `active`/`paused` → Vim-Vorzustand wiederherstellen (heute schon vorhanden)

`reset()` ist von der Präsenz unabhängig und lässt den Zustand, wie er ist: Notiz und Metriken
werden zurückgesetzt, der Timer ebenfalls — aber er läuft danach nur wieder an, wenn der Zustand
`active` ist. Ein Reset über den Pane-Button während einer Pause hinterlässt also einen sauber
zurückgesetzten, stehenden Timer.

## Präsenz-Erkennung

Pure Funktion, keine verstreuten Bedingungen:

```ts
resolvePresence(activeNotePath: string | null, missionPath: string | null): 'focused' | 'away'
```

`focused` genau dann, wenn die **aktive** Notiz die Missions-Notiz ist — nicht „irgendwo sichtbar".
Begründung: Obsidians Vim-Modus ist eine globale Einstellung. Sobald der Cursor in einer anderen
Notiz steht, wird dort getippt, und genau dann muss Vim zurück.

Konsequenzen, die so gewollt sind:

- **Split-Layout:** Klick in den anderen Split pausiert, Klick zurück setzt fort. Beides sind
  bewusste Klicks, kein Flackern.
- **Sidebar / Einstellungen / Command-Palette:** pausieren **nicht**. Obsidian behält dort die
  letzte Markdown-Leaf als aktive Datei, die HUD- und Pane-Buttons bleiben also bedienbar.
- **Missions-Notiz geschlossen:** `activeNotePath` ist eine andere oder `null` → `away`. Die
  Mission bleibt pausiert bestehen; RETURN öffnet die Notiz erneut.

Ausgelöst wird die Auswertung von `workspace.on('active-leaf-change')`, mit dem bestehenden
500-ms-Tick als Sicherheitsnetz für Fälle, die kein Event feuern.

## Zeitmessung

`MetricsTracker` ist Vendor-Code (SSOT im Monorepo) und kann nicht pausieren: er rechnet
`Date.now() - _startTime` und kennt nur `start`/`reset`. Statt eines Vendor-Eingriffs bekommt das
Plugin ein eigenes Modul.

```ts
class RunTimer {
  constructor(clock: ClockPort)
  start(): void      // frischer Lauf: Akkumulator auf 0, Segment startet
  pause(): void      // laufendes Segment in den Akkumulator
  resume(): void     // neues Segment
  reset(): void
  elapsedMs(): number  // akkumuliert + (läuft ? jetzt - Segmentstart : 0)
  get running(): boolean
}
```

`pause()` auf einem pausierten Timer und `resume()` auf einem laufenden sind No-Ops — die
Präsenz-Auswertung darf idempotent aufgerufen werden.

`MissionSession` nimmt `RunTimer` für die Zeit und reicht das Ergebnis explizit an
`metrics.getResult(elapsed)`. `MetricsTracker` bleibt für die Keystrokes zuständig und
unangetastet. Nebeneffekt: die Zeitmessung wird durch die injizierte Uhr erstmals unter Vitest
prüfbar — Hauskanon seit 0.4.2 (`ClockPort`).

## Vim-Umschaltung

Der vorhandene `vimRestore`-Latch wird künftig bei jedem `pause()` ausgelöst und bei jedem
`resume()` neu gesetzt, statt nur bei Missionsstart und -ende. Daraus folgt gewolltes Verhalten:
Schaltet man während der Pause selbst Vim ein, merkt sich der Latch beim Fortsetzen genau diesen
Zustand und schaltet ihn beim nächsten Pausieren nicht mehr aus.

## Keystroke-Zählung

Der Capture-Handler prüft künftig `session.state === 'active'` statt nur „Mission existiert".
Damit gibt es kein Zeitfenster mehr, in dem eine Mission tickt, während anderswo getippt wird —
die strukturelle Ursache von `KEYSTROKES 0` entfällt.

## Sichtbarkeit

**Statusleiste (immer, sobald eine Mission existiert).** Ein `addStatusBarItem()` zeigt
`▸ M-02 02:41` im aktiven und `▸ M-02 PAUSED 03:12` im pausierten Zustand. Klick öffnet die
Missions-Notiz, was über die normale Präsenz-Auswertung zum Fortsetzen führt — kein zweiter
Resume-Pfad. Aktualisiert wird das Element vom bestehenden 500-ms-Tick.

**Banner (ab Schwelle).** Dauert eine Pause länger als `pausedBannerMinutes` (neues Setting,
Default 5, `0` schaltet es ab), erscheint zusätzlich ein schwebendes CRT-Banner über dem
Workspace: `M-02 PAUSED — RETURN / ABORT`. Es hängt nicht am Missions-Editor (der ist ja nicht
sichtbar), sondern an einem eigenen Container. RETURN öffnet die Notiz, ABORT beendet die Mission.
Das Banner verschwindet beim Fortsetzen und beim Beenden.

Die Schwellwert-Entscheidung ist eine pure Funktion (`shouldShowPausedBanner(pausedMs, thresholdMinutes)`),
damit sie ohne DOM testbar bleibt.

**HUD im aktiven Zustand** bleibt unverändert am Editor bzw. in der Pane, gesteuert vom
bestehenden `resolveHudTarget`.

## Live-Feedback

**Fortschrittszähler.** Das HUD zeigt `LINES 12/16`. Zähler ist die Anzahl der Zeilen, die an
ihrer Position mit der Lösung übereinstimmen; Nenner ist die Zeilenzahl der **Lösung** — nicht die
der Notiz. Damit zeigt eine Mission, der Zeilen fehlen, ehrlich `12/16` statt fälschlich `12/12`.
Verglichen wird nach demselben `trim()` wie in `getDiff`, damit Zähler und Submit-Ergebnis nie
auseinanderlaufen. Läuft ab Missionsstart live, verrät keine Positionen, nur die Anzahl.

**Zeilenmarkierung.** Die Markierung entsteht weiterhin erst bei einem fehlgeschlagenen Submit —
vor dem ersten Submit ist nichts markiert, die Mission bleibt „finde die Korruption". Neu ist,
dass sie **live neu berechnet** wird: markierte Zeilen verschwinden einzeln, sobald sie mit der
Lösung übereinstimmen. Damit endet der Zustand „ich habe es korrigiert, es bleibt rot".

Technisch wird `diffHighlight` von einer einzelnen Zeile auf ein Set erweitert
(`setDivergentLines(number[])`). Die divergierenden Zeilen liefert das bereits vorhandene
`getDivergentLines` aus dem Vendor-Core; geschnitten wird es mit der Menge der beim letzten
fehlgeschlagenen Submit gemeldeten Zeilen, damit nur bereits Aufgedecktes markiert bleibt.

**Datenquelle.** Beide Anzeigen lesen `cm.state.doc.toString()` synchron aus dem CodeMirror-View
der Missions-Notiz — kein Vault-Read zweimal pro Sekunde. Ist der View nicht verfügbar (Notiz
nicht offen), bleibt der letzte bekannte Stand stehen.

**Hint-Präzision.** Der Hint-Text markiert künftig die abweichende Zeichenfolge, statt beide
Zeilen nur untereinander zu stellen:

```
>_ Line 8 differs

Has:  Emergency ex»it«: Roof access point Charlie
Want: Emergency ex»fil«: Roof access point Charlie
```

Ermittelt wird das über gemeinsames Präfix und Suffix der beiden Zeilen — eine pure Funktion
(`markLineDelta(current, solution)`), die den abweichenden Mittelteil in `»…«` einfasst. Ist der
Mittelteil auf einer Seite leer (reine Einfügung oder Löschung), steht dort ein leeres Paar `»«`
an der Fundstelle, damit sichtbar bleibt, **wo** etwas fehlt oder zu viel ist. Sind beide Zeilen
identisch, gibt die Funktion sie unverändert zurück.
Die Guillemets sind bewusst textuell: der Hint wird in einer Obsidian-`Notice` gerendert, die kein
Markup annimmt.

## Ehrliche Metriken

Ein erfolgreicher Submit mit `keystrokes === 0` gilt als **unverified**: die Lösung wurde
nachweislich nicht getippt (Copy-Paste, bereits gelöste Notiz, Fremd-Sync).

- XP und Completion werden normal verbucht — kein Frust bei Grenzfällen.
- `best_time_ms`, `best_keystrokes` und `best_ks_per_min` bleiben unverändert; `runs` und
  `last_run` werden erhöht. Das umgeht `ProgressionEngine.recordMissionRun`, dessen
  `lower(cur, next) = cur > 0 ? min(cur, next) : next` eine 0 als „noch kein Wert" liest und
  deshalb übernimmt — exakt die Korruption vom 2026-07-23.
- `is_new_best_time` / `is_new_best_ks` sind `false`.
- Das Result-Modal zeigt `UNVERIFIED — not recorded as best`.

Da `RunResult` ein Vendor-Typ ist, wird das Flag plugin-seitig neben dem Ergebnis geführt
(`{ ok: true, result, unverified }`) und an `buildResultView` durchgereicht — kein Vendor-Eingriff.

Der Trace wird weiterhin geschrieben; ein Lauf ohne Tastenfolge ist für die CIPHER-Analyse
wertlos, aber das Debrief bleibt verfügbar und CIPHER sieht am leeren Event-Array selbst, dass
nichts zu analysieren ist.

## Module

| Modul | Art | Verantwortung |
|---|---|---|
| `src/missionPresence.ts` | neu, pure | `resolvePresence` |
| `src/RunTimer.ts` | neu, pure (ClockPort) | pausierbare Laufzeit |
| `src/missionProgress.ts` | neu, pure | `countMatchingLines`, `markLineDelta`, `shouldShowPausedBanner` |
| `src/MissionSession.ts` | erweitert | Zustand, `pause`/`resume`, unverified-Guard |
| `src/diffHighlight.ts` | erweitert | mehrere Zeilen statt einer |
| `src/HudMount.ts` / `MissionHud.tsx` | erweitert | Fortschrittszeile |
| `src/StatusBarItem.ts` | neu, dünn | Statusleisten-Text setzen |
| `src/PausedBanner.ts` | neu, dünn | Banner mounten/entfernen |
| `src/main.ts` | erweitert | Verdrahtung, `active-leaf-change` |
| `src/settings.ts` | erweitert | `pausedBannerMinutes` |

Die beiden dünnen DOM-Module folgen dem Muster von `ObsidianHudDom`: Adapter ohne Logik,
verifiziert im Obsidian-Smoke-Test statt per Unit-Test.

## Tests

TDD für alle puren Module:

- `RunTimer`: Akkumulation über mehrere Pausen, idempotentes `pause`/`resume`, `reset`
- `resolvePresence`: Missions-Notiz aktiv, andere Notiz aktiv, `null`, keine Mission
- `countMatchingLines`: identisch, teilweise, Längenunterschied in beide Richtungen
- `markLineDelta`: Ersetzung in der Mitte, am Anfang, am Ende, reine Einfügung, reine Löschung,
  identische Zeilen
- `shouldShowPausedBanner`: unter/über Schwelle, Schwelle `0`
- `MissionSession`: Zustandsübergänge, Timer stoppt bei Pause, Keystrokes zählen nicht im
  pausierten Zustand, unverified-Guard lässt Bestwerte unangetastet und erhöht `runs`
- `buildResultView`: unverified-Kennzeichnung

Nicht unit-getestet (bewusst, wie bei `ObsidianHudDom`): Statusleiste, Banner-DOM, die
`active-leaf-change`-Verdrahtung. Deren Netz ist der Smoke-Test in Pallas.

## Abgrenzung

Nicht Teil dieser Arbeit:

- **M-02-Content-Defekt** und der Audit der übrigen Missionen — eigener Task im Monorepo
  `neurovim-standalone`, danach `npm run vendor`.
- **Kuratiertes Objectives-Panel** in der Seitenleiste — durch den datengetriebenen
  Fortschrittszähler vorerst ersetzt; wieder aufgreifen, falls sich das als zu wenig erweist.
- **Timer-Pause im Lesemodus** — geparkte Feature-Idee, überschneidet sich thematisch, aber der
  Auslöser ist ein anderer (Modus statt Notiz-Präsenz).
- **Vim-Modus-Erfassung im Trace** (`recorder.record(key, mode)`) — weiterhin vertagt.
