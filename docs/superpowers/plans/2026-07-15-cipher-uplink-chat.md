# CIPHER Uplink — Scheibe 1: LLM-Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein optionaler „UPLINK // CIPHER"-Chat in der Hub-Pane: Der Spieler fragt CIPHER (LLM über einen OpenAI-kompatiblen Endpoint) um Rat zur Vim-Bedienung — während einer Mission per HUD-Button erreichbar.

**Architecture:** Neue `src/llm/`-Schicht aus vendorten Kit-pure-Bausteinen (`parseSSE`, `ThinkSplitter`, `normalizeEndpoint`). Pure Prompt-Builder (`cipherPrompt.ts`) + pure Session-State (`chatSession.ts`) + schmaler Streaming-Client (`CipherClient.ts`) mit injiziertem XHR-Transport (Obsidians `requestUrl` kann kein Streaming). UI als Preact-Bereich in der bestehenden HubView; Verdrahtung in `main.ts` über das bestehende `repaint()`-Muster (500-ms-Tick rendert Streaming-Fortschritt).

**Tech Stack:** TypeScript, Preact, Obsidian API, Vitest (environment: node, Obsidian-Mock-Alias), esbuild. Vendored: `@neurovim/core+content` (bestehend), `obsidian-kit` (neu, `src/vendor/kit/`).

**Spec:** `docs/superpowers/specs/2026-07-14-cipher-uplink-design.md` (approved). **Scheibe 2 (LLM-Debriefing) ist NICHT Teil dieses Plans** — eigener Folgeplan auf derselben Infrastruktur.

## Global Constraints

- **Strikt optional (Store-Invariante):** `llmEndpoint === ''` (Default) ⇒ kein UPLINK-Bereich, kein HUD-Button. Plugin verhält sich exakt wie heute.
- **Privacy-Invariante:** Nur Chat-Frage, Wissensbasis (gebündelter Content) und Missionskontext (Titel/category/why/par der AKTIVEN Mission) gehen an den Endpoint. Nie Vault-Inhalte, nie der Missions-Notiztext.
- **Kein `fetch` für Streaming:** XHR + `onprogress` ist das Ökosystem-Muster (PROF-OBS-12, wie vault-crews/vault-rag); Non-Streaming-Calls gibt es in v1 nicht.
- **Vendor-Dateien verbatim:** `src/vendor/kit/*` sind unveränderte Kopien aus `obsidian-kit` — nie hand-editieren; Herkunft in `src/vendor/kit/VENDOR.json`.
- **Code-Kommentare englisch** (Repo-Konvention, s. `src/main.ts`), Doku/Commits wie bisher.
- **Tests:** `npx vitest run` (alle), `npm run typecheck` — beides muss nach jedem Task grün sein. Tests liegen flach in `test/` (kein `tests/`-Verzeichnis).
- **LLM-Parameter v1 fest:** `temperature: 0.7`, `max_tokens: 1024`, Hard-Timeout 120 000 ms. Keine Settings dafür (YAGNI).
- **Preact im Node-Test-Env wird nicht gerendert** — UI-Logik, die testbar sein muss, lebt in puren Funktionen/Klassen.

---

### Task 1: obsidian-kit vendorn (`sse`, `think`, `endpoint`)

**Files:**
- Create: `src/vendor/kit/sse.ts` (Kopie von `obsidian-kit/src/pure/sse.ts`)
- Create: `src/vendor/kit/think.ts` (Kopie von `obsidian-kit/src/pure/think-splitter.ts`)
- Create: `src/vendor/kit/endpoint.ts` (Kopie von `obsidian-kit/src/pure/endpoint.ts`)
- Create: `src/vendor/kit/VENDOR.json`
- Test: `test/vendorKit.test.ts`

**Interfaces:**
- Consumes: — (erster Task)
- Produces: `parseSSE(buffer: string): { content: string[]; reasoning: string[]; model?: string; finishReason?: string; rest: string; done: boolean }` · `class ThinkSplitter { push(text: string): { content: string; reasoning: string }; flush(): { content: string; reasoning: string } }` · `normalizeEndpoint(endpoint: string): string` — alle importierbar via relativem Pfad `../vendor/kit/...` (aus `src/llm/`) bzw. `../src/vendor/kit/...` (aus `test/`).

- [ ] **Step 1: Kit-Dateien verbatim kopieren**

```bash
mkdir -p src/vendor/kit
cp /Users/Shared/code/obsidian-plugins/obsidian-kit/src/pure/sse.ts src/vendor/kit/sse.ts
cp /Users/Shared/code/obsidian-plugins/obsidian-kit/src/pure/think-splitter.ts src/vendor/kit/think.ts
cp /Users/Shared/code/obsidian-plugins/obsidian-kit/src/pure/endpoint.ts src/vendor/kit/endpoint.ts
```

(Dateiname `think.ts` statt `think-splitter.ts` folgt dem vault-crews-Vendoring; Inhalt bleibt verbatim.)

- [ ] **Step 2: VENDOR.json schreiben**

`src/vendor/kit/VENDOR.json`:

```json
{
  "source": "obsidian-kit",
  "version": "0.13.0",
  "sha": "80abae9",
  "vendored": "pure/sse.ts, pure/think-splitter.ts (als think.ts), pure/endpoint.ts",
  "note": "Verbatim snapshot. Never hand-edit. Re-copy from obsidian-kit to update."
}
```

- [ ] **Step 3: Sanity-Test schreiben (belegt, dass das Vendoring funktioniert)**

`test/vendorKit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseSSE } from '../src/vendor/kit/sse';
import { ThinkSplitter } from '../src/vendor/kit/think';
import { normalizeEndpoint } from '../src/vendor/kit/endpoint';

describe('vendored kit modules', () => {
  it('parseSSE accumulates content deltas and detects [DONE]', () => {
    const buf =
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n' +
      'data: {"choices":[{"delta":{"content":" there"}}]}\n' +
      'data: [DONE]\n';
    const r = parseSSE(buf);
    expect(r.content).toEqual(['Hi', ' there']);
    expect(r.done).toBe(true);
    expect(r.rest).toBe('');
  });

  it('ThinkSplitter routes <think> spans to reasoning, even across pushes', () => {
    const s = new ThinkSplitter();
    const a = s.push('<thi');
    const b = s.push('nk>plan</think>answer');
    expect(a.content + b.content).toBe('answer');
    expect(a.reasoning + b.reasoning).toBe('plan');
  });

  it('normalizeEndpoint strips trailing slashes and /v1', () => {
    expect(normalizeEndpoint('http://localhost:1234/v1/')).toBe('http://localhost:1234');
  });
});
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run test/vendorKit.test.ts`
Expected: 3 passed. Danach `npm run typecheck` — Expected: keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/vendor/kit test/vendorKit.test.ts
git commit -m "chore(vendor): vendor obsidian-kit pure modules (sse, think, endpoint) @0.13.0"
```

---

### Task 2: Settings erweitern (`llmEndpoint`/`llmApiKey`/`llmModel`) + Settings-Tab-Sektion

**Files:**
- Modify: `src/settings.ts`
- Modify: `src/SettingsTab.ts` (ans Ende von `display()` anhängen)
- Test: `test/settings.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `VimDojoSettings` um `llmEndpoint: string; llmApiKey: string; llmModel: string` erweitert · `isLlmConfigured(s: Pick<VimDojoSettings, 'llmEndpoint' | 'llmModel'>): boolean` (true ⇔ Endpoint UND Modell non-empty nach trim). Spätere Tasks gaten UI/Verdrahtung ausschließlich über `isLlmConfigured`.

