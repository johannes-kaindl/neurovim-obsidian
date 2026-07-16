# Settings-UI-Overhaul + Multi-Endpoint-Fallback

**Datum:** 2026-07-16
**Status:** Design approved, in Umsetzung
**Ziel-Release:** 0.5.0
**Vorgänger:** CIPHER Uplink (`2026-07-14-cipher-uplink-design.md`) + Polish (`2026-07-15-cipher-uplink-polish-design.md`)

## Motivation

Die Settings sind eine flache Liste aus neun Einträgen ohne Gliederung: erst fünf Basis-Settings,
dann der lange CIPHER-Block. Nachbar-Plugins (vault-rag) gliedern längst in einklappbare Sektionen —
das Muster liegt fertig im Kit.

Zweiter Treiber: der CIPHER-Endpoint ist ein einzelnes Textfeld. Ein lokaler LLM-Endpoint wechselt
aber mit dem Netz (`localhost` am Host vs. LAN-IP unterwegs). Heute muss Jay das Feld von Hand
umschreiben, sobald er den Rechner wechselt. Das Kit löst genau das mit `resolveActiveEndpoint`:
eine geordnete Liste deckt alle Netze mit *einer* gesyncten Config ab, der erste erreichbare gewinnt.

Dritter Treiber: zwei Kit-QoL-Module liegen ungenutzt herum, obwohl vim-dojo LLM-Code hat —
`reasoning.ts` (Thinking-Suppression) und `model-context.ts` (Kontextlängen).

**Kit-first-Bilanz (AGENTS.md §1):** Dieses Vorhaben baut fast nichts neu. Übernommen werden
`collapsibleSection` (Kit 0.13.0), `resolveActiveEndpoint`/`parseEndpointList` (bereits vendored),
`reasoning.ts`, `model-context.ts`; als Vorlagen dienen `endpoint-editor-model.ts` (vault-crews),
`migrateEndpointList` (vault-rag) und `reasoning_toggle.ts` (image-to-markdown).

## Nicht-Ziele (YAGNI)

- **Reasoning-Anzeige im Chat.** CIPHER ist eine Story-Figur; beim Denken zuzusehen bricht die
  Immersion. Reasoning wird wie bisher verworfen (`CipherClient.ts`).
- **Toggle im Chat-Header** (i2m-Form). Die Einstellung gehört zur Endpoint-Konfiguration, nicht
  zum einzelnen Gespräch.
- **Modell pro Endpoint.** Die Liste bildet *dasselbe* Backend in verschiedenen Netzen ab — ein
  globales Modell-Feld genügt. Ein Modell je Endpoint wäre ein anderes Feature (Multi-Provider).
- **Manuelles Umschalten des aktiven Endpoints.** Auflösung ist automatisch (erster erreichbarer);
  die UI *zeigt* den aktiven nur an.

## Design

### 1. Einklappbare Sektionen

`SettingsTab.display()` baut drei Sektionen über `collapsibleSection` (vendored):

| Sektion | Key | Default | Inhalt |
|---|---|---|---|
| Missions | `missions` | offen | Mission folder, Auto Vim mode, Open pane on startup |
| Appearance | `appearance` | zu | HUD placement, CRT color scheme |
| CIPHER uplink (experimental) | `cipher` | zu | kompletter LLM-Block |

Der Auf-/Zu-Zustand persistiert in `uiCollapsed: Record<string, boolean>` über einen
`CollapsibleStorage`-Adapter (Vorbild vault-rag: `settings.uiCollapsed`).

**Warum Persistenz nicht optional ist:** `display()` rendert die Seite nach jedem „Test connection"
komplett neu. Ohne gespeicherten Zustand klappt die CIPHER-Sektion genau dann zu, wenn der Nutzer
das Testergebnis lesen will.

`COLLAPSIBLE_CSS` (nur Theme-Variablen) wandert nach `styles.css` — das Kit injiziert bewusst kein
CSS. Der Settings-Tab bleibt nativ gestylt (UI-STANDARD); das CRT-Schema gilt nur in der Plugin-Pane.

