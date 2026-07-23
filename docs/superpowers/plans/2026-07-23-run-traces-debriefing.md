# Run-Traces & CIPHER-Debriefing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the real keystroke sequence of each mission run, persist it locally as JSONL, and let CIPHER give an on-demand, sequence-based debriefing in the Result modal.

**Architecture:** A pure `RunRecorder` accumulates `{k,m?,t}` events, fed from the existing scoped capture-phase keydown handler. On successful submit, a `RunTrace` (metrics + events) is appended to `traces.jsonl` in the plugin config dir via an injected sink. The Result modal gains a `DEBRIEF` button that streams a CIPHER analysis through the existing `CipherClient`/`EndpointResolver` infra. Recording and debriefing are decoupled: recording is always-on and silent; the LLM call is on-demand.

**Tech Stack:** TypeScript (strict, Preact JSX), Vitest, Obsidian API (`vault.adapter`), vendored `@neurovim/core`, existing 0.4.x CIPHER LLM stack.

## Global Constraints

- **Security invariant:** recording only inside the CM mission editor, only while a mission is active — inherits the guards at `main.ts:88`. No `document`-wide logger. Persistence only to `this.manifest.dir/traces.jsonl` (never vault content).
- **DOM helpers:** use Obsidian shorthand (`el.createDiv()`, never `el.createEl('div')`) — Store Lint `prefer-create-el`.
- **Clocks:** timing via injected `ClockPort` (never bare `window.setTimeout`/`Date.now()` in tested code).
- **Changelog:** entries under `## [Unreleased]` only — `release.mjs` generates version headers.
- **Tests:** `npm run test` (Vitest). Pure logic is TDD; Settings/DOM have no unit tests — review is the net.
- **Naming:** neutral in code/UI ("run trace", "debrief") — never "keylogger".

---

### Task 1: Trace schema + `buildRunTrace`

**Files:**
- Create: `src/trace.ts`
- Test: `test/trace.test.ts`

**Interfaces:**
- Consumes: `RunResult` from `@neurovim/core`.
- Produces: `interface TraceEvent { k: string; m?: string; t: number }`; `interface RunTrace {...}`; `buildRunTrace(result: RunResult, events: TraceEvent[], par: number | null, ts: string): RunTrace`.

- [ ] **Step 1: Write the failing test**

```ts
// test/trace.test.ts
import { describe, it, expect } from 'vitest';
import { buildRunTrace, type TraceEvent } from '../src/trace';
import type { RunResult } from '@neurovim/core';

const result: RunResult = {
  mission_id: 'M1', elapsed_ms: 8200, keystrokes: 23, ks_per_min: 168, xp_earned: 50,
  is_new_best_time: true, is_new_best_ks: false,
  delta_time_ms: -500, delta_keystrokes: 2, delta_ks_per_min: 1.5,
};
const events: TraceEvent[] = [{ k: 'd', t: 120 }, { k: 'w', t: 190 }];

describe('buildRunTrace', () => {
  it('maps result fields, events, par and ts into a RunTrace', () => {
    const t = buildRunTrace(result, events, 11, '2026-07-23T10:00:00.000Z');
    expect(t).toEqual({
      mission_id: 'M1', ts: '2026-07-23T10:00:00.000Z', outcome: 'success',
      elapsed_ms: 8200, keystrokes: 23, ks_per_min: 168, par_keystrokes: 11,
      is_new_best_time: true, is_new_best_ks: false, events,
    });
  });

  it('accepts a null par', () => {
    expect(buildRunTrace(result, [], null, 'X').par_keystrokes).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/trace.test.ts`
Expected: FAIL — cannot find `../src/trace`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/trace.ts
import type { RunResult } from '@neurovim/core';

/** One recorded keystroke: key name, optional Vim mode, ms since mission start. */
export interface TraceEvent { k: string; m?: string; t: number }

/** A completed run's full record: metrics (from RunResult) + the keystroke sequence.
 *  Serialized one-per-line into traces.jsonl. v1 records only successful runs. */
export interface RunTrace {
  mission_id: string;
  ts: string;
  outcome: 'success';
  elapsed_ms: number;
  keystrokes: number;
  ks_per_min: number;
  par_keystrokes: number | null;
  is_new_best_time: boolean;
  is_new_best_ks: boolean;
  events: TraceEvent[];
}