- [ ] **Step 1: Failing Test schreiben**

`test/settings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, isLlmConfigured } from '../src/settings';

describe('LLM settings', () => {
  it('defaults to unconfigured (feature off)', () => {
    expect(DEFAULT_SETTINGS.llmEndpoint).toBe('');
    expect(DEFAULT_SETTINGS.llmApiKey).toBe('');
    expect(DEFAULT_SETTINGS.llmModel).toBe('');
    expect(isLlmConfigured(DEFAULT_SETTINGS)).toBe(false);
  });

  it('requires both endpoint and model (whitespace does not count)', () => {
    expect(isLlmConfigured({ llmEndpoint: 'http://localhost:1234', llmModel: '' })).toBe(false);
    expect(isLlmConfigured({ llmEndpoint: '   ', llmModel: 'qwen3' })).toBe(false);
    expect(isLlmConfigured({ llmEndpoint: 'http://localhost:1234', llmModel: 'qwen3' })).toBe(true);
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run test/settings.test.ts`
Expected: FAIL — `isLlmConfigured` is not exported / `llmEndpoint` undefined.

- [ ] **Step 3: `src/settings.ts` erweitern**

Interface- und Default-Erweiterung (bestehende Felder unverändert lassen):

```ts
export interface VimDojoSettings {
  missionFolder: string;
  hudPlacement: HudPlacement;
  colorScheme: ColorScheme;
  /** Turn Obsidian's Vim mode on for the duration of a mission, restore it after. */
  autoVim: boolean;
  /** Open the NeuroVim pane automatically when Obsidian starts. Off by default. */
  openPaneOnStartup: boolean;
  /** OpenAI-compatible endpoint for the optional CIPHER uplink. Empty = feature off. */
  llmEndpoint: string;
  /** Optional bearer token for cloud proxies (LM Studio/Ollama need none). */
  llmApiKey: string;
  /** Model id to request, e.g. "qwen3-8b". Empty = feature off. */
  llmModel: string;
}

export const DEFAULT_SETTINGS: VimDojoSettings = {
  missionFolder: 'NeuroVim/',
  hudPlacement: 'auto',
  colorScheme: 'crt',
  autoVim: false,
  openPaneOnStartup: false,
  llmEndpoint: '',
  llmApiKey: '',
  llmModel: '',
};

/** The CIPHER uplink is live only when both an endpoint and a model are set. */
export function isLlmConfigured(s: Pick<VimDojoSettings, 'llmEndpoint' | 'llmModel'>): boolean {
  return s.llmEndpoint.trim() !== '' && s.llmModel.trim() !== '';
}
```

- [ ] **Step 4: Test laufen lassen — muss passen**

Run: `npx vitest run test/settings.test.ts`
Expected: PASS (2 Tests).

- [ ] **Step 5: Settings-Tab-Sektion anhängen**