### 2. Multi-Endpoint-Fallback

**Datenmodell:** `llmEndpoint: string` → `llmEndpoints: string[]` (geordnet, erster erreichbarer
gewinnt).

**Editor-UI** (dritte Instanz des REGISTRY-Musters, Zeile 81): eine Zeile je Endpoint plus eine
leere Adder-Zeile am Ende; Provider-Presets als Ein-Klick-Buttons hängen an die Liste an;
Eingabewarnungen (`validateEndpointInput`) je Zeile; „Test all" probt alle Zeilen und markiert die
erste erreichbare als aktiv.

**Pure Logik** in `src/llm/endpointEditor.ts`, verbatim-nah an vault-crews'
`endpoint-editor-model.ts`:
- `applyEndpointEdit(list, index, value, isAdder)` — Zeilen-Edit (leeren = löschen, Adder = anhängen,
  nie Leereinträge persistieren)
- `activeIndexFromStatuses(statuses)` — Index der ersten `ok`-Zeile, sonst `-1`; spiegelt exakt die
  `resolveActiveEndpoint`-Semantik

**Laufzeit-Failover** (das Kit überlässt die Orchestrierung explizit dem Aufrufer) in
`src/llm/endpointResolver.ts`:
- `resolveActiveEndpoint(settings.llmEndpoints, ping)` mit `ping` = HEAD/GET auf `/v1/models`
  (Reuse von `probeEndpoint`, auf `status.reachable` reduziert)
- Ergebnis wird für die Dauer der Obsidian-Session gecacht (ein Resolver-Lauf je Chat-Start, nicht
  je Nachricht — sonst zahlt jede Frage den Ping)
- Bei einem Request-Fehler auf dem gecachten Endpoint: Cache invalidieren, **einmal** neu auflösen,
  Request wiederholen. Schlägt auch das fehl, greift die bestehende Fehlerbehandlung.
- Auflösung ergibt `null` (kein Endpoint erreichbar) → dieselbe „uplink offline"-Behandlung wie heute
  bei unerreichbarem Einzel-Endpoint.

**Feature-Gate:** `isLlmConfigured` prüft künftig `llmEndpoints.length > 0 && llmModel !== ''`
(statt `llmEndpoint !== ''`). Es bleibt eine reine Konfigurations-Prüfung — Erreichbarkeit wird
bewusst nicht geprüft, sonst wäre der Chat bei totem Endpoint unsichtbar statt fehlermeldend.

### 3. Thinking-Toggle

Neues Setting `llmSuppressThinking: boolean` (Default `true` — lokale Modelle antworten für kurze
Vim-Tipps spürbar schneller).

Pure Schicht `src/llm/thinkToggle.ts` nach i2m-Vorbild:
- `effectiveSuppress(model, suppress)` → unterdrückt nur, wenn der Nutzer es will **und** das Modell
  abschaltbar ist. gpt-oss/harmony akzeptieren `reasoning_effort:"none"` nicht (`isAlwaysOnThinker`).
- `thinkToggleState(model, suppress)` → `{ desc, disabled }` für die Render-Schicht; bei Always-On-
  Modellen deaktiviert und als „always on" beschriftet.

`CipherClient` merged `suppressParams(effectiveSuppress(model, s.llmSuppressThinking))` in den
Request-Body. Reasoning wird weiterhin verworfen.

### 4. Kontextlänge

`src/llm/modelContext.ts` → `probeModelContext(endpoint, apiKey, model): Promise<number | null>`,
Vorbild `vault-crews/src/core/local-llm-client.ts`:
1. LM Studio: `GET /api/v0/models` → `parseLmStudioContext(json, model)` →
   `loadedContextLength ?? maxContextLength`
2. Fallback Ollama: `POST /api/show` → `parseOllamaContext(json)` → `maxContextLength`
3. Sonst `null`

