# Design-Spec — CIPHER Uplink (LLM-Chat + LLM-Debriefing)

**Datum:** 2026-07-14
**Status:** approved (Brainstorm mit Jay)
**Roadmap-Bezug:** neues Feature neben den Roadmap-Blöcken B–E; nutzt Kit-LLM-Bausteine
(`obsidian-kit/pure`: `sse`, `endpoint`, `think-splitter`). Zwei Scheiben: **Scheibe 1 = Chat**
(dieses Feature zuerst), **Scheibe 2 = Debriefing** (gleiche Spec, gestaffelte Umsetzung).

## Ziel

1. **CIPHER-Chat („UPLINK"):** Der Spieler kann CIPHER jederzeit um Rat zur Vim-Bedienung
   fragen — in einem Chat-Bereich der Hub-Pane, während einer Mission direkt per HUD-Button
   erreichbar. CIPHER antwortet als hilfreicher Vim-Tutor in CIPHERs lakonischem
   Cyberpunk-Ton, in der Sprache der Frage.
2. **LLM-Debriefing:** Nach Missionsabschluss streamt eine dynamische, missions- und
   metrik-bezogene Auswertung von CIPHER ins Result-Modal — als Motivationsfaktor zusätzlich
   zur statischen Quote.

Beides ist **strikt optional**: ohne konfigurierten Endpoint verhält sich das Plugin exakt wie
heute (Community-Store-Invariante).

## Entscheidungen (Brainstorm 2026-07-14)

1. **Backend = ein OpenAI-kompatibler Endpoint** (konfigurierbar, optionaler API-Key).
   Deckt LM Studio, Ollama, OpenClaw und Cloud-Proxies (OpenRouter etc.) mit einem Codepfad
   ab — Muster von vault-crews, Kit-Bausteine passen 1:1. Keine nativen Provider-Adapter.
2. **Reihenfolge: Chat zuerst, Debriefing danach** (Jays Wahl), gemeinsame Infrastruktur.
3. **Chat-Ort = Hub-Pane** („UPLINK // CIPHER"-Bereich in der HubView), kein eigener
   View-Typ, kein Modal. HUD-Button öffnet/fokussiert die Pane während der Mission.
4. **Wissensbasis v1 = vorhandener Content:** `REF-EN-Quick_Reference` (10k Zeichen,
   per **exakter ID** selektiert — siehe getManual-Bug unten) + kompakt serialisiertes
   `CHEATSHEET` + aktueller Missionskontext. Guide-Ausbau im Monorepo nur als späterer,
   bedarfsgetriebener Task (YAGNI).
5. **Persona = Tutor mit CIPHER-Flair:** Didaktik schlägt Immersion. Klare, korrekte
   Antworten mit konkreten Tasten, verpackt in CIPHERs Ton. Antwortsprache = Fragesprache.
6. **Off-Topic-Guardrail (Jay):** Fragen ohne Bezug zu Vim, zur aktuellen Mission oder zur
   Plugin-Bedienung lehnt CIPHER in-character ab (sinngemäß *„Focus on the mission,
   operative. Remember what's at stake."*) und bietet stattdessen Vim-Hilfe an.
   Umsetzung als System-Prompt-Regel mit Beispiel-Fällen (kein Code-Filter).
7. **Kein Persistieren des Chat-Verlaufs:** in-memory pro Obsidian-Session, Reset-Button.
8. **Architektur-Ansatz A:** schlanke eigene `src/llm/`-Schicht aus Kit-pure-Bausteinen;
   pure Teile so geschnitten, dass sie später Kit-Kandidaten sind (Promotion erst, wenn in
   ≥2 Repos bewährt — ratifizierter Ökosystem-Weg).

## Ausgangslage / Fundstücke

- CIPHER existiert bereits als Charakter: `core/data/cipher-quotes.ts` (statische Quotes)
  und `core/engine/GuidanceEngine.ts` (diegetische Hilfe). Das LLM-Feature erweitert ein
  bestehendes System dynamisch — statische Quotes bleiben unberührt und sind der Fallback.
- **Bug in vendored `getManual()`** (`content/index.ts`): Selektion per
  `role === 'ref' && id.includes('EN')` matcht `99-THE_RAVEN` (…RAV**EN**) vor
  `REF-EN-Quick_Reference` und liefert das falsche Dokument. vim-dojo umgeht das durch
  Selektion per exakter ID; **Follow-up (nicht Teil dieses Features):** Fix ans
  Monorepo (neurovim-standalone) melden, Re-Vendoring bei nächster Vendor-Aktualisierung.
- Metriken fürs Debriefing liegen vor: `MetricsTracker`/`ParTier` liefern Zeit, Keystrokes,
  Par-Vergleich; ResultModal ist der Anker.

## Komponenten (neu: `src/llm/`, parallel zu `briefing/`, `result/`)

### 1. `cipherPrompt.ts` — pure, TDD

- `buildChatMessages({knowledge, mission, history, question})` → OpenAI-Message-Array.
  System-Prompt = Persona-Regeln (Tutor mit Flair, Antwortsprache = Fragesprache,
  Off-Topic-Guardrail mit Beispielen, keine Story-Spoiler über die aktuelle Mission hinaus)
  + Wissensbasis (Quick-Reference + serialisiertes Cheatsheet) + optionaler Missionskontext
  (Titel, `category`, `why`, `par_keystrokes`).
- `buildDebriefMessages({knowledge, mission, metrics})` → Prompt für Scheibe 2: Missionstitel,
  `category`, `why`, Zeit, Keystrokes vs. Par, Par-Tier, Wiederholungslauf-Flag. Auftrag an
  CIPHER: Leistung in-character kommentieren, Fortschritt würdigen, **genau einen** konkreten
  Verbesserungs-Tipp geben.
- Keine Obsidian-Imports.

### 2. `CipherClient.ts` — schmaler Streaming-Client

- `POST {endpoint}/chat/completions`, `stream: true`; Chunks via Kit-`parseSSE`;
  `<think>`-Blöcke via Kit-`ThinkSplitter` unterdrückt; AbortController für Abbruch.
- Endpoint-Normalisierung via Kit-`normalizeEndpoint`; optionaler `Authorization`-Header.
- Fehler als getypte Ergebnisse (kein Throw ins UI).

### 3. `chatSession.ts` — pure

- In-Memory-Verlauf (Message-Array), `append`/`reset`; Missionskontext wird bei
  Missionsstart gesetzt/aktualisiert und bei Missionsende entfernt.

### 4. UI

- **`CipherChat.tsx`** (Preact) — neuer Bereich `UPLINK // CIPHER` in der HubView, CRT-Stil:
  Verlauf (`CIPHER >` / `YOU >`), Eingabezeile, tokenweises Streaming; Buttons Senden,
  Abbrechen (während Stream), Kanal-Reset. Rendert reines Text-Markup (keine
  Obsidian-Callouts → geringes mix-blend-mode-Risiko; Light-Theme-Check trotzdem Teil
  der Verifikation).
- **HUD-Button `CIPHER`** im Mission-HUD: öffnet/fokussiert die Hub-Pane mit UPLINK-Bereich.
  Nur sichtbar, wenn Endpoint konfiguriert.

### 5. Settings

- Drei neue Felder in `VimDojoSettings`: `llmEndpoint` (Default `""` = Feature aus),
  `llmApiKey` (optional), `llmModel`.
- Settings-Tab-Sektion „CIPHER Uplink (experimental)" mit Hinweis auf OpenAI-kompatible
  Endpoints (LM Studio, Ollama, OpenRouter …) und **Privacy-Hinweis**: Fragen +
  Missionskontext gehen an den konfigurierten Endpoint; Vault-Inhalte außerhalb der
  Mission werden **nie** gesendet (Erweiterung der bestehenden Sicherheits-Invariante,
  wichtig fürs Community-Review).

## Datenfluss (Chat)

```
User-Frage → chatSession.append(user)
  → cipherPrompt.buildChatMessages(knowledge, mission?, history, frage)
  → CipherClient.stream(messages)
      → parseSSE-Chunks → ThinkSplitter → UI rendert tokenweise
  → fertige Antwort → chatSession.append(assistant)
Fehler → in-character Fehlzeile („Signal lost. Check your uplink.") + technisches
Detail dezent darunter; kein Notice-Spam, kein Crash.
```

## Datenfluss (Debriefing, Scheibe 2)

- ResultModal zeigt sofort alles wie heute (Metriken, statische Quote — kein Blocking).
- Endpoint konfiguriert → Bereich `DEBRIEF // CIPHER` erscheint darunter, Auswertung
  streamt hinein (gleicher Client). Fehler/kein Endpoint → Bereich erscheint nicht,
  statische Quote bleibt Fallback. Modal-Close bricht den Stream ab (AbortController).

## Graceful Degradation (Store-Invariante)

Ohne `llmEndpoint`: kein UPLINK-Bereich, kein HUD-Button, kein DEBRIEF-Bereich — Plugin
sieht aus und verhält sich exakt wie heute. Alle LLM-Pfade sind additiv.

## Teststrategie (Vitest, bestehendes Obsidian-Mock-Muster)

- **TDD für alles Pure:** `cipherPrompt` (Persona + Off-Topic-Regel enthalten,
  Missionskontext an/aus, Cheatsheet-Serialisierung, Debrief-Metriken korrekt eingebettet,
  exakte REF-ID-Selektion), `chatSession` (append/reset/Kontextwechsel).
- **`CipherClient`** gegen gemocktes `fetch` mit SSE-Fixtures: Happy Path,
  `<think>`-Filterung, Abbruch, HTTP-Fehler, kaputter Stream.
- **UI-Smoke:** UPLINK rendert nur mit konfiguriertem Endpoint; HUD-Button nur während
  Mission und nur mit Endpoint.
- **Manuelle Verifikation (Jay):** in Obsidian gegen echten lokalen Endpoint
  (LM Studio/Ollama), inkl. Light-Theme-Check.

## Nicht-Ziele (v1)

- Kein Guide-/Content-Ausbau im Monorepo (erst bei nachgewiesenen Lücken).
- Keine Chat-Persistenz über die Obsidian-Session hinaus.
- Keine nativen Provider-Adapter (Anthropic/OpenAI-SDKs), kein Multi-Endpoint-Management.
- Kein RAG/Embedding — die Wissensbasis passt komplett in den System-Prompt (~3–4k Tokens).
- Keine Kit-Promotion in diesem Feature (erst wenn ≥2 Repos das Muster tragen).