In `src/SettingsTab.ts`, ans Ende von `display()` (nach dem „Open pane on startup"-Setting):

```ts
    new Setting(containerEl).setName('CIPHER uplink (experimental)').setHeading();
    containerEl.createEl('p', {
      text:
        'Ask CIPHER for Vim advice via any OpenAI-compatible endpoint (LM Studio, Ollama, ' +
        'OpenRouter, …). Privacy: your questions plus the active mission\'s metadata ' +
        '(title, category, goal) are sent to the endpoint you configure — never any ' +
        'other vault content. Leave endpoint or model empty to disable the feature.',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('LLM endpoint')
      .setDesc('Base URL, e.g. http://localhost:1234 — a trailing /v1 is handled either way.')
      .addText((t) =>
        t.setPlaceholder('http://localhost:1234')
          .setValue(this.plugin.settings.llmEndpoint)
          .onChange(async (v) => {
            this.plugin.settings.llmEndpoint = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Model')
      .setDesc('Model id to request from the endpoint, e.g. qwen3-8b.')
      .addText((t) =>
        t.setPlaceholder('qwen3-8b')
          .setValue(this.plugin.settings.llmModel)
          .onChange(async (v) => {
            this.plugin.settings.llmModel = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('API key (optional)')
      .setDesc('Bearer token for endpoints that need one. Local servers usually don\'t.')
      .addText((t) => {
        t.inputEl.type = 'password';
        t.setValue(this.plugin.settings.llmApiKey)
          .onChange(async (v) => {
            this.plugin.settings.llmApiKey = v.trim();
            await this.plugin.saveSettings();
          });
      });
```

- [ ] **Step 6: Alles prüfen und committen**

Run: `npx vitest run && npm run typecheck`
Expected: alle Tests PASS, typecheck sauber.

```bash
git add src/settings.ts src/SettingsTab.ts test/settings.test.ts
git commit -m "feat(settings): CIPHER uplink settings (endpoint/model/api key) + privacy note"
```

---

### Task 3: `cipherPrompt.ts` — purer Prompt-Builder (TDD)

**Files:**
- Create: `src/llm/cipherPrompt.ts`
- Test: `test/cipherPrompt.test.ts`

**Interfaces:**
- Consumes: `ENTRIES: RawContentEntry[]` aus `@neurovim/content` (Felder: `id`, `role`, `body`) · `CHEATSHEET: CheatsheetCategory[]` aus `@neurovim/core` (`{ id, label, groups: { label, keys: { key, description }[] }[] }`).
- Produces:
  - `interface LlmMessage { role: 'system' | 'user' | 'assistant'; content: string }`
  - `interface MissionContext { id: string; title: string; category: string; why?: string; parKeystrokes?: number }`
  - `interface CipherKnowledge { quickRef: string; cheatsheet: string }`
  - `buildKnowledge(): CipherKnowledge` (liest ENTRIES/CHEATSHEET selbst — bequemer App-Einstieg)
  - `serializeCheatsheet(cats: CheatsheetCategory[]): string`
  - `quickReference(entries: readonly { id: string; role: string; body: string }[]): string` (exakte ID `REF-EN-Quick_Reference` — bewusst NICHT das kaputte `getManual()`)
  - `buildChatMessages(args: { knowledge: CipherKnowledge; mission: MissionContext | null; history: LlmMessage[]; question: string }): LlmMessage[]`

- [ ] **Step 1: Failing Tests schreiben**

`test/cipherPrompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  buildChatMessages, quickReference, serializeCheatsheet, buildKnowledge,
} from '../src/llm/cipherPrompt';
import type { CipherKnowledge, MissionContext } from '../src/llm/cipherPrompt';

const KNOWLEDGE: CipherKnowledge = { quickRef: 'QUICKREF-BODY', cheatsheet: 'CHEATSHEET-BODY' };

describe('quickReference', () => {
  it('selects the ref entry by exact id — not the RAVEN false match of getManual()', () => {
    const entries = [
      { id: '99-THE_RAVEN', role: 'ref', body: 'raven' },
      { id: 'REF-EN-Quick_Reference', role: 'ref', body: 'the real reference' },
    ];
    expect(quickReference(entries)).toBe('the real reference');
  });

  it('returns empty string when the entry is missing', () => {
    expect(quickReference([])).toBe('');
  });
});

describe('serializeCheatsheet', () => {
  it('flattens categories/groups into compact "key — description" lines', () => {
    const out = serializeCheatsheet([
      {
        id: 'fundamentals',
        label: 'FUNDAMENTALS',
        groups: [{ label: 'MODES', keys: [{ key: 'i', description: 'insert before cursor' }] }],
      },
    ]);
    expect(out).toContain('## FUNDAMENTALS');
    expect(out).toContain('### MODES');
    expect(out).toContain('`i` — insert before cursor');
  });
});

describe('buildKnowledge', () => {
  it('builds from the real vendored bundle: non-empty quickRef and cheatsheet', () => {
    const k = buildKnowledge();
    expect(k.quickRef.length).toBeGreaterThan(1000);
    expect(k.cheatsheet).toContain('FUNDAMENTALS');
  });
});

describe('buildChatMessages', () => {
  const mission: MissionContext = {
    id: 'M-01', title: 'First Contact', category: 'fundamentals',
    why: 'Modes are the spine.', parKeystrokes: 12,
  };

  it('starts with one system message carrying persona, guardrail, and knowledge', () => {
    const msgs = buildChatMessages({ knowledge: KNOWLEDGE, mission: null, history: [], question: 'how do I delete a word?' });
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('CIPHER');
    expect(msgs[0].content).toContain('Focus on the mission');       // off-topic guardrail
    expect(msgs[0].content).toContain('QUICKREF-BODY');
    expect(msgs[0].content).toContain('CHEATSHEET-BODY');
    expect(msgs[0].content).toContain('same language the operative used'); // answer-language rule
  });

  it('includes mission context only when a mission is active', () => {
    const withM = buildChatMessages({ knowledge: KNOWLEDGE, mission, history: [], question: 'q' });
    expect(withM[0].content).toContain('First Contact');
    expect(withM[0].content).toContain('par: 12 keystrokes');
    const without = buildChatMessages({ knowledge: KNOWLEDGE, mission: null, history: [], question: 'q' });
    expect(without[0].content).not.toContain('First Contact');
  });

  it('appends history then the new question as the last user message', () => {
    const msgs = buildChatMessages({
      knowledge: KNOWLEDGE, mission: null,
      history: [
        { role: 'user', content: 'earlier q' },
        { role: 'assistant', content: 'earlier a' },
      ],
      question: 'new question',
    });
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(msgs[msgs.length - 1].content).toBe('new question');
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run test/cipherPrompt.test.ts`
Expected: FAIL — Modul `../src/llm/cipherPrompt` existiert nicht.

- [ ] **Step 3: `src/llm/cipherPrompt.ts` implementieren**

```ts
/**
 * Pure prompt building for the CIPHER uplink. No Obsidian imports.
 * Knowledge = bundled EN quick reference (selected by EXACT id — the vendored
 * getManual() matches 99-THE_RAVEN first via id.includes('EN')) + the cheatsheet.
 */
import { ENTRIES } from '@neurovim/content';
import { CHEATSHEET, type CheatsheetCategory } from '@neurovim/core';

export interface LlmMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface MissionContext {
  id: string;
  title: string;
  category: string;
  why?: string;
  parKeystrokes?: number;
}

export interface CipherKnowledge { quickRef: string; cheatsheet: string }

const QUICK_REF_ID = 'REF-EN-Quick_Reference';

export function quickReference(entries: readonly { id: string; role: string; body: string }[]): string {
  return entries.find((e) => e.role === 'ref' && e.id === QUICK_REF_ID)?.body ?? '';
}

export function serializeCheatsheet(cats: CheatsheetCategory[]): string {
  const lines: string[] = [];
  for (const cat of cats) {
    lines.push(`## ${cat.label}`);
    for (const group of cat.groups) {
      lines.push(`### ${group.label}`);
      for (const k of group.keys) lines.push(`\`${k.key}\` — ${k.description}`);
    }
  }
  return lines.join('\n');
}

export function buildKnowledge(): CipherKnowledge {
  return { quickRef: quickReference(ENTRIES), cheatsheet: serializeCheatsheet(CHEATSHEET) };
}

const PERSONA = `You are CIPHER, the operative's handler inside NeuroVim — a cyberpunk Vim
training game. You speak in a laconic, dry, watchful tone; CORP is listening, keystrokes
matter, wasted motion is a liability. But above all you are an excellent Vim tutor:
clear, correct, concrete. When teaching, didactics beat immersion.

Rules:
- Answer in the same language the operative used in their question (German question →
  German answer). Vim key names and commands always stay verbatim (dw, ci", :%s/.../.../g).
- Give the exact keystrokes for the task, then one short line on WHY it works
  (operator + motion/text-object). Prefer the idiomatic solution over the long way.
- Keep answers tight: a few lines, no lectures, no bullet-point essays.
- Never reveal story content, mission solutions, or plot beyond what the operative
  already sees in their current mission.
- OFF-TOPIC GUARDRAIL: if a question has nothing to do with Vim, the current mission,
  or operating the NeuroVim plugin, refuse in character — one line like
  "Focus on the mission, operative. Remember what's at stake." — then offer Vim help
  instead. Examples of off-topic: news, politics, math homework, general coding
  questions, personal advice, other software. Examples of ON-topic: any Vim motion,
  operator, register, macro, search/replace, mode question, plugin controls (submit,
  reset, abort, timer, XP).`;