Wirft nie (wie `probeEndpoint`: `requestUrl` mit `throw:false`, Timeout → `null`). Aufgerufen beim
Verbindungstest und bei Modellwechsel, angezeigt am Modell-Feld als „Context: 32,768 tokens".
`null` → es wird schlicht nichts angezeigt (nicht jeder Endpoint kann das).

## Datenmodell & Migration

```ts
export interface VimDojoSettings {
  // unverändert: missionFolder, hudPlacement, colorScheme, autoVim, openPaneOnStartup
  llmEndpoints: string[];                 // NEU (ersetzt llmEndpoint: string)
  llmApiKey: string;
  llmModel: string;
  llmSuppressThinking: boolean;           // NEU, Default true
  uiCollapsed: Record<string, boolean>;   // NEU, Default {}
}
```

Migration in `src/settings.ts`, pure und getestet (Vorbild vault-rag `migrateEndpointList`):

```ts
export function migrateEndpointList(single: string | undefined, list: string[] | undefined): string[] {
  if (list && list.length) return list.filter((e) => e && e.trim());
  if (single && single.trim()) return [single.trim()];
  return [];
}
```

Angewandt beim Laden auf das rohe `data.json`, **bevor** die Defaults gemerged werden. Das alte
`llmEndpoint`-Feld wird nach der Migration nicht mehr gelesen und nicht mehr geschrieben; ein
Downgrade auf 0.4.x verlöre die Endpoint-Config (aber kein XP) — akzeptabel für ein Opt-in-Feature.

**Shallow-Merge-Rand:** `uiCollapsed` ist ein Objekt. Beim Shallow-Merge gewinnt der rohe Wert als
Ganzes; das ist korrekt (keine Default-Keys, die überleben müssten).

## Tests (TDD)

Neu, alles pure und node-testbar:
- `migrateEndpointList` — Liste gewinnt, Single-Fallback, leer/whitespace → `[]`
- `applyEndpointEdit` — Adder hängt an, leerer Adder = No-Op, geleerte Zeile entfernt, Ersetzen an
  Ort und Stelle, nie Leereinträge
- `activeIndexFromStatuses` — erste `ok` gewinnt, keine `ok` → `-1`, `null`-Einträge
- `effectiveSuppress` / `thinkToggleState` — Always-On-Modell nie unterdrückt + Toggle disabled
- `probeModelContext` — LM-Studio-Parse, Ollama-Fallback, beide fehlschlagend → `null` (mit
  gemocktem `requestUrl`)
- `resolveActiveEndpoint`-Verdrahtung — Failover auf den zweiten Endpoint, Cache-Invalidierung nach
  Fehler, kein zweiter Retry
- `CipherClient` — Request-Body enthält Suppress-Params bzw. enthält sie nicht

Vendor-Code wird **nicht** doppelt getestet (verbatim Snapshot, im Kit abgedeckt).

Zusätzlich GUI-Smoke in Obsidian (Sektionen auf/zu + Persistenz über Re-Render, Endpoint-Zeilen
hinzufügen/löschen, Test all, Failover mit abgeschaltetem ersten Endpoint).

## Vendoring

Aus `obsidian-kit@0.14.0` (`644603c` — bereits gepinnt) zusätzlich nach `src/vendor/kit/`:
`obsidian/collapsible.ts`, `pure/reasoning.ts`, `pure/model-context.ts`. `VENDOR.json` fortschreiben.

## Abschluss

- **REGISTRY.md:** vim-dojo als Consumer bei `collapsibleSection` (Zeile 76) eintragen;
  Endpoint-Listen-Editor (Zeile 81) → **dritte Instanz, Regel der Drei erfüllt** → Status auf
  Kit-Kandidat mit fälliger Kit-Bewertung; Thinking-Toggle-App-Schicht → zweite Instanz (i2m +
  vim-dojo); Zeile 82 (Single-Endpoint-QoL) auflösen — vim-dojo ist kein Single-Endpoint-Plugin mehr.
- **README** (Configuration-Sektion) + **CHANGELOG**, Release `npm run release 0.5.0`.
</content>
</invoke>
