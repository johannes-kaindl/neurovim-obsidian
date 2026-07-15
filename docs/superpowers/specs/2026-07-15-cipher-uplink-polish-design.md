# Design-Spec — CIPHER Uplink Nachbrenner: Smoke-Findings + Navigation + Settings-QoL

**Datum:** 2026-07-15
**Status:** approved (Smoke-Feedback + Brainstorm mit Jay)
**Roadmap-Bezug:** Nacharbeit auf `feat/cipher-uplink` (vor dem Merge). Zieht Teile von
Roadmap-Block C vor (Cheatsheet-Surfacing als GUIDE-Tab). Basis-Spec:
[[2026-07-14-cipher-uplink-design]].

## Auslöser (Jays Smoke-Test 2026-07-15)

1. Missionstitel laufen in schmaler Sidebar aus dem Button (kein Umbruch).
2. Briefing-Modal unter Jays Kuro-Custom-Theme (Minimal-Abwandlung) kaum lesbar —
   das CRT-Var-Remap reicht nicht, Custom-Themes stechen mit spezifischeren Regeln durch.
3. Pane = nur Missionsliste; CIPHER-Chat (unter ~39 Missionen) und Guide nicht auffindbar;
   kein NEXUS-Start.
4. Settings-UX: kein Verbindungstest, Modellname händisch — Kit/vault-rag-QoL fehlt.

## Entscheidungen

1. **CRT-Prinzip verschärft (Jay):** Im CRT-Scheme werden Farben **hart und element-spezifisch**
   gesetzt (direkte `color`-Regeln auf p/em/strong/li/blockquote/callout-content/-title/code/
   Headings im CRT-Container), zusätzlich zum bestehenden Variablen-Remap. Gilt für
   Briefing-Modal UND (präventiv) Result-Modal. Theme-agnostisch = wirklich theme-agnostisch.
2. **Tab-Navigation in der Pane:** `NEXUS · MISSIONS · GUIDE · UPLINK`.
   - **NEXUS** = Start-Tab: Welcome-Text aus dem Bundle (`getWelcome()`, erstmals gesurfaced)
     + LVL/XP + „▶ nächste Mission"-Button (erste freigeschaltete, noch nicht abgeschlossene).
   - **MISSIONS** = heutige Liste (mit Titel-Umbruch-Fix).
   - **GUIDE** = durchsuchbares Cheatsheet (Jays Wunsch): Filter-Input über das strukturierte
     `CHEATSHEET` (Kategorien → Gruppen → key+description), live gefiltert. Reines Surfacing.
   - **UPLINK** = CIPHER-Chat; Tab nur sichtbar, wenn `isLlmConfigured`.
   - Tab-State lebt in `main.ts` (nicht persistiert), fließt als Prop — konsistent zum
     bestehenden setProps/repaint-Muster.
3. **Settings-QoL (vault-rag-Vorbild, Kit-first):**
   - Kit `endpoint_diagnostics` vendorn (verbatim): `classifyEndpointStatus`,
     `ENDPOINT_PRESETS` (LM Studio/Ollama), `validateEndpointInput`.
   - „Test connection"-Button: Probe `GET /v1/models` → Status-`kind` → **eigene EN-Texte**
     (Kit-Klartexte sind deutsch; vim-dojo ist EN-Store-Plugin — Vendor bleibt verbatim,
     Mapping lebt in vim-dojo).
   - Modell-**Dropdown** via `/v1/models` (Refresh-Button; Freitext-Fallback wenn Endpoint
     nicht erreichbar oder Liste leer).
   - Presets als Ein-Klick-Buttons; nicht-blockierende Eingabe-Warnungen.
   - Weiterhin EIN Endpoint-Feld (kein Multi-Endpoint-Fallback — gemerkt).
4. **Kit-Seeding (Jay):** Was fürs QoL fehlt, wird als Kit-Kandidat in
   `obsidian-plugins/REGISTRY.md` geseedet statt still lokal zu bleiben:
   `listModels`/JsonTransport-Muster + Settings-UI-Patterns (Test-Button, Modell-Dropdown)
   existieren 3× (vault-crews, vault-rag, jetzt vim-dojo) → Kit-Nachzug + Repo-Sweep fällig.

## Gemerkt (nicht dieses Paket)

- GUIDE-Tab: Quick-Reference-Volltext (EN/DE) zusätzlich zum Cheatsheet; ggf. Guide-Ausbau
  im Monorepo (didaktische Erklärtexte).
- Multi-Endpoint-Fallback (`resolveActiveEndpoint`) falls Mehrgeräte-/Netzwechsel-Bedarf.
- `getManual()`-Bug upstream melden (aus Basis-Spec, weiter offen).
- Follow-up-Bündel aus dem Final-Review (tsconfig test-include, stream()-Doc-Kommentare,
  CSS-Kollaps, Endpoint-clear-while-busy, IME-Guard, empty-ok-Entry).

## Nicht-Ziele

- Kein Guide-Content-Nachzug im Monorepo, kein RAG, keine Chat-Persistenz.
- Kein Multi-Endpoint, keine Provider-Adapter.
- Kein Redesign des Mission-Flows — nur Pane-Struktur + Settings + CSS.

## Teststrategie

- **TDD pure:** `filterCheatsheet(cats, query)` (leer/Case-insensitiv/key+description-Match,
  leere Gruppen/Kategorien fallen weg), `nextMission(missions, data)` (unlocked ∧ ¬completed,
  Reihenfolge), `endpointStatusEn(kind)` (vollständige EN-Map), `extractModelIds(body)`
  (valide Liste, kaputte Bodies → []).
- Vendor-Sanity-Test für `endpoint_diagnostics`.
- UI (Tabs/Dropdown) nicht render-getestet (node-Env, Repo-Muster) — Gating-Logik pure.
- Manuelle Verifikation (Jay): Kuro-Theme + Standard-Light, Tabs, Guide-Suche,
  Settings-Test-Button gegen laufendes/gestopptes LM Studio, Modell-Dropdown.