export function buildChatMessages(args: {
  knowledge: CipherKnowledge;
  mission: MissionContext | null;
  history: LlmMessage[];
  question: string;
}): LlmMessage[] {
  const parts: string[] = [PERSONA];
  if (args.mission) {
    const m = args.mission;
    const par = m.parKeystrokes != null ? ` (par: ${m.parKeystrokes} keystrokes)` : '';
    const why = m.why ? `\nWhy this skill matters: ${m.why}` : '';
    parts.push(
      `ACTIVE MISSION: ${m.id} — "${m.title}" [category: ${m.category}]${par}${why}\n` +
      'Tailor advice to this mission\'s skill category when it fits the question.',
    );
  }
  parts.push(`VIM QUICK REFERENCE (your knowledge base):\n${args.knowledge.quickRef}`);
  parts.push(`KEY CHEATSHEET:\n${args.knowledge.cheatsheet}`);
  return [
    { role: 'system', content: parts.join('\n\n---\n\n') },
    ...args.history,
    { role: 'user', content: args.question },
  ];
}
```

- [ ] **Step 4: Tests laufen lassen — müssen passen**

Run: `npx vitest run test/cipherPrompt.test.ts`
Expected: PASS (7 Tests). Falls `buildKnowledge` fehlschlägt, weil `CHEATSHEET` nicht aus `@neurovim/core` exportiert wird: Der Export kommt aus `core/data/cheatsheet.ts` und wird über `core/index.ts` re-exportiert (`export * from './data/cheatsheet'`) — Importnamen prüfen, nicht den Vendor editieren.

- [ ] **Step 5: Commit**

```bash
git add src/llm/cipherPrompt.ts test/cipherPrompt.test.ts
git commit -m "feat(llm): pure CIPHER prompt builder (persona, guardrail, knowledge base)"
```

---

### Task 4: `chatSession.ts` — purer In-Memory-Verlauf (TDD)

**Files:**
- Create: `src/llm/chatSession.ts`
- Test: `test/chatSession.test.ts`

**Interfaces:**
- Consumes: `LlmMessage`, `MissionContext` aus `./cipherPrompt` (Task 3).
- Produces:
  - `type ChatRole = 'user' | 'assistant' | 'error'`
  - `interface ChatEntry { role: ChatRole; text: string; detail?: string }`
  - `class ChatSession { entries: readonly ChatEntry[]; streaming: string | null; busy: boolean; mission: MissionContext | null; append(e: ChatEntry): void; historyForPrompt(): LlmMessage[]; reset(): void; setMission(m: MissionContext | null): void }`

- [ ] **Step 1: Failing Tests schreiben**

`test/chatSession.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ChatSession } from '../src/llm/chatSession';

describe('ChatSession', () => {
  it('appends entries and exposes them in order', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'q' });
    s.append({ role: 'assistant', text: 'a' });
    expect(s.entries.map((e) => e.text)).toEqual(['q', 'a']);
  });

  it('historyForPrompt maps user/assistant and skips error entries', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'q' });
    s.append({ role: 'error', text: 'Signal lost.', detail: 'HTTP 500' });
    s.append({ role: 'assistant', text: 'a' });
    expect(s.historyForPrompt()).toEqual([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ]);
  });

  it('reset clears entries and streaming but keeps the mission context', () => {
    const s = new ChatSession();
    s.setMission({ id: 'M-01', title: 'T', category: 'c' });
    s.append({ role: 'user', text: 'q' });
    s.streaming = 'partial';
    s.busy = true;
    s.reset();
    expect(s.entries).toEqual([]);
    expect(s.streaming).toBeNull();
    expect(s.busy).toBe(false);
    expect(s.mission?.id).toBe('M-01');
  });

  it('setMission(null) clears the mission but keeps the chat history', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'q' });
    s.setMission({ id: 'M-01', title: 'T', category: 'c' });
    s.setMission(null);
    expect(s.mission).toBeNull();
    expect(s.entries.length).toBe(1);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run test/chatSession.test.ts`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: `src/llm/chatSession.ts` implementieren**

```ts
/** In-memory CIPHER chat state for one Obsidian session. Pure — no Obsidian imports.
 *  Not persisted by design (spec: no chat persistence in v1). */
import type { LlmMessage, MissionContext } from './cipherPrompt';

export type ChatRole = 'user' | 'assistant' | 'error';

export interface ChatEntry {
  role: ChatRole;
  text: string;
  /** Technical detail shown de-emphasized under an error line. */
  detail?: string;
}

export class ChatSession {
  private list: ChatEntry[] = [];
  /** Live assistant answer while a stream is running, else null. */
  streaming: string | null = null;
  busy = false;
  mission: MissionContext | null = null;

  get entries(): readonly ChatEntry[] { return this.list; }

  append(e: ChatEntry): void { this.list.push(e); }

  /** Prompt history: user/assistant turns only — error lines are UI-local. */
  historyForPrompt(): LlmMessage[] {
    return this.list
      .filter((e): e is ChatEntry & { role: 'user' | 'assistant' } => e.role !== 'error')
      .map((e) => ({ role: e.role, content: e.text }));
  }

  /** Channel reset: wipe the conversation; the mission context survives. */
  reset(): void {
    this.list = [];
    this.streaming = null;
    this.busy = false;
  }

  setMission(m: MissionContext | null): void { this.mission = m; }
}
```

- [ ] **Step 4: Tests laufen lassen — müssen passen**

Run: `npx vitest run test/chatSession.test.ts`
Expected: PASS (4 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/llm/chatSession.ts test/chatSession.test.ts
git commit -m "feat(llm): in-memory ChatSession (history, streaming state, mission context)"
```

---

### Task 5: `CipherClient.ts` — Streaming-Client + XHR-Transport (TDD gegen Fake-Transport)

**Files:**
- Create: `src/llm/CipherClient.ts`
- Create: `src/llm/XhrSseTransport.ts`
- Test: `test/CipherClient.test.ts`

**Interfaces:**
- Consumes: `parseSSE`, `ThinkSplitter`, `normalizeEndpoint` aus `../vendor/kit/*` (Task 1) · `LlmMessage` aus `./cipherPrompt` (Task 3).
- Produces:
  - `interface SseTransport { postStream(url: string, body: unknown, headers: Record<string, string>, onChunk: (raw: string) => void, signal: AbortSignal): Promise<number> }`
  - `type StreamOutcome = { ok: true; content: string } | { ok: false; kind: 'aborted' | 'http' | 'network' | 'timeout'; detail: string; partial: string }`
  - `interface CipherConfig { endpoint: string; apiKey: string; model: string }`
  - `class CipherClient { constructor(transport: SseTransport, timeoutMs?: number); stream(cfg: CipherConfig, messages: LlmMessage[], onToken: (t: string) => void, signal: AbortSignal): Promise<StreamOutcome> }`
  - `class XhrSseTransport implements SseTransport` (Obsidian-Runtime; nicht unit-getestet — DOM-frei nicht möglich, Logik lebt im Client)