export function buildRunTrace(
  result: RunResult,
  events: TraceEvent[],
  par: number | null,
  ts: string,
): RunTrace {
  return {
    mission_id: result.mission_id,
    ts,
    outcome: 'success',
    elapsed_ms: result.elapsed_ms,
    keystrokes: result.keystrokes,
    ks_per_min: result.ks_per_min,
    par_keystrokes: par,
    is_new_best_time: result.is_new_best_time,
    is_new_best_ks: result.is_new_best_ks,
    events,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/trace.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/trace.ts test/trace.test.ts
git commit -m "feat(trace): RunTrace schema + buildRunTrace"
```

---

### Task 2: `RunRecorder`

**Files:**
- Create: `src/keystrokeRecorder.ts`
- Test: `test/keystrokeRecorder.test.ts`

**Interfaces:**
- Consumes: `TraceEvent` from `src/trace.ts`; `ClockPort` from `src/vendor/kit/clock`.
- Produces: `class RunRecorder { constructor(clock: ClockPort); reset(): void; record(key: string, mode?: string): void; snapshot(): TraceEvent[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// test/keystrokeRecorder.test.ts
import { describe, it, expect } from 'vitest';
import { RunRecorder } from '../src/keystrokeRecorder';
import type { ClockPort } from '../src/vendor/kit/clock';

function fakeClock(times: number[]): ClockPort {
  let i = 0;
  return { now: () => times[Math.min(i++, times.length - 1)], setTimeout: () => 0, clearTimeout: () => {} };
}

describe('RunRecorder', () => {
  it('records keys with t relative to the reset baseline', () => {
    const r = new RunRecorder(fakeClock([1000, 1120, 1190]));
    r.reset();            // base = 1000
    r.record('d');        // t = 120
    r.record('w');        // t = 190
    expect(r.snapshot()).toEqual([{ k: 'd', t: 120 }, { k: 'w', t: 190 }]);
  });

  it('includes mode only when provided', () => {
    const r = new RunRecorder(fakeClock([0, 5]));
    r.reset();
    r.record('i', 'normal');
    expect(r.snapshot()).toEqual([{ k: 'i', m: 'normal', t: 5 }]);
  });

  it('reset clears events and rebaselines', () => {
    const r = new RunRecorder(fakeClock([0, 10, 100, 130]));
    r.reset();
    r.record('x');        // t = 10
    r.reset();            // base = 100
    r.record('y');        // t = 30
    expect(r.snapshot()).toEqual([{ k: 'y', t: 30 }]);
  });

  it('snapshot returns a defensive copy', () => {
    const r = new RunRecorder(fakeClock([0, 1]));
    r.reset();
    r.record('a');
    const snap = r.snapshot();
    snap[0].k = 'MUT';
    expect(r.snapshot()[0].k).toBe('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/keystrokeRecorder.test.ts`
Expected: FAIL — cannot find `../src/keystrokeRecorder`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/keystrokeRecorder.ts
import type { ClockPort } from './vendor/kit/clock';
import type { TraceEvent } from './trace';

/** Accumulates the keystroke sequence of one mission attempt. Pure — timing via
 *  injected ClockPort. Fed from the scoped capture-phase keydown handler in main.ts;
 *  the security scope (active mission + editor target) lives at the call site. */
export class RunRecorder {
  private events: TraceEvent[] = [];
  private base = 0;

  constructor(private readonly clock: ClockPort) {}

  /** Start a fresh attempt: drop events and rebaseline t to now. */
  reset(): void {
    this.events = [];
    this.base = this.clock.now();
  }

  record(key: string, mode?: string): void {
    const e: TraceEvent = { k: key, t: this.clock.now() - this.base };
    if (mode) e.m = mode;
    this.events.push(e);
  }

  snapshot(): TraceEvent[] {
    return this.events.map((e) => ({ ...e }));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/keystrokeRecorder.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/keystrokeRecorder.ts test/keystrokeRecorder.test.ts
git commit -m "feat(trace): RunRecorder accumulates keystroke sequence"
```

---

### Task 3: Consolidate keystroke guards + scope test

**Files:**
- Modify: `src/keystrokeCounter.ts` (add `isMissionEditorKeystroke`)
- Test: `test/keystrokeCounter.test.ts` (add cases)

**Interfaces:**
- Consumes: existing `countsAsKeystroke`, `isEditorKeydownTarget`.
- Produces: `isMissionEditorKeystroke(key: string, target: EventTarget | null): boolean` — the single guard both counting and recording sit behind. This is the testable half of the security scope (the `activeMissionId` runtime guard stays in main.ts).

- [ ] **Step 1: Write the failing test**

```ts
// append to test/keystrokeCounter.test.ts
import { isMissionEditorKeystroke } from '../src/keystrokeCounter';

const inEditor = { closest: (s: string) => (s === '.cm-editor' ? {} : null) };
const outside = { closest: (_: string) => null };

describe('isMissionEditorKeystroke (recording scope)', () => {
  it('true for a real key inside the editor', () => {
    expect(isMissionEditorKeystroke('d', inEditor as unknown as EventTarget)).toBe(true);
  });
  it('false for a bare modifier (never recorded)', () => {
    expect(isMissionEditorKeystroke('Shift', inEditor as unknown as EventTarget)).toBe(false);
  });
  it('false outside the editor (never recorded)', () => {
    expect(isMissionEditorKeystroke('d', outside as unknown as EventTarget)).toBe(false);
  });
  it('false for a null target', () => {
    expect(isMissionEditorKeystroke('d', null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/keystrokeCounter.test.ts`
Expected: FAIL — `isMissionEditorKeystroke` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to src/keystrokeCounter.ts
/**
 * The single guard both keystroke counting and trace recording sit behind: a countable
 * key pressed inside a CodeMirror editor. Consolidating them guarantees recording can
 * never have a wider scope than counting. The active-mission guard is applied separately
 * at the call site (it is runtime state, not derivable from the event).
 */
export function isMissionEditorKeystroke(key: string, target: EventTarget | null): boolean {
  return countsAsKeystroke(key) && isEditorKeydownTarget(target);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/keystrokeCounter.test.ts`
Expected: PASS (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/keystrokeCounter.ts test/keystrokeCounter.test.ts
git commit -m "refactor(keystroke): single isMissionEditorKeystroke guard + scope test"
```

---

### Task 4: `TraceStore` (append-only JSONL)

**Files:**
- Create: `src/storage/traceStore.ts`
- Test: `test/traceStore.test.ts`

**Interfaces:**
- Consumes: `RunTrace` from `src/trace.ts`.
- Produces: `interface TraceSink { append(path: string, data: string): Promise<void> }`; `class TraceStore { constructor(sink: TraceSink, path: string); append(trace: RunTrace): Promise<void> }`. Obsidian's `vault.adapter` satisfies `TraceSink`.

- [ ] **Step 1: Write the failing test**

```ts
// test/traceStore.test.ts
import { describe, it, expect, vi } from 'vitest';
import { TraceStore, type TraceSink } from '../src/storage/traceStore';
import type { RunTrace } from '../src/trace';

const trace: RunTrace = {
  mission_id: 'M1', ts: 'T', outcome: 'success', elapsed_ms: 1, keystrokes: 2,
  ks_per_min: 3, par_keystrokes: 4, is_new_best_time: false, is_new_best_ks: false,
  events: [{ k: 'd', t: 1 }],
};

function fakeSink(): TraceSink & { data: string } {
  const s = { data: '', append: async (_p: string, d: string) => { s.data += d; } };
  return s;
}

describe('TraceStore', () => {
  it('appends exactly one JSONL line per trace', async () => {
    const sink = fakeSink();
    const store = new TraceStore(sink, 'traces.jsonl');
    await store.append(trace);
    expect(sink.data).toBe(JSON.stringify(trace) + '\n');
    expect(sink.data.split('\n').filter(Boolean)).toHaveLength(1);
  });

  it('accumulates across appends', async () => {
    const sink = fakeSink();
    const store = new TraceStore(sink, 'traces.jsonl');
    await store.append(trace);
    await store.append(trace);
    expect(sink.data.split('\n').filter(Boolean)).toHaveLength(2);
  });

  it('swallows a sink failure (telemetry never breaks the run)', async () => {
    const sink: TraceSink = { append: () => Promise.reject(new Error('disk full')) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new TraceStore(sink, 'traces.jsonl');
    await expect(store.append(trace)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/traceStore.test.ts`
Expected: FAIL — cannot find `../src/storage/traceStore`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/storage/traceStore.ts
import type { RunTrace } from '../trace';

/** Minimal append sink — Obsidian's vault.adapter satisfies this (append creates on first
 *  write). Injected so the store is testable without Obsidian. */
export interface TraceSink {
  append(path: string, data: string): Promise<void>;
}

/** Append-only JSONL trace log. One run per line. Lives in the plugin config dir, never in
 *  vault content. Failures are swallowed: the run already succeeded upstream (XP persisted),
 *  telemetry must never take it down. */
export class TraceStore {
  constructor(private readonly sink: TraceSink, private readonly path: string) {}

  async append(trace: RunTrace): Promise<void> {
    try {
      await this.sink.append(this.path, JSON.stringify(trace) + '\n');
    } catch (e) {
      console.warn('NeuroVim: trace append failed', e);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/traceStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/storage/traceStore.ts test/traceStore.test.ts
git commit -m "feat(trace): TraceStore append-only JSONL sink"
```

---

### Task 5: `buildDebriefMessages` (CIPHER debrief prompt)

**Files:**
- Create: `src/llm/debriefPrompt.ts`
- Test: `test/debriefPrompt.test.ts`

**Interfaces:**
- Consumes: `LlmMessage`, `MissionContext`, `CipherKnowledge` from `src/llm/cipherPrompt`; `RunTrace` from `src/trace`.
- Produces: `serializeSequence(events: TraceEvent[]): string`; `buildDebriefMessages(args: { knowledge: CipherKnowledge; mission: MissionContext | null; trace: RunTrace }): LlmMessage[]`.

- [ ] **Step 1: Write the failing test**

```ts
// test/debriefPrompt.test.ts
import { describe, it, expect } from 'vitest';
import { buildDebriefMessages, serializeSequence } from '../src/llm/debriefPrompt';
import type { RunTrace } from '../src/trace';

const knowledge = { quickRef: 'QREF', cheatsheet: 'CHEAT' };
const mission = { id: 'M1', title: 'First Cut', category: 'delete', why: 'wasted motion is a liability', parKeystrokes: 11 };
const trace: RunTrace = {
  mission_id: 'M1', ts: 'T', outcome: 'success', elapsed_ms: 8200, keystrokes: 23,
  ks_per_min: 168, par_keystrokes: 11, is_new_best_time: true, is_new_best_ks: false,
  events: [{ k: 'l' }, { k: 'l' }, { k: 'l' }, { k: 'd' }, { k: 'w' }].map((e, i) => ({ ...e, t: i * 100 })),
};

describe('serializeSequence', () => {
  it('joins keys in order', () => {
    expect(serializeSequence(trace.events)).toBe('l l l d w');
  });
  it('marks an empty sequence', () => {
    expect(serializeSequence([])).toBe('(no keystrokes recorded)');
  });
});

describe('buildDebriefMessages', () => {
  const msgs = buildDebriefMessages({ knowledge, mission, trace });

  it('opens with a CIPHER system prompt carrying the knowledge base', () => {
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('CIPHER');
    expect(msgs[0].content).toContain('QREF');
  });
  it('puts the sequence and metrics in the user turn', () => {
    const user = msgs[msgs.length - 1];
    expect(user.role).toBe('user');
    expect(user.content).toContain('l l l d w');
    expect(user.content).toContain('23');   // keystrokes
    expect(user.content).toContain('11');   // par
  });
  it('does not crash when par is null', () => {
    const t2 = { ...trace, par_keystrokes: null };
    const m = buildDebriefMessages({ knowledge, mission: null, trace: t2 });
    expect(m[m.length - 1].content).toContain('l l l d w');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/debriefPrompt.test.ts`
Expected: FAIL — cannot find `../src/llm/debriefPrompt`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/llm/debriefPrompt.ts
/**
 * Pure prompt building for the post-mission CIPHER debrief. Distinct from the chat
 * (cipherPrompt.ts): here CIPHER comments on a completed run and adapts tone to the
 * performance. Reuses the shared CipherKnowledge/MissionContext types.
 */
import type { LlmMessage, MissionContext, CipherKnowledge } from './cipherPrompt';
import type { TraceEvent, RunTrace } from '../trace';

const DEBRIEF_PERSONA = `You are CIPHER, the operative's handler inside NeuroVim — a
cyberpunk Vim training game. The operative just completed a mission. Debrief them.

Voice: laconic, dry, watchful — CORP is listening, wasted motion is a liability. But you
are above all an excellent Vim tutor: clear, correct, concrete. Didactics beat immersion.

Adapt to the performance:
- At or under par, or a NEW BEST → a tight in-character nod. One or two lines. No lecture.
- Well over par → name the wasted motion in their actual keystroke sequence and give the
  idiomatic fix (e.g. "you walked to word 3 with l l l — 3w is one move"). Exact keys,
  then one line on WHY (operator + motion/text-object).

Rules:
- Answer in the operative's mission language; keep Vim keys verbatim (dw, ci", 3w).
- Keep it short: a few lines, no bullet-point essays.
- Never reveal story content, mission solutions, or plot.`;

export function serializeSequence(events: TraceEvent[]): string {
  if (events.length === 0) return '(no keystrokes recorded)';
  return events.map((e) => e.k).join(' ');
}

export function buildDebriefMessages(args: {
  knowledge: CipherKnowledge;
  mission: MissionContext | null;
  trace: RunTrace;
}): LlmMessage[] {
  const { knowledge, mission, trace } = args;
  const parts: string[] = [DEBRIEF_PERSONA];
  if (mission) {
    const why = mission.why ? `\nWhy this skill matters: ${mission.why}` : '';
    parts.push(`MISSION: ${mission.id} — "${mission.title}" [category: ${mission.category}]${why}`);
  }
  parts.push(`VIM QUICK REFERENCE (your knowledge base):\n${knowledge.quickRef}`);
  parts.push(`KEY CHEATSHEET:\n${knowledge.cheatsheet}`);

  const parLine = trace.par_keystrokes != null ? ` (par: ${trace.par_keystrokes})` : '';
  const secs = (trace.elapsed_ms / 1000).toFixed(1);
  const best = trace.is_new_best_time || trace.is_new_best_ks ? ' — NEW BEST' : '';
  const user =
    `Debrief this run of mission ${trace.mission_id}${best}.\n` +
    `Keystrokes: ${trace.keystrokes}${parLine}. Time: ${secs}s.\n` +
    `Keystroke sequence: ${serializeSequence(trace.events)}`;

  return [
    { role: 'system', content: parts.join('\n\n---\n\n') },
    { role: 'user', content: user },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/debriefPrompt.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/llm/debriefPrompt.ts test/debriefPrompt.test.ts
git commit -m "feat(debrief): buildDebriefMessages CIPHER debrief prompt"
```

---

### Task 6: `recordTraces` setting + toggle

**Files:**
- Modify: `src/settings.ts` (interface + default)
- Modify: `src/SettingsTab.ts` (toggle in the missions section)
- Test: `test/settings.test.ts` (default value)

**Interfaces:**
- Produces: `VimDojoSettings.recordTraces: boolean` (default `true`).

- [ ] **Step 1: Write the failing test**

```ts
// append to test/settings.test.ts
import { DEFAULT_SETTINGS } from '../src/settings';

describe('recordTraces default', () => {
  it('is on by default (local, transparent telemetry)', () => {
    expect(DEFAULT_SETTINGS.recordTraces).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/settings.test.ts`
Expected: FAIL — `recordTraces` missing.

- [ ] **Step 3: Write minimal implementation**

In `src/settings.ts`, add to the `VimDojoSettings` interface (after `llmSuppressThinking`):

```ts
  /** Record the keystroke sequence of each successful run to a local traces.jsonl
   *  (for the CIPHER debrief and offline balance analysis). Local only, never sent
   *  automatically. On by default. */
  recordTraces: boolean;
```

And to `DEFAULT_SETTINGS` (after `llmSuppressThinking: true,`):

```ts
  recordTraces: true,
```

In `src/SettingsTab.ts`, add after the "Auto Vim mode" setting block (around line 155), inside the missions section:

```ts
    new Setting(missionsEl)
      .setName('Record run traces')
      .setDesc('Save the keystroke sequence of each successful mission to a local file (traces.jsonl in the plugin folder). Powers CIPHER debriefs and offline balance analysis. Stored locally, never sent automatically. On by default.')
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.recordTraces)
          .onChange(async (v) => {
            this.plugin.settings.recordTraces = v;
            await this.plugin.saveSettings();
          }),
      );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/settings.ts src/SettingsTab.ts test/settings.test.ts
git commit -m "feat(settings): recordTraces toggle (on by default)"
```

---

### Task 7: Wire recorder + trace persistence + debrief runner into main.ts

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–6, plus existing `cipherClient`, `endpointResolver`, `cipherKnowledge`, `buildKnowledge`, `isLlmConfigured`, `realClock`.
- Produces: `type DebriefRunner` passed to `ResultModal` (Task 8): `(onToken: (t: string) => void, signal: AbortSignal) => Promise<StreamOutcome>`.

> No unit test — main.ts is wiring/DOM. Review is the net (AGENTS.md). Verify with `npm run typecheck` and `npm run build`.

- [ ] **Step 1: Add imports** (near the other local imports)

```ts
import { RunRecorder } from './keystrokeRecorder';
import { buildRunTrace } from './trace';
import { TraceStore } from './storage/traceStore';
import { buildDebriefMessages } from './llm/debriefPrompt';
import { realClock } from './vendor/kit/clock';
import { isMissionEditorKeystroke } from './keystrokeCounter';
```

Remove the now-unused `countsAsKeystroke, isEditorKeydownTarget` from the existing `./keystrokeCounter` import if they are no longer referenced elsewhere (grep first: `grep -n "countsAsKeystroke\|isEditorKeydownTarget" src/main.ts`).

- [ ] **Step 2: Add fields** (next to `cipherClient`, ~line 45)

```ts
  private recorder = new RunRecorder(realClock);
  private traceStore!: TraceStore;
```

- [ ] **Step 3: Init the store in `onload`** (after settings are loaded, before/after the keydown handler)

```ts
    this.traceStore = new TraceStore(this.app.vault.adapter, `${this.manifest.dir}/traces.jsonl`);
```

- [ ] **Step 4: Update the capture-phase keydown handler** (`main.ts:88-93`) to the consolidated guard + recording:

```ts
    this.registerDomEvent(activeDocument, 'keydown', (e: KeyboardEvent) => {
      if (!this.session.activeMissionId) return;
      if (!isMissionEditorKeystroke(e.key, e.target)) return;
      this.session.metrics.addKeystroke();
      // Vim mode is deferred (best-effort, CM internals): recorder supports `mode`, wiring
      // passes undefined for v1. CIPHER reads the raw key sequence fine without it.
      if (this.settings.recordTraces) this.recorder.record(e.key);
    }, { capture: true });
```

- [ ] **Step 5: Reset the recorder at mission start and on reset**

In the mission-open flow (where `this.session.start(...)` succeeds, around line 195 after `this.enterAutoVim();`), add:

```ts
      this.recorder.reset();
```

In `handleReset` (after `await this.session.reset();`, around line 229), add:

```ts
    this.recorder.reset();
```

- [ ] **Step 6: Build + persist the trace and pass the debrief runner on submit**

Replace the success branch body in `handleSubmit` (currently ending with the `new ResultModal(...)` line) with:

```ts
    if (res.ok) {
      if (cm) clearHighlight(cm);
      this.hint = null;
      this.session.end();
      this.restoreVim();
      this.cipherSession.setMission(null);

      const events = this.recorder.snapshot();
      const m = this.missions.find((x) => x.mission_id === res.result.mission_id);
      const par = m?.par_keystrokes ?? null;
      const trace = buildRunTrace(res.result, events, par, new Date().toISOString());
      if (this.settings.recordTraces) void this.traceStore.append(trace);

      const runDebrief = this.settings.recordTraces && isLlmConfigured(this.settings)
        ? (onToken: (t: string) => void, signal: AbortSignal) => this.runDebrief(trace, onToken, signal)
        : null;

      new ResultModal(this.app, buildResultView(res.result), this.settings.colorScheme, runDebrief).open();
    } else {
```

(Keep the existing `else` branch unchanged.)

- [ ] **Step 7: Add the `runDebrief` method** (near `handleCipherAsk`)

```ts
  /** One-shot CIPHER debrief stream for a completed run. Mirrors handleCipherAsk's
   *  resolve+retry, but standalone (no chat session state). Returns the outcome; the
   *  Result modal renders tokens via onToken and the outcome. */
  private async runDebrief(
    trace: RunTrace,
    onToken: (t: string) => void,
    signal: AbortSignal,
  ): Promise<StreamOutcome> {
    if (!isLlmConfigured(this.settings)) {
      return { ok: false, kind: 'network', detail: 'CIPHER uplink not configured', partial: '' };
    }
    this.cipherKnowledge ??= buildKnowledge();
    const m = this.missions.find((x) => x.mission_id === trace.mission_id);
    const messages = buildDebriefMessages({
      knowledge: this.cipherKnowledge,
      mission: m
        ? { id: m.mission_id, title: m.title, category: m.category, why: m.why, parKeystrokes: m.par_keystrokes }
        : null,
      trace,
    });
    const cfg = {
      apiKey: this.settings.llmApiKey,
      model: this.settings.llmModel,
      suppressThinking: this.settings.llmSuppressThinking,
    };
    const runStream = (endpoint: string): Promise<StreamOutcome> =>
      this.cipherClient.stream({ endpoint, ...cfg }, messages, onToken, signal);

    const endpoint = await this.endpointResolver.resolve();
    let outcome: StreamOutcome = endpoint === null
      ? { ok: false, kind: 'network', detail: 'no endpoint reachable', partial: '' }
      : await runStream(endpoint);

    if (endpoint !== null && !outcome.ok && outcome.kind === 'network') {
      this.endpointResolver.invalidate();
      const fresh = await this.endpointResolver.resolve();
      if (fresh !== null) outcome = await runStream(fresh);
    }
    return outcome;
  }
```

Add `RunTrace` to the type imports: `import type { RunTrace } from './trace';` (or fold into the Step-1 `buildRunTrace` import line as `import { buildRunTrace } from './trace';` + a separate `import type`).

- [ ] **Step 8: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: no errors; `main.js` written.

- [ ] **Step 9: Commit**

```bash
git add src/main.ts
git commit -m "feat(trace): wire recorder, trace persistence and debrief runner"
```

---

### Task 8: Result modal DEBRIEF button + stream area

**Files:**
- Modify: `src/result/ResultModal.tsx`

**Interfaces:**
- Consumes: `DebriefRunner` type (define + export here); `StreamOutcome` from `../llm/CipherClient`.
- Produces: `ResultModal` 4th constructor arg `runDebrief: DebriefRunner | null`.

> No unit test — Preact/DOM. Review is the net. Verify with `npm run build` and the Obsidian smoke test.

- [ ] **Step 1: Update imports and add the runner type**

```ts
import { App, Modal } from 'obsidian';
import { h, render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import type { ResultView, MetricRow } from './resultView';
import type { ColorScheme } from '../settings';
import type { StreamOutcome } from '../llm/CipherClient';

export type DebriefRunner = (
  onToken: (t: string) => void,
  signal: AbortSignal,
) => Promise<StreamOutcome>;
```

- [ ] **Step 2: Add the DebriefSection component** (above `ResultApp`)

```tsx
function DebriefSection({ runDebrief }: { runDebrief: DebriefRunner }) {
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle');
  const [text, setText] = useState('');
  const [detail, setDetail] = useState('');
  const ctrl = useRef<AbortController | null>(null);

  // Abort a live stream if the modal closes mid-debrief.
  useEffect(() => () => ctrl.current?.abort(), []);

  const start = async () => {
    setStatus('streaming');
    setText('');
    setDetail('');
    const c = new AbortController();
    ctrl.current = c;
    let acc = '';
    const outcome = await runDebrief((t) => { acc += t; setText(acc); }, c.signal);
    if (c.signal.aborted) return;
    if (outcome.ok) {
      setStatus('done');
    } else if (outcome.kind === 'aborted') {
      setStatus('idle');
    } else {
      setDetail(outcome.detail);
      // A partial answer is still useful — show it as done, else surface the error.
      setStatus(outcome.partial ? 'done' : 'error');
    }
  };

  return (
    <div class="nv-result-debrief">
      {status === 'idle' && (
        <button class="nv-btn nv-btn-debrief" onClick={start}>&gt; DEBRIEF ANFORDERN</button>
      )}
      {status === 'streaming' && (
        <div class="nv-debrief-stream">{text || '> CIPHER analysiert…'}</div>
      )}
      {status === 'done' && <div class="nv-debrief-stream">{text}</div>}
      {status === 'error' && (
        <div class="nv-debrief-error">
          Signal lost. Check your uplink.
          {detail && <span class="nv-debrief-detail">{detail}</span>}
          <button class="nv-btn nv-btn-debrief" onClick={start}>&gt; RETRY</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Render it in `ResultApp`** — add the `runDebrief` prop and the section before the actions row:

```tsx
function ResultApp({ view, runDebrief, onClose }: { view: ResultView; runDebrief: DebriefRunner | null; onClose: () => void }) {
  return (
    <div class="nv-result-body">
      <div class="nv-result-title">✓ MISSION COMPLETE</div>
      <div class="nv-result-mission">{view.title}</div>
      <div class="nv-result-xp">+{view.xp} XP</div>
      <div class="nv-result-metrics">
        {view.rows.map((row) => (
          <Row row={row} />
        ))}
      </div>
      {runDebrief && <DebriefSection runDebrief={runDebrief} />}
      <div class="nv-result-actions">
        <button class="nv-btn nv-btn-nexus" onClick={onClose}>← ZURÜCK ZUM NEXUS</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Thread the constructor arg**

```ts
export class ResultModal extends Modal {
  constructor(
    app: App,
    private view: ResultView,
    private scheme: ColorScheme,
    private runDebrief: DebriefRunner | null = null,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass('nv-result-modal', `nv-${this.scheme}`);
    this.contentEl.addClass('nv-result');
    render(
      h(ResultApp, { view: this.view, runDebrief: this.runDebrief, onClose: () => this.close() }),
      this.contentEl,
    );
  }

  onClose(): void {
    render(null, this.contentEl);
    this.contentEl.empty();
  }
}
```

- [ ] **Step 5: Add minimal styles** — append to the result-modal CSS block in `styles.css` (find it: `grep -n "nv-result" styles.css | head`):

```css
.nv-result-debrief { margin-top: 12px; }
.nv-debrief-stream {
  white-space: pre-wrap;
  font-size: 0.85em;
  line-height: 1.5;
  color: var(--nv-fg, inherit);
  border-left: 2px solid var(--nv-accent, currentColor);
  padding-left: 8px;
}
.nv-debrief-error { font-size: 0.85em; color: var(--nv-bad, #e06c75); }
.nv-debrief-detail { display: block; opacity: 0.6; font-size: 0.85em; margin: 4px 0; }
```

(Match the existing `--nv-*` variable names actually used in the result block; adjust if the grep shows different names.)

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/result/ResultModal.tsx styles.css
git commit -m "feat(debrief): DEBRIEF button + stream area in Result modal"
```

---

### Task 9: README transparency + CHANGELOG

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

> Store-compliance requires the trace recording to be documented (transparency).

- [ ] **Step 1: Add a README section** (near the CIPHER/privacy content). Verify placement with `grep -n "^## " README.md`.

```markdown
## Run traces & privacy

NeuroVim can record the keystroke sequence of each successful mission to a local file
(`traces.jsonl`, inside the plugin folder). This powers CIPHER's debrief ("you walked to
word 3 with `l l l` — `3w` is one move") and lets you analyse mission balance offline.

- **Local only.** Traces are written to your vault's plugin folder and never sent anywhere
  automatically. Requesting a CIPHER debrief sends that run's sequence to the LLM endpoint
  you configured (a local model via LM Studio/Ollama stays on your machine) — the same
  connection the CIPHER chat already uses.
- **Scoped.** Only keystrokes inside an active mission's editor are recorded. Nothing else
  in your vault is ever touched.
- **Optional.** Turn it off in Settings → "Record run traces". Delete `traces.jsonl` anytime.
```

- [ ] **Step 2: Add CHANGELOG entries** under `## [Unreleased]` (create the header only if absent; `release.mjs` owns version headers):

```markdown
### Added
- CIPHER debrief: after a successful mission, request an on-demand, sequence-based
  debriefing in the Result screen — CIPHER names wasted motion and gives the idiomatic fix.
- Run traces: the keystroke sequence of each successful run is recorded locally to
  `traces.jsonl` (toggle in Settings, on by default) for debriefs and offline balance analysis.
```

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document run traces (transparency) + CHANGELOG"
```

---

## Final verification

- [ ] `npm run test` — all green (existing 131 + new: trace, keystrokeRecorder, keystrokeCounter additions, traceStore, debriefPrompt, settings addition).
- [ ] `npm run typecheck` — clean.
- [ ] `npm run build` — `main.js` written.
- [ ] Manual smoke (Obsidian): start a mission, solve it, submit → Result modal shows DEBRIEF button (when LLM configured); click → CIPHER streams a debrief; `traces.jsonl` gains one line. With recording off, no button and no file growth.
- [ ] Scope check: keys pressed outside the mission editor (command palette, other notes) do not appear in `traces.jsonl`.

## Self-review notes (spec coverage)

- Recorder / schema / persistence / prompt / toggle / wiring / modal / docs → Tasks 1–9. ✅
- Security scope test → Task 3 (`isMissionEditorKeystroke`) + Task 7 Step 4 (single guard, active-mission gate). ✅
- Error/edge cases (no endpoint, stream error, append failure, empty sequence, toggle off) → Task 4 (append swallow), Task 5 (empty sequence), Task 7 (runDebrief null when unconfigured), Task 8 (error/retry UI). ✅
- Vim mode best-effort → deferred to `undefined` in Task 7 Step 4 with a comment; recorder keeps `mode?` for the future. ✅ (matches spec's "kein Blocker").
- Scope grenze (no analysis UI, success-only, no auto-debrief) → honoured; nothing in the plan builds them. ✅
