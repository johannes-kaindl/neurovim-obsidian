# Run-Traces & CIPHER-Debriefing — Design

> Datum: 2026-07-23 · Status: approved (Brainstorm mit Jay)
> Scheibe 2 der CIPHER-Story: nach erfolgreichem Submit gibt CIPHER on-demand ein
> sequenz-basiertes Debriefing. Fundament dafür ist ein Keystroke-Recorder, der die
> tatsächliche Tastenfolge (nicht nur den Count) erfasst und lokal persistiert —
> gleichzeitig Datenboden für spätere datengetriebene Missions-Balance.

## Motivation

Das `ResultModal` zeigt heute nur statische Metriken. `RunResult` kennt nur Zahlen
(elapsed_ms, keystrokes, ks_per_min, Deltas), **nicht die Tastenfolge**. Damit kann ein
Debriefing nur kategorie-generisch coachen. Der Recorder hebt diese Einschränkung auf:
CIPHER sieht die echte Sequenz und kann konkret werden („8× `l` statt `3w`").

Zwei Nutzen, ein Fundament:
- **Nutzen A (diese Runde):** CIPHER-Debriefing, nutzt die Sequenz *ephemer* im Modal.
- **Nutzen B (spätere Runde):** Balance-Analyse, nutzt die *persistierten* Traces
  aggregiert über viele Runs. Deckt sich mit dem geplanten Stats-Hub.

Recording und Debriefing sind **entkoppelt**: der Trace wird immer still aufgezeichnet
und persistiert (lokal, kostenlos); der LLM-Call fürs Debrief ist on-demand.

## Sicherheits-Invariante (Store-Konformität)

vim-dojo fasst nie Dateien außerhalb des Mission-Ordners an; persistente Telemetrie in
einem Community-Plugin ist eine Offenlegungs-Frage. Der konforme Pfad:

1. **Lokal** — Traces gehen in `this.manifest.dir/traces.jsonl`, nichts wird automatisch
   gesendet. (Der eigene Plugin-Config-Ordner ist der legitime Speicherort — dort liegt
   auch `data.json`; das ist kein Vault-Content und verletzt die Invariante nicht.)
2. **Gescoped** — Aufzeichnung nur im CM-Mission-Editor, nur bei aktiver Mission. Der
   Recorder erbt die bestehenden, getesteten Guards aus `main.ts:88`
   (`activeMissionId` + `isEditorKeydownTarget`). **Kein** `document`-weiter Logger.
3. **Transparent** — README-Abschnitt + Settings-Toggle „Record run traces".
4. **Netzwerk = bereits offengelegt** — die Sequenz ans LLM zu schicken ist dieselbe
   Situation wie CIPHER-Chat (User-konfigurierter Endpoint, lokal via LM Studio/Ollama
   möglich). Keine neue Risiko-Kategorie gegenüber 0.4.x.

Das eine echte Rest-Risiko ist ein *Bug*: würde der Recorder außerhalb der Mission Tasten
fangen, wäre das real problematisch. Deshalb ist der Scope-Test (unten) nicht optional.

Inhaltlich harmlos: erfasst werden Vim-Tasten in einer Wegwerf-Übungsnotiz, nicht die
privaten Notizen des Users.

## Komponenten

Jede Unit hat eine klar umrissene Verantwortung, kommuniziert über ein schmales Interface
und ist isoliert testbar.

| Unit | Datei | Verantwortung | Rein? |
|---|---|---|---|
| `RunRecorder` | `src/keystrokeRecorder.ts` | Sammelt `{k, m, t}`-Events; `record/reset/snapshot`. Lebt neben `metrics`. | ✅ pure |
| `TraceStore` | `src/storage/traceStore.ts` | Append-only JSONL in `this.manifest.dir/traces.jsonl` via `vault.adapter`. Injizierbar. | Port |
| `buildDebriefMessages` | `src/llm/debriefPrompt.ts` | `(trace, mission, knowledge) → LlmMessage[]`. Wiederverwendet CIPHER-PERSONA + Knowledge. | ✅ pure |
| Result-Modal-Erweiterung | `src/result/ResultModal.tsx` | `> DEBRIEF ANFORDERN`-Button + Stream-Bereich. Nutzt bestehenden `CipherClient` + `XhrSseTransport`. | — |

Neuer Code ist bewusst klein: Recording ist ein Push an einer bestehenden Zeile; das
LLM-Streaming nutzt vollständig die 0.4.x-Infra.

## Datenschema

`RunRecorder` sammelt Events:

```ts
interface TraceEvent { k: string; m?: string; t: number } // t = ms relativ zum Mission-Start
```

Bei erfolgreichem Submit entsteht ein `RunTrace` (Metriken aus `RunResult` + Events):

```ts
interface RunTrace {
  mission_id: string;
  ts: string;            // ISO-Zeitstempel des Submits
  outcome: 'success';    // v1 nur Erfolge; Fehlschläge = spätere Runde
  elapsed_ms: number;
  keystrokes: number;
  ks_per_min: number;
  par_keystrokes: number | null;
  is_new_best_time: boolean;
  is_new_best_ks: boolean;
  events: TraceEvent[];
}
```

Persistenz: **eine JSONL-Zeile pro Run**, append-only, in `traces.jsonl` im Plugin-Config-Dir.
Export = Datei kopieren. Spielstand (`data.json`) und Rohdaten (`traces.jsonl`) bleiben
getrennt.

## Datenfluss

1. **Mission-Start** → `recorder.reset()`.
2. **keydown** (capture-phase, `main.ts:88`) → wenn `countsAsKeystroke` &&
   `isEditorKeydownTarget`: `metrics.addKeystroke()` **+** `recorder.record(key, mode, t)`.
   `t` relativ zum Mission-Start über `ClockPort`.
3. **Submit erfolgreich** → `RunTrace` aus `recorder.snapshot()` + `RunResult`.
   `traceStore.append(trace)` läuft **immer, still**. `ResultModal` öffnet mit
   `view` + `trace` + CIPHER-Dependencies.
4. **User klickt DEBRIEF** → `buildDebriefMessages(...)` → `CipherClient.stream(...)`
   → streamt in den Modal-Bereich. Kein Endpoint konfiguriert → Button zeigt Hinweis
   statt eines Calls.
5. **Reset/End** → `recorder.reset()`.

## CIPHER-Debrief-Prompt & Ton

`buildDebriefMessages` baut `LlmMessage[]` analog zu `buildChatMessages`: CIPHER-PERSONA +
Mission-Context + serialisierte Sequenz + Metriken (keystrokes vs. par, Zeit). Kein hartes
if/else im Code — der Prompt weist CIPHER an, den **Ton an die Performance zu adaptieren**:

- NEW BEST / unter par → knapper in-character Glückwunsch.
- deutlich über par → konkreter, sequenz-basierter Tipp
  („du bist mit `llllllll` zu Wort 3 gelaufen — `3w` wäre eine Bewegung gewesen").

Adaption macht das LLM; der Code bleibt *ein* Prompt. Die Off-Topic- und
Spoiler-Guardrails der PERSONA bleiben erhalten.

## Fehler- & Randfälle

- **Kein Endpoint / leere Modell-Config:** DEBRIEF-Button zeigt statt eines Calls einen
  Hinweis („Uplink offline — konfiguriere einen Endpoint in den Settings").
- **Stream-Fehler** (`StreamOutcome.ok === false`): De-emphasized Fehlerzeile im
  Debrief-Bereich, Button wieder aktivierbar (Retry). Kein Modal-Crash.
- **Recording-Toggle aus:** kein Recording, keine Persistenz; Debrief-Button entfällt
  (ohne Trace kein sinnvolles sequenz-basiertes Debrief) — Modal wie heute.
- **`traceStore.append` schlägt fehl** (FS-Fehler): still fangen + `console.warn`; der
  Erfolg des Runs (XP etc. bereits persistiert upstream) darf nie an der Telemetrie hängen.
- **Leere Sequenz** (Submit ohne gezählte Tasten, theoretisch): Trace mit `events: []`;
  Debrief bleibt möglich, CIPHER kommentiert dann nur die Metriken.

## Tests

- `RunRecorder` (pure, TDD): record akkumuliert; reset leert; snapshot liefert Kopie;
  `t` monoton via injizierter ClockPort.
- **Scope-Test (Store-Netz):** über die Guard-Funktionen — keydown ohne aktive Mission →
  kein Record; keydown außerhalb `.cm-editor` → kein Record. Beweist die Scope-Invariante.
- `buildDebriefMessages` (pure, TDD): enthält PERSONA, serialisierte Sequenz, Metriken;
  respektiert fehlende `par`.
- `TraceStore` (Port, mit Fake-Adapter): `append` schreibt genau eine JSONL-Zeile;
  mehrere Appends hängen an; FS-Fehler wird gefangen.
- Result-Modal: kein Unit-Test (DOM) — Review-Gate ist das Netz (siehe AGENTS.md).

## Bewusst NICHT in dieser Runde (Scope-Grenze)

- Balance-**Auswertung**/Aggregation/UI → eigene spätere Runde (verschmilzt mit Stats-Hub).
  Heute nur Schema + Wegschreiben.
- **Fehlschlag-/Reset-Traces** → Ausbau (v1 persistiert nur erfolgreiche Runs).
- **Auto-Debrief** → verworfen; on-demand gewählt.

## Offene Entscheidungen (im Brainstorm abgenickt)

- **Vim-Modus im Event:** best-effort. Wenn zuverlässig aus CM6-Vim lesbar, rein; sonst
  fällt `m` weg und CIPHER interpretiert die reine Tastenfolge. Kein Blocker.
- **Nur Erfolge persistieren (v1):** ja.
- **Toggle-Default:** Recording **an** per Default (lokal, harmlos), sichtbar dokumentiert
  → store-konform, weil sichtbar, nicht weil aus.