- [ ] **Step 1: Failing Tests schreiben**

`test/CipherClient.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CipherClient, type SseTransport } from '../src/llm/CipherClient';

const CFG = { endpoint: 'http://localhost:1234/v1/', apiKey: '', model: 'test-model' };
const MSGS = [{ role: 'user' as const, content: 'q' }];

/** Fake transport: replays fixture chunks, records url/body/headers. */
function fakeTransport(chunks: string[], status = 200): SseTransport & { calls: { url: string; body: unknown; headers: Record<string, string> }[] } {
  const t = {
    calls: [] as { url: string; body: unknown; headers: Record<string, string> }[],
    postStream(url: string, body: unknown, headers: Record<string, string>, onChunk: (raw: string) => void, _signal: AbortSignal): Promise<number> {
      t.calls.push({ url, body, headers });
      for (const c of chunks) onChunk(c);
      return Promise.resolve(status);
    },
  };
  return t;
}

const sse = (content: string): string => `data: {"choices":[{"delta":{"content":${JSON.stringify(content)}}}]}\n`;

describe('CipherClient.stream', () => {
  it('happy path: accumulates deltas, emits tokens, normalizes the endpoint url', async () => {
    const t = fakeTransport([sse('Hel'), sse('lo'), 'data: [DONE]\n']);
    const tokens: string[] = [];
    const r = await new CipherClient(t).stream(CFG, MSGS, (tok) => tokens.push(tok), new AbortController().signal);
    expect(r).toEqual({ ok: true, content: 'Hello' });
    expect(tokens.join('')).toBe('Hello');
    expect(t.calls[0].url).toBe('http://localhost:1234/v1/chat/completions');
    const body = t.calls[0].body as Record<string, unknown>;
    expect(body.model).toBe('test-model');
    expect(body.stream).toBe(true);
  });

  it('handles SSE lines split across chunk boundaries (rest carry-over)', async () => {
    const line = sse('Hello');
    const t = fakeTransport([line.slice(0, 20), line.slice(20), 'data: [DONE]\n']);
    const r = await new CipherClient(t).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(r).toEqual({ ok: true, content: 'Hello' });
  });

  it('suppresses <think> spans from content and tokens', async () => {
    const t = fakeTransport([sse('<think>secret plan</think>'), sse('visible'), 'data: [DONE]\n']);
    const tokens: string[] = [];
    const r = await new CipherClient(t).stream(CFG, MSGS, (tok) => tokens.push(tok), new AbortController().signal);
    expect(r).toEqual({ ok: true, content: 'visible' });
    expect(tokens.join('')).toBe('visible');
  });

  it('sends an Authorization header only when an api key is set', async () => {
    const t1 = fakeTransport(['data: [DONE]\n']);
    await new CipherClient(t1).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(t1.calls[0].headers.Authorization).toBeUndefined();
    const t2 = fakeTransport(['data: [DONE]\n']);
    await new CipherClient(t2).stream({ ...CFG, apiKey: 'sk-x' }, MSGS, () => undefined, new AbortController().signal);
    expect(t2.calls[0].headers.Authorization).toBe('Bearer sk-x');
  });

  it('non-2xx status → { ok: false, kind: "http" } with body excerpt as detail', async () => {
    const t = fakeTransport(['{"error":{"message":"model not found"}}'], 404);
    const r = await new CipherClient(t).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('http');
      expect(r.detail).toContain('404');
      expect(r.detail).toContain('model not found');
    }
  });

  it('transport rejection with AbortError → kind "aborted", keeps partial content', async () => {
    const t: SseTransport = {
      postStream(_u, _b, _h, onChunk, _s): Promise<number> {
        onChunk(sse('par'));
        const e = new Error('Aborted');
        e.name = 'AbortError';
        return Promise.reject(e);
      },
    };
    const r = await new CipherClient(t).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('aborted');
      expect(r.partial).toBe('par');
    }
  });

  it('other transport rejection → kind "network"', async () => {
    const t: SseTransport = {
      postStream(): Promise<number> {
        const e = new Error('ECONNREFUSED');
        e.name = 'StreamNetworkError';
        return Promise.reject(e);
      },
    };
    const r = await new CipherClient(t).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('network');
  });

  it('garbage chunks without valid SSE data yield ok with empty content', async () => {
    const t = fakeTransport(['not sse at all\n', 'data: {broken json\n']);
    const r = await new CipherClient(t).stream(CFG, MSGS, () => undefined, new AbortController().signal);
    expect(r).toEqual({ ok: true, content: '' });
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run test/CipherClient.test.ts`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: `src/llm/CipherClient.ts` implementieren**

```ts
/**
 * Thin streaming client for one OpenAI-compatible /v1/chat/completions call.
 * Transport is injected (Obsidian's requestUrl can't stream; the real transport
 * is XHR-based — see XhrSseTransport). Pure enough to test with a fake transport.
 */
import { parseSSE } from '../vendor/kit/sse';
import { ThinkSplitter } from '../vendor/kit/think';
import { normalizeEndpoint } from '../vendor/kit/endpoint';
import type { LlmMessage } from './cipherPrompt';

export interface SseTransport {
  postStream(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    onChunk: (raw: string) => void,
    signal: AbortSignal,
  ): Promise<number>;
}

export interface CipherConfig { endpoint: string; apiKey: string; model: string }

export type StreamOutcome =
  | { ok: true; content: string }
  | { ok: false; kind: 'aborted' | 'http' | 'network' | 'timeout'; detail: string; partial: string };

const ERROR_BODY_CAP = 2048;
const DEFAULT_TIMEOUT_MS = 120_000;

export class CipherClient {
  constructor(
    private readonly transport: SseTransport,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async stream(
    cfg: CipherConfig,
    messages: LlmMessage[],
    onToken: (t: string) => void,
    signal: AbortSignal,
  ): Promise<StreamOutcome> {
    const url = `${normalizeEndpoint(cfg.endpoint)}/v1/chat/completions`;
    const headers: Record<string, string> = {};
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    const body = { model: cfg.model, messages, stream: true, temperature: 0.7, max_tokens: 1024 };

    // Inner controller: fired by caller abort OR the hard timeout.
    const ctrl = new AbortController();
    let timedOut = false;
    const onCallerAbort = (): void => ctrl.abort();
    signal.addEventListener('abort', onCallerAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, this.timeoutMs);

    const splitter = new ThinkSplitter();
    let content = '';
    let rest = '';
    let rawBody = '';

    const emit = (piece: string): void => {
      const parts = splitter.push(piece);
      if (parts.content !== '') {
        content += parts.content;
        onToken(parts.content);
      }
      // Reasoning (think spans + reasoning_content) is dropped by design.
    };

    let status: number;
    try {
      status = await this.transport.postStream(url, body, headers, (raw) => {
        if (rawBody.length < ERROR_BODY_CAP) rawBody += raw;
        const parsed = parseSSE(rest + raw);
        rest = parsed.rest;
        for (const delta of parsed.content) emit(delta);
      }, ctrl.signal);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('unknown stream error');
      if (err.name === 'AbortError') {
        return timedOut
          ? { ok: false, kind: 'timeout', detail: `no answer within ${this.timeoutMs / 1000}s`, partial: content }
          : { ok: false, kind: 'aborted', detail: 'stream aborted', partial: content };
      }
      return { ok: false, kind: 'network', detail: err.message, partial: content };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onCallerAbort);
    }

    const tail = splitter.flush();
    if (tail.content !== '') { content += tail.content; onToken(tail.content); }

    if (status < 200 || status >= 300) {
      return { ok: false, kind: 'http', detail: `HTTP ${status}: ${rawBody.slice(0, ERROR_BODY_CAP)}`, partial: content };
    }
    return { ok: true, content };
  }
}
```

- [ ] **Step 4: Tests laufen lassen — müssen passen**

Run: `npx vitest run test/CipherClient.test.ts`
Expected: PASS (8 Tests).

- [ ] **Step 5: `src/llm/XhrSseTransport.ts` implementieren (Runtime-Transport, vault-crews-Muster + Header-Support)**

```ts
/**
 * SSE streaming via XMLHttpRequest + onprogress (ecosystem pattern, PROF-OBS-12):
 * Obsidian's requestUrl can't stream. responseText accumulates; only the new tail
 * is forwarded as a raw delta — SSE parsing happens in CipherClient via parseSSE.
 * Resolves with the HTTP status even for non-2xx (the client wants the error body).
 * AbortSignal → xhr.abort() → rejection with Error name="AbortError".
 */
import type { SseTransport } from './CipherClient';

export class XhrSseTransport implements SseTransport {
  postStream(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    onChunk: (raw: string) => void,
    signal: AbortSignal,
  ): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const abortError = (): Error => {
        const e = new Error('Aborted');
        e.name = 'AbortError';
        return e;
      };
      if (signal.aborted) { reject(abortError()); return; }
      const xhr = new XMLHttpRequest();
      let lastIndex = 0;
      const pump = (): void => {
        const text = xhr.responseText;
        if (text.length > lastIndex) {
          const delta = text.slice(lastIndex);
          lastIndex = text.length;
          onChunk(delta);
        }
      };
      xhr.open('POST', url);
      xhr.setRequestHeader('Content-Type', 'application/json');
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      xhr.onprogress = (): void => pump();
      xhr.onerror = (): void => {
        const e = new Error(`CIPHER uplink: network error POST ${url}`);
        e.name = 'StreamNetworkError';
        reject(e);
      };
      xhr.onabort = (): void => reject(abortError());
      xhr.onload = (): void => { pump(); resolve(xhr.status); };
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
      xhr.send(JSON.stringify(body));
    });
  }
}
```

- [ ] **Step 6: Alles prüfen und committen**

Run: `npx vitest run && npm run typecheck`
Expected: alle Tests PASS, typecheck sauber.

```bash
git add src/llm/CipherClient.ts src/llm/XhrSseTransport.ts test/CipherClient.test.ts
git commit -m "feat(llm): CipherClient streaming (kit parseSSE/ThinkSplitter) + XHR transport"
```

---

### Task 6: `CipherChat.tsx` — UPLINK-UI in der HubView

**Files:**
- Create: `src/CipherChat.tsx`
- Modify: `src/HubView.tsx`

**Interfaces:**
- Consumes: `ChatEntry` aus `./llm/chatSession` (Task 4).
- Produces:
  - `interface CipherChatProps { entries: readonly ChatEntry[]; streaming: string | null; busy: boolean; missionTitle: string | null; onAsk: (q: string) => void; onAbort: () => void; onReset: () => void }`
  - `HubProps` erweitert um `cipher: CipherChatProps | null` (null ⇒ Bereich wird nicht gerendert — das Gate setzt `main.ts` in Task 7 über `isLlmConfigured`).

- [ ] **Step 1: `src/CipherChat.tsx` implementieren**

Kein Preact-State: Verlauf/Streaming kommen aus der ChatSession (via Props, repaint-getrieben durch den 500-ms-Tick), das Eingabefeld ist ein uncontrolled DOM-Input — so überlebt der Draft die häufigen `render()`-Aufrufe der HubView unabhängig vom Reconciler.

```tsx
import { h } from 'preact';
import type { ChatEntry } from './llm/chatSession';

export interface CipherChatProps {
  entries: readonly ChatEntry[];
  /** Live assistant answer while a stream runs, else null. */
  streaming: string | null;
  busy: boolean;
  /** Active mission title, shown as the channel's context tag. */
  missionTitle: string | null;
  onAsk: (q: string) => void;
  onAbort: () => void;
  onReset: () => void;
}

/** UPLINK // CIPHER — chat area inside the hub pane. Stateless: history and the
 *  streaming answer live in the plugin's ChatSession; the input is uncontrolled
 *  so the draft survives the pane's periodic repaints. */
export function CipherChat(p: CipherChatProps) {
  const send = (input: HTMLInputElement): void => {
    const q = input.value.trim();
    if (!q || p.busy) return;
    input.value = '';
    p.onAsk(q);
  };
  return (
    <div class="nv-uplink">
      <h2 class="nv-title">UPLINK // CIPHER</h2>
      {p.missionTitle && <div class="nv-uplink-context">channel: {p.missionTitle}</div>}
      <div class="nv-uplink-log">
        {p.entries.map((e) => (
          <div class={`nv-uplink-line nv-uplink-${e.role}`}>
            <span class="nv-uplink-prefix">{e.role === 'user' ? 'YOU >' : 'CIPHER >'}</span>
            <span class="nv-uplink-text">{e.text}</span>
            {e.detail && <div class="nv-uplink-detail">{e.detail}</div>}
          </div>
        ))}
        {p.streaming !== null && (
          <div class="nv-uplink-line nv-uplink-assistant">
            <span class="nv-uplink-prefix">CIPHER &gt;</span>
            <span class="nv-uplink-text">{p.streaming}<span class="nv-uplink-cursor">▮</span></span>
          </div>
        )}
      </div>
      <div class="nv-uplink-input-row">
        <input
          class="nv-uplink-input"
          type="text"
          placeholder="ask CIPHER…"
          disabled={p.busy}
          onKeyDown={(e) => { if (e.key === 'Enter') send(e.currentTarget as HTMLInputElement); }}
        />
        {p.busy
          ? <button class="nv-btn nv-btn-abort" onClick={p.onAbort}>CUT</button>
          : <button class="nv-btn nv-btn-submit" onClick={(e) => {
              const input = (e.currentTarget as HTMLElement).parentElement?.querySelector('input');
              if (input) send(input as HTMLInputElement);
            }}>SEND</button>}
        <button class="nv-btn nv-btn-reset" title="Reset channel (clear history)" onClick={p.onReset}>RST</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/HubView.tsx` erweitern**

Import ergänzen und `HubProps` um `cipher` erweitern; in `Nexus` den Bereich unter der Missionsliste rendern:

```tsx
import { CipherChat, type CipherChatProps } from './CipherChat';
```

```ts
export interface HubProps {
  missions: MissionSummary[];
  data: PluginData;
  onStart: (id: string) => void;
  /** When set, the mission-control block is shown at the top of the pane. */
  control: HudRenderProps | null;
  /** When set, the UPLINK // CIPHER chat is shown below the mission list. */
  cipher: CipherChatProps | null;
  scheme: ColorScheme;
}
```

In `Nexus`, direkt nach dem schließenden `</div>` von `nv-mission-list` (vor dem schließenden `</div>` von `nv-nexus`):

```tsx
      {p.cipher && <CipherChat key="cipher-chat" {...p.cipher} />}
```

- [ ] **Step 3: Typecheck + bestehende Tests**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck meldet Fehler in `main.ts` NICHT — `setProps` wird erst in Task 7 um `cipher` ergänzt; da `cipher` ein Pflichtfeld ist, wird typecheck hier fehlschlagen (`Property 'cipher' is missing`). Das ist der beabsichtigte Kompilierzwang: In `src/main.ts` in `repaint()` im `view.setProps({...})`-Aufruf übergangsweise `cipher: null,` ergänzen (wird in Task 7 durch die echte Verdrahtung ersetzt). Danach: typecheck sauber, alle Tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/CipherChat.tsx src/HubView.tsx src/main.ts
git commit -m "feat(ui): UPLINK // CIPHER chat area in the hub pane (gated by props)"
```

---

### Task 7: Verdrahtung in `main.ts` + CIPHER-Button im HUD

**Files:**
- Modify: `src/main.ts`
- Modify: `src/HudMount.ts` (Interface `HudRenderProps`)
- Modify: `src/MissionHud.tsx`

**Interfaces:**
- Consumes: `ChatSession` (Task 4) · `CipherClient`, `XhrSseTransport` (Task 5) · `buildKnowledge`, `buildChatMessages`, `MissionContext`, `CipherKnowledge` (Task 3) · `isLlmConfigured` (Task 2) · `CipherChatProps` (Task 6).
- Produces: `HudRenderProps` um `onCipher?: () => void` erweitert (Button erscheint nur, wenn gesetzt) · vollständige Feature-Verdrahtung.

- [ ] **Step 1: `HudRenderProps` um `onCipher` erweitern**

In `src/HudMount.ts`, nach `onAbandon: () => void;`:

```ts
  /** Present only when the CIPHER uplink is configured — renders the CIPHER button. */
  onCipher?: () => void;
```

- [ ] **Step 2: CIPHER-Button in `src/MissionHud.tsx`**

In der `nv-hud-actions`-Div, nach dem ABORT-Button:

```tsx
          {p.onCipher && (
            <button class="nv-btn nv-btn-cipher" title="Ask CIPHER for Vim advice" onClick={p.onCipher}>CIPHER</button>
          )}
```

- [ ] **Step 3: `src/main.ts` verdrahten**

Imports ergänzen:

```ts
import { ChatSession } from './llm/chatSession';
import { CipherClient } from './llm/CipherClient';
import { XhrSseTransport } from './llm/XhrSseTransport';
import { buildKnowledge, buildChatMessages, type CipherKnowledge, type MissionContext } from './llm/cipherPrompt';
import { DEFAULT_SETTINGS, isLlmConfigured, type VimDojoSettings } from './settings';
```

(Die bestehende `./settings`-Importzeile entsprechend ersetzen.)

Felder in der Klasse (nach `private tick: number | null = null;`):

```ts
  private cipherSession = new ChatSession();
  private cipherClient = new CipherClient(new XhrSseTransport());
  private cipherAbort: AbortController | null = null;
  private cipherKnowledge: CipherKnowledge | null = null;
```

Ask-Handler (neue Methode, z. B. nach `handleAbandon()`):

```ts
  /** One CIPHER chat turn: append the question, stream the answer into the session. */
  private async handleCipherAsk(question: string): Promise<void> {
    if (this.cipherSession.busy || !isLlmConfigured(this.settings)) return;
    this.cipherKnowledge ??= buildKnowledge();
    const history = this.cipherSession.historyForPrompt();
    this.cipherSession.append({ role: 'user', text: question });
    this.cipherSession.busy = true;
    this.cipherSession.streaming = '';
    this.cipherAbort = new AbortController();
    const messages = buildChatMessages({
      knowledge: this.cipherKnowledge,
      mission: this.cipherSession.mission,
      history,
      question,
    });
    const cfg = {
      endpoint: this.settings.llmEndpoint,
      apiKey: this.settings.llmApiKey,
      model: this.settings.llmModel,
    };
    const outcome = await this.cipherClient.stream(cfg, messages, (t) => {
      // The 500ms repaint tick picks this up — no extra render plumbing.
      this.cipherSession.streaming = (this.cipherSession.streaming ?? '') + t;
    }, this.cipherAbort.signal);

    if (outcome.ok) {
      this.cipherSession.append({ role: 'assistant', text: outcome.content });
    } else if (outcome.kind === 'aborted' && outcome.partial) {
      this.cipherSession.append({ role: 'assistant', text: `${outcome.partial} — signal cut` });
    } else if (outcome.kind !== 'aborted') {
      this.cipherSession.append({ role: 'error', text: 'Signal lost. Check your uplink.', detail: outcome.detail });
    }
    this.cipherSession.streaming = null;
    this.cipherSession.busy = false;
    this.cipherAbort = null;
    this.repaint();
  }
```

Missionskontext synchron halten — in `beginMission()` nach `this.enterAutoVim();`:

```ts
      const m = this.missions.find((x) => x.mission_id === id);
      this.cipherSession.setMission(m
        ? { id: m.mission_id, title: m.title, category: m.category, why: m.why, parKeystrokes: m.par_keystrokes }
        : null);
```

In `handleSubmit()` im `res.ok`-Zweig nach `this.restoreVim();` sowie in `handleAbandon()` nach `this.restoreVim();`:

```ts
    this.cipherSession.setMission(null);
```

In `repaint()`: im `control`-Objekt (nach `onAbandon: ...`):

```ts
          onCipher: isLlmConfigured(this.settings) ? () => void this.activateView() : undefined,
```

und im `view.setProps({...})`-Aufruf das Übergangs-`cipher: null` aus Task 6 ersetzen durch:

```ts
        cipher: isLlmConfigured(this.settings)
          ? {
              entries: this.cipherSession.entries,
              streaming: this.cipherSession.streaming,
              busy: this.cipherSession.busy,
              missionTitle: this.cipherSession.mission?.title ?? null,
              onAsk: (q) => void this.handleCipherAsk(q),
              onAbort: () => this.cipherAbort?.abort(),
              onReset: () => { this.cipherAbort?.abort(); this.cipherSession.reset(); this.repaint(); },
            }
          : null,
```

In `onunload()` (nach `this.hud.detach();`):

```ts
    this.cipherAbort?.abort();
```

- [ ] **Step 4: Typecheck + alle Tests**

Run: `npm run typecheck && npx vitest run`
Expected: beides sauber. (Kein neuer Unit-Test: Das Gating ist über `isLlmConfigured` [Task 2] getestet, Prompt/Session/Client über Tasks 3–5; `main.ts`-Verdrahtung wird — wie im Repo üblich — über den manuellen Smoke-Test in Task 8 verifiziert.)

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/HudMount.ts src/MissionHud.tsx
git commit -m "feat(llm): wire CIPHER uplink — chat turn handler, mission context sync, HUD button"
```

---

### Task 8: Styling, README, Build + manueller Smoke-Test

**Files:**
- Modify: `styles.css` (ans Ende anhängen)
- Modify: `README.md` (Feature-Abschnitt)

**Interfaces:**
- Consumes: CSS-Klassen aus Task 6 (`nv-uplink*`, `nv-btn-cipher`); bestehende Schemes `.nv-crt` / `.nv-native` (Wrapper `nv-root nv-<scheme>` in HubView, `nv-hud nv-<scheme>` im HUD).
- Produces: fertiges, deploybares Feature.

- [ ] **Step 1: Styles anhängen**

Ans Ende von `styles.css` (Muster: Scheme-Varianten über die bestehenden `.nv-crt`/`.nv-native`-Wrapper; exakte Farbwerte an die vorhandenen CRT-Variablen/Regeln im File angleichen — dieselben Grün-/Schwarztöne verwenden, die dort bereits für `.nv-nexus` gelten):

```css
/* ── UPLINK // CIPHER ─────────────────────────────────────────── */
.nv-uplink { margin-top: 1.5em; border-top: 1px dashed currentColor; padding-top: 0.75em; }
.nv-uplink-context { font-size: 0.8em; opacity: 0.7; margin-bottom: 0.5em; }
.nv-uplink-log { max-height: 40vh; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5em; }
.nv-uplink-line { white-space: pre-wrap; word-break: break-word; }
.nv-uplink-prefix { font-weight: bold; margin-right: 0.5em; opacity: 0.8; }
.nv-uplink-user .nv-uplink-prefix { opacity: 0.6; }
.nv-uplink-error { opacity: 0.9; }
.nv-uplink-detail { font-size: 0.75em; opacity: 0.55; margin-left: 1.5em; }
.nv-uplink-cursor { animation: nv-uplink-blink 1s steps(1) infinite; }
@keyframes nv-uplink-blink { 50% { opacity: 0; } }
.nv-uplink-input-row { display: flex; gap: 0.4em; margin-top: 0.6em; }
.nv-uplink-input { flex: 1; min-width: 0; background: transparent; border: 1px solid currentColor; color: inherit; font-family: inherit; padding: 0.3em 0.5em; }
.nv-crt .nv-uplink-error .nv-uplink-text { color: #ff5f56; }
.nv-native .nv-uplink-error .nv-uplink-text { color: var(--text-error); }
```

**Light-Theme-Wachsamkeit (Lesson `mix-blend-mode`):** Der Chat rendert reinen Text (keine Obsidian-Callouts, kein `MarkdownRenderer`), daher droht der Callout-Blend-Bug hier nicht. Trotzdem beim Smoke-Test explizit im Standard-Theme (moonstone/Light) prüfen: Buttons im CRT-Scheme (die 0.3.0-Lesson zu Light-Button-BG gilt auch für `nv-btn-cipher` — dieselben `.nv-btn`-Regeln greifen), Input-Kontrast, Fehlerfarbe.

- [ ] **Step 2: README-Abschnitt ergänzen**

In `README.md`, im Feature-Bereich (an bestehende Struktur angleichen):

```markdown
## CIPHER uplink (experimental, optional)

Ask CIPHER for Vim advice — in character, powered by any OpenAI-compatible endpoint
(LM Studio, Ollama, OpenRouter, …). Configure endpoint + model under
Settings → NeuroVim → CIPHER uplink; leave them empty and the feature stays fully off.
During a mission, the HUD gains a CIPHER button that opens the uplink with the
mission's context attached.

Privacy: your questions plus the active mission's metadata (title, category, goal)
are sent to the endpoint you configure — never any other vault content.
```

- [ ] **Step 3: Voller Durchlauf**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: alle Tests PASS, typecheck sauber, `main.js` gebaut.

- [ ] **Step 4: Deploy in den Pallas-Vault für Jays Smoke-Test**

```bash
cp main.js manifest.json styles.css "/Users/Shared/10_ObsidianVaults/10_Pallas/.obsidian/plugins/neurovim/"
```

Dann **Handover an Jay** (manuelle Verifikation, LM Studio oder Ollama lokal gestartet):
1. Settings: Endpoint `http://localhost:1234` + geladenes Modell eintragen → UPLINK-Bereich erscheint in der Pane; Felder leeren → Bereich verschwindet, Plugin wie vorher.
2. Ohne Mission: Vim-Frage stellen (deutsch UND englisch) → gestreamte, korrekte Antwort in der Fragesprache, CIPHER-Ton.
3. Off-Topic-Frage („Wie wird das Wetter?") → in-character Abweisung + Vim-Hilfe-Angebot.
4. Mission starten → HUD zeigt CIPHER-Button; Klick öffnet Pane; `channel: <Missionstitel>` sichtbar; missionsbezogene Frage → Antwort nutzt Missionskontext.
5. CUT während des Streams → Teilantwort bleibt mit „— signal cut"; RST leert den Verlauf.
6. LM Studio stoppen, Frage stellen → „Signal lost. Check your uplink." + Detail, kein Crash.
7. Standard-Theme (moonstone/Light) + CRT-Scheme: Buttons, Input, Fehlerfarbe lesbar.

- [ ] **Step 5: Commit**

```bash
git add styles.css README.md
git commit -m "feat(ui): CIPHER uplink styling (CRT + native) + README section"
```

Release (nach grünem Smoke-Test, mit Jays Freigabe): `npm run release 0.4.0`.
