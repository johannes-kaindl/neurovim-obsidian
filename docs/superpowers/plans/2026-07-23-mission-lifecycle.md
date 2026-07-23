# Mission-Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mission pauses when you leave its note (Vim restored, timer stopped, visible reminder), resumes when you return, gives live progress feedback, and never records an untyped run as a best score.

**Architecture:** Three new pure modules (`RunTimer`, `missionPresence`, `missionProgress`) carry the logic and are unit-tested. `MissionSession` gains an explicit `idle | active | paused` state. `main.ts` only wires them to Obsidian events. Two thin DOM adapters (status bar, banner) follow the existing `ObsidianHudDom` pattern — no logic, verified by smoke test.

**Tech Stack:** TypeScript (strict, ES2018), Preact + CodeMirror 6, Vitest (node env), esbuild.

**Spec:** `docs/superpowers/specs/2026-07-23-mission-lifecycle-design.md`

## Global Constraints

- **DOM creation:** always Obsidian shorthands (`el.createDiv()`, `el.createSpan()`), never `el.createEl('div')` — Store Lint `prefer-create-el`.
- **Timeouts/clocks:** never `window.setTimeout` / `Date.now()` in tested code — inject `ClockPort` from `src/vendor/kit/clock.ts`.
- **Vendor is read-only:** nothing under `src/vendor/` may be edited. The SSOT is the `neurovim-standalone` monorepo.
- **Changelog:** entries go under `## [Unreleased]` only — `release.mjs` generates version headers.
- **Tests:** Vitest node environment, no DOM. Files in `test/`, named `<module>.test.ts`.
- **Commit messages:** English, conventional-commit prefixes, ending with the Co-Authored-By trailer used in this repo.
- **Language:** code and code comments in English; the spec and this plan are German.

---

### Task 1: RunTimer — pausable elapsed time

**Files:**
- Create: `src/RunTimer.ts`
- Test: `test/RunTimer.test.ts`

**Interfaces:**
- Consumes: `ClockPort` from `src/vendor/kit/clock.ts` (`{ now(): number; setTimeout(...); clearTimeout(...) }`)
- Produces: `class RunTimer` with `start()`, `pause()`, `resume()`, `reset()`, `elapsedMs(): number`, `get running(): boolean`

- [ ] **Step 1: Write the failing test**

Create `test/RunTimer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RunTimer } from '../src/RunTimer';
import type { ClockPort } from '../src/vendor/kit/clock';

/** Controllable clock: `at` is the current wall time in ms. */
function fakeClock(): ClockPort & { at: number } {
  const c = {
    at: 1_000,
    now: () => c.at,
    setTimeout: () => 0,
    clearTimeout: () => {},
  };
  return c;
}

describe('RunTimer', () => {
  it('accumulates time across a pause', () => {
    const clock = fakeClock();
    const t = new RunTimer(clock);
    t.start();
    clock.at += 5_000;
    t.pause();
    clock.at += 60_000;      // paused — must not count
    expect(t.elapsedMs()).toBe(5_000);
    t.resume();
    clock.at += 2_000;
    expect(t.elapsedMs()).toBe(7_000);
  });

  it('treats pause on a paused timer and resume on a running one as no-ops', () => {
    const clock = fakeClock();
    const t = new RunTimer(clock);
    t.start();
    clock.at += 1_000;
    t.pause();
    t.pause();               // idempotent
    clock.at += 10_000;
    t.resume();
    t.resume();              // idempotent — must not restart the segment
    clock.at += 1_000;
    expect(t.elapsedMs()).toBe(2_000);
  });

  it('start() discards a previous run', () => {
    const clock = fakeClock();
    const t = new RunTimer(clock);
    t.start();
    clock.at += 9_000;
    t.start();
    clock.at += 1_000;
    expect(t.elapsedMs()).toBe(1_000);
  });

  it('reset() zeroes and stops the timer', () => {
    const clock = fakeClock();
    const t = new RunTimer(clock);
    t.start();
    clock.at += 3_000;
    t.reset();
    expect(t.running).toBe(false);
    clock.at += 5_000;
    expect(t.elapsedMs()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/RunTimer.test.ts`
Expected: FAIL — `Failed to resolve import "../src/RunTimer"`

- [ ] **Step 3: Write minimal implementation**

Create `src/RunTimer.ts`:

```ts
import type { ClockPort } from './vendor/kit/clock';

/**
 * Pausable elapsed-time counter for one mission run. Accumulates completed segments and
 * adds the live one while running. Exists because the vendored MetricsTracker computes
 * `Date.now() - startTime` and has no pause — and the vendor is read-only.
 */
export class RunTimer {
  private accumulated = 0;
  /** Wall time the current segment began, or null while paused/stopped. */
  private segmentStart: number | null = null;

  constructor(private readonly clock: ClockPort) {}

  get running(): boolean { return this.segmentStart !== null; }

  /** Begin a fresh run — discards anything accumulated before. */
  start(): void {
    this.accumulated = 0;
    this.segmentStart = this.clock.now();
  }

  /** Fold the live segment into the accumulator. No-op when already paused. */
  pause(): void {
    if (this.segmentStart === null) return;
    this.accumulated += this.clock.now() - this.segmentStart;
    this.segmentStart = null;
  }

  /** Open a new segment. No-op when already running — presence sync may call this repeatedly. */
  resume(): void {
    if (this.segmentStart !== null) return;
    this.segmentStart = this.clock.now();
  }

  reset(): void {
    this.accumulated = 0;
    this.segmentStart = null;
  }

  elapsedMs(): number {
    const live = this.segmentStart === null ? 0 : this.clock.now() - this.segmentStart;
    return this.accumulated + live;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/RunTimer.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/RunTimer.ts test/RunTimer.test.ts
git commit -m "feat(timer): pausable RunTimer with injected clock"
```

---

### Task 2: missionPresence — is the mission note focused?

**Files:**
- Create: `src/missionPresence.ts`
- Test: `test/missionPresence.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type Presence = 'focused' | 'away'`; `resolvePresence(activeNotePath: string | null, missionPath: string | null): Presence`

- [ ] **Step 1: Write the failing test**

Create `test/missionPresence.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolvePresence } from '../src/missionPresence';

describe('resolvePresence', () => {
  it('is focused when the active note is the mission note', () => {
    expect(resolvePresence('_neurovim/M-02.md', '_neurovim/M-02.md')).toBe('focused');
  });

  it('is away when another note is active', () => {
    expect(resolvePresence('Daily/2026-07-23.md', '_neurovim/M-02.md')).toBe('away');
  });

  it('is away when no note is active at all', () => {
    expect(resolvePresence(null, '_neurovim/M-02.md')).toBe('away');
  });

  it('is away when no mission is running', () => {
    expect(resolvePresence('Daily/2026-07-23.md', null)).toBe('away');
    expect(resolvePresence(null, null)).toBe('away');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/missionPresence.test.ts`
Expected: FAIL — `Failed to resolve import "../src/missionPresence"`

- [ ] **Step 3: Write minimal implementation**

Create `src/missionPresence.ts`:

```ts
/** Whether the player is currently in the mission note. */
export type Presence = 'focused' | 'away';

/**
 * Decide presence from the active note alone — deliberately not "visible in some split".
 * Obsidian's Vim mode is a global setting, so the moment the cursor sits in another note
 * the player is typing there, and that is exactly when Vim has to go back.
 *
 * Clicking the sidebar, settings or the command palette does NOT make a note inactive:
 * Obsidian keeps the last markdown leaf as the active file, so HUD buttons stay usable.
 */
export function resolvePresence(
  activeNotePath: string | null,
  missionPath: string | null,
): Presence {
  if (missionPath === null) return 'away';
  return activeNotePath === missionPath ? 'focused' : 'away';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/missionPresence.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/missionPresence.ts test/missionPresence.test.ts
git commit -m "feat(lifecycle): pure presence resolution for the mission note"
```

---

### Task 3: missionProgress — line counter, delta marker, banner threshold

**Files:**
- Create: `src/missionProgress.ts`
- Test: `test/missionProgress.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface LineProgress { matched: number; total: number }`
  - `countMatchingLines(current: string, solution: string): LineProgress`
  - `markLineDelta(current: string, solution: string): { has: string; want: string }`
  - `shouldShowPausedBanner(pausedMs: number, thresholdMinutes: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `test/missionProgress.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { countMatchingLines, markLineDelta, shouldShowPausedBanner } from '../src/missionProgress';

describe('countMatchingLines', () => {
  it('counts every line when the note equals the solution', () => {
    expect(countMatchingLines('a\nb\nc', 'a\nb\nc')).toEqual({ matched: 3, total: 3 });
  });

  it('counts only positionally matching lines', () => {
    expect(countMatchingLines('a\nX\nc', 'a\nb\nc')).toEqual({ matched: 2, total: 3 });
  });

  it('measures against the solution length when lines are missing', () => {
    expect(countMatchingLines('a\nb', 'a\nb\nc\nd')).toEqual({ matched: 2, total: 4 });
  });

  it('ignores surplus lines beyond the solution', () => {
    expect(countMatchingLines('a\nb\nc\nd', 'a\nb')).toEqual({ matched: 2, total: 2 });
  });

  it('trims like getDiff so counter and submit never disagree', () => {
    expect(countMatchingLines('\n\na\nb\n\n', 'a\nb')).toEqual({ matched: 2, total: 2 });
  });
});

describe('markLineDelta', () => {
  it('marks a substitution in the middle', () => {
    const r = markLineDelta('Emergency exit: Roof access point Charlie',
                            'Emergency exfil: Roof access point Charlie');
    expect(r.has).toBe('Emergency ex»it«: Roof access point Charlie');
    expect(r.want).toBe('Emergency ex»fil«: Roof access point Charlie');
  });

  it('marks a difference at the start', () => {
    const r = markLineDelta('Xbc', 'abc');
    expect(r.has).toBe('»X«bc');
    expect(r.want).toBe('»a«bc');
  });

  it('marks a difference at the end', () => {
    const r = markLineDelta('abX', 'abc');
    expect(r.has).toBe('ab»X«');
    expect(r.want).toBe('ab»c«');
  });

  it('shows where a pure insertion belongs with an empty pair', () => {
    const r = markLineDelta('abc', 'abXc');
    expect(r.has).toBe('ab»«c');
    expect(r.want).toBe('ab»X«c');
  });

  it('shows where a pure deletion happened', () => {
    const r = markLineDelta('abXc', 'abc');
    expect(r.has).toBe('ab»X«c');
    expect(r.want).toBe('ab»«c');
  });

  it('returns identical lines untouched', () => {
    const r = markLineDelta('abc', 'abc');
    expect(r).toEqual({ has: 'abc', want: 'abc' });
  });

  it('handles an empty current line', () => {
    const r = markLineDelta('', 'abc');
    expect(r.has).toBe('»«');
    expect(r.want).toBe('»abc«');
  });
});

describe('shouldShowPausedBanner', () => {
  it('stays hidden below the threshold', () => {
    expect(shouldShowPausedBanner(4 * 60_000, 5)).toBe(false);
  });

  it('shows at and above the threshold', () => {
    expect(shouldShowPausedBanner(5 * 60_000, 5)).toBe(true);
    expect(shouldShowPausedBanner(9 * 60_000, 5)).toBe(true);
  });

  it('is disabled by a threshold of zero or less', () => {
    expect(shouldShowPausedBanner(60 * 60_000, 0)).toBe(false);
    expect(shouldShowPausedBanner(60 * 60_000, -1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/missionProgress.test.ts`
Expected: FAIL — `Failed to resolve import "../src/missionProgress"`

- [ ] **Step 3: Write minimal implementation**

Create `src/missionProgress.ts`:

```ts
/** How many solution lines the note currently reproduces. */
export interface LineProgress {
  matched: number;
  /** Line count of the SOLUTION — a note missing lines must not report itself complete. */
  total: number;
}

/**
 * Count positionally matching lines. Trims exactly like the vendored `getDiff`, so the
 * counter can never claim "16/16" for a body that submit rejects.
 */
export function countMatchingLines(current: string, solution: string): LineProgress {
  const cur = current.trim().split('\n');
  const sol = solution.trim().split('\n');
  let matched = 0;
  for (let i = 0; i < sol.length; i++) {
    if (cur[i] === sol[i]) matched++;
  }
  return { matched, total: sol.length };
}

/**
 * Wrap the differing middle of two lines in guillemets so a three-character slip
 * (`exit` vs `exfil`) is visible at a glance. Common prefix and suffix stay bare.
 * A pure insertion/deletion yields an empty pair `»«` on one side — it marks WHERE
 * something is missing rather than silently showing an unchanged-looking line.
 *
 * Guillemets are deliberately textual: the hint renders in an Obsidian `Notice`,
 * which takes no markup.
 */
export function markLineDelta(current: string, solution: string): { has: string; want: string } {
  if (current === solution) return { has: current, want: solution };

  let pre = 0;
  const maxPre = Math.min(current.length, solution.length);
  while (pre < maxPre && current[pre] === solution[pre]) pre++;

  let suf = 0;
  const maxSuf = Math.min(current.length - pre, solution.length - pre);
  while (suf < maxSuf
    && current[current.length - 1 - suf] === solution[solution.length - 1 - suf]) suf++;

  const mark = (s: string): string =>
    `${s.slice(0, pre)}»${s.slice(pre, s.length - suf)}«${s.slice(s.length - suf)}`;

  return { has: mark(current), want: mark(solution) };
}

/** Whether a pause has lasted long enough to warrant the floating banner. */
export function shouldShowPausedBanner(pausedMs: number, thresholdMinutes: number): boolean {
  if (thresholdMinutes <= 0) return false;
  return pausedMs >= thresholdMinutes * 60_000;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/missionProgress.test.ts`
Expected: PASS — 15 tests

- [ ] **Step 5: Commit**

```bash
git add src/missionProgress.ts test/missionProgress.test.ts
git commit -m "feat(feedback): line progress, character-level delta marker, banner threshold"
```

---

### Task 4: MissionSession — explicit state, pause/resume, RunTimer

**Files:**
- Modify: `src/MissionSession.ts`
- Modify: `test/MissionSession.test.ts`
- Modify: `src/main.ts:73-79` (constructor call only — full wiring is Task 9)

**Interfaces:**
- Consumes: `RunTimer` (Task 1), `ClockPort`
- Produces: `type MissionState = 'idle' | 'active' | 'paused'`; on `MissionSession`: `get state(): MissionState`, `pause(): void`, `resume(): void`, `pausedMs(): number`, `progressFor(body: string): LineProgress`, `divergentLinesFor(body: string): number[]`. `MissionSessionDeps` gains a required `clock: ClockPort`.

- [ ] **Step 1: Write the failing test**

Add to `test/MissionSession.test.ts` — first replace the `makeSession` helper (it must inject a clock), then append the new describe block:

```ts
// ── replace the existing makeSession helper with this ──
import type { ClockPort } from '../src/vendor/kit/clock';

function fakeClock(): ClockPort & { at: number } {
  const c = { at: 1_000, now: () => c.at, setTimeout: () => 0, clearTimeout: () => {} };
  return c;
}

function makeSession(app = makeFakeMissionApp()) {
  let data: PluginData = { ...DEFAULT_PLUGIN_DATA };
  const clock = fakeClock();
  const session = new MissionSession({
    app,
    content: new BundledContent(),
    getFolder: () => 'NeuroVim/',
    getData: () => data,
    setData: async (d) => { data = d; },
    clock,
  });
  return { session, app, clock, getData: () => data };
}

// ── append ──
describe('MissionSession lifecycle', () => {
  it('starts idle and becomes active on start', async () => {
    const { session } = makeSession();
    expect(session.state).toBe('idle');
    await session.start('M-01');
    expect(session.state).toBe('active');
  });

  it('stops the clock while paused and continues on resume', async () => {
    const { session, clock } = makeSession();
    await session.start('M-01');
    clock.at += 4_000;
    session.pause();
    expect(session.state).toBe('paused');
    clock.at += 100_000;                    // away — must not count
    session.resume();
    clock.at += 1_000;
    expect(session.metrics.getKeystrokes()).toBe(0);
    expect(session.elapsedMs()).toBe(5_000);
  });

  it('reports how long it has been paused', async () => {
    const { session, clock } = makeSession();
    await session.start('M-01');
    session.pause();
    clock.at += 7_000;
    expect(session.pausedMs()).toBe(7_000);
    session.resume();
    expect(session.pausedMs()).toBe(0);
  });

  it('ignores pause when idle and resume when active', async () => {
    const { session } = makeSession();
    session.pause();
    expect(session.state).toBe('idle');
    await session.start('M-01');
    session.resume();
    expect(session.state).toBe('active');
  });

  it('returns to idle on end', async () => {
    const { session } = makeSession();
    await session.start('M-01');
    session.end();
    expect(session.state).toBe('idle');
    expect(session.elapsedMs()).toBe(0);
  });

  it('reset keeps the paused state and leaves the timer stopped', async () => {
    const { session, clock } = makeSession();
    await session.start('M-01');
    clock.at += 3_000;
    session.pause();
    await session.reset();
    expect(session.state).toBe('paused');
    clock.at += 5_000;
    expect(session.elapsedMs()).toBe(0);
  });

  it('reset while active restarts the timer from zero', async () => {
    const { session, clock } = makeSession();
    await session.start('M-01');
    clock.at += 3_000;
    await session.reset();
    clock.at += 2_000;
    expect(session.elapsedMs()).toBe(2_000);
  });

  it('reports live line progress against the solution', async () => {
    const { session } = makeSession();
    await session.start('M-01');
    const doc = await new BundledContent().getMission('M-01');
    const full = session.progressFor(doc.solution!);
    expect(full.matched).toBe(full.total);
    const broken = session.progressFor('nonsense');
    expect(broken.matched).toBe(0);
  });

  it('reports divergent line indices for a body', async () => {
    const { session } = makeSession();
    await session.start('M-01');
    const doc = await new BundledContent().getMission('M-01');
    expect(session.divergentLinesFor(doc.solution!)).toEqual([]);
    expect(session.divergentLinesFor('nonsense').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/MissionSession.test.ts`
Expected: FAIL — `Property 'state' does not exist` / `session.elapsedMs is not a function`

- [ ] **Step 3: Write the implementation**

In `src/MissionSession.ts`, add the imports and the state:

```ts
import {
  MissionEngine, MetricsTracker, ProgressionEngine, getDivergentLines,
} from '@neurovim/core';
import type { PluginData, RunResult, DiffResult, MissionRecord } from '@neurovim/core';
import type { BundledContent } from './content/BundledContent';
import type { ClockPort } from './vendor/kit/clock';
import { RunTimer } from './RunTimer';
import { countMatchingLines, type LineProgress } from './missionProgress';
import { missionNotePath } from './paths';

/** Where a mission stands: no mission, being played, or waiting while you work elsewhere. */
export type MissionState = 'idle' | 'active' | 'paused';
```

> `getDivergentLines` is available from `@neurovim/core` — `src/vendor/neurovim/core/index.ts`
> re-exports `./utils/diff`. Merge it into the existing value import rather than adding a
> second import line from the same module.

Extend `MissionSessionDeps` with the clock:

```ts
export interface MissionSessionDeps {
  app: MissionApp;
  content: BundledContent;
  getFolder: () => string;
  getData: () => PluginData;
  setData: (d: PluginData) => Promise<void>;
  clock: ClockPort;
}
```

Replace the field block and add the lifecycle methods:

```ts
export class MissionSession {
  readonly metrics = new MetricsTracker();
  private readonly timer: RunTimer;
  private _state: MissionState = 'idle';
  /** Wall time the current pause began, null while not paused. */
  private _pausedAt: number | null = null;
  private _id: string | null = null;
  private _notePath: string | null = null;
  private _corrupted = '';
  private _solution = '';
  private _xpReward = 0;

  constructor(private readonly deps: MissionSessionDeps) {
    this.timer = new RunTimer(deps.clock);
  }

  get activeMissionId(): string | null { return this._id; }
  get notePath(): string | null { return this._notePath; }
  get state(): MissionState { return this._state; }

  /** Run time so far, excluding every pause. */
  elapsedMs(): number { return this.timer.elapsedMs(); }

  /** How long the current pause has lasted; 0 when not paused. */
  pausedMs(): number {
    if (this._pausedAt === null) return 0;
    return this.deps.clock.now() - this._pausedAt;
  }

  /** Suspend a running mission: the clock stops, keystrokes stop counting (guarded at
   *  the call site by `state === 'active'`). No-op unless active. */
  pause(): void {
    if (this._state !== 'active') return;
    this._state = 'paused';
    this._pausedAt = this.deps.clock.now();
    this.timer.pause();
  }

  /** Resume a paused mission. No-op unless paused — presence sync calls this repeatedly. */
  resume(): void {
    if (this._state !== 'paused') return;
    this._state = 'active';
    this._pausedAt = null;
    this.timer.resume();
  }

  /** Live progress of an arbitrary body against this mission's solution. */
  progressFor(body: string): LineProgress {
    return countMatchingLines(body, this._solution);
  }

  /** 0-based indices of the lines in `body` that differ from the solution. */
  divergentLinesFor(body: string): number[] {
    return getDivergentLines(body, this._solution);
  }
```

In `start()`, replace the two metrics lines at the end:

```ts
    this._state = 'active';
    this._pausedAt = null;
    this.metrics.reset();
    this.metrics.start();
    this.timer.start();
```

Replace `reset()` entirely — it must not resurrect a paused timer:

```ts
  async reset(): Promise<void> {
    if (!this._notePath) return;
    await this.deps.app.writeNote(this._notePath, this._corrupted);
    this.metrics.reset();
    this.metrics.start();
    this.timer.reset();
    // Only run again if the player is actually in the note; a reset from the pane
    // during a pause leaves a cleanly zeroed, stopped timer.
    if (this._state === 'active') this.timer.resume();
  }
```

In `submit()`, take the elapsed time from the timer:

```ts
    const elapsed = this.timer.elapsedMs();
```

Replace `end()`:

```ts
  end(): void {
    this._state = 'idle';
    this._pausedAt = null;
    this._id = null;
    this._notePath = null;
    this._corrupted = '';
    this._solution = '';
    this.metrics.reset();
    this.timer.reset();
  }
```

Then update the constructor call in `src/main.ts` (around line 73) so the plugin compiles:

```ts
    this.session = new MissionSession({
      app: new ObsidianMissionApp(this.app),
      content: this.content,
      getFolder: () => this.settings.missionFolder,
      getData: () => this.data,
      setData: async (d) => { this.data = d; await this.persist(); },
      clock: realClock,
    });
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run test/MissionSession.test.ts && npm run typecheck`
Expected: PASS — all MissionSession tests, typecheck clean

- [ ] **Step 5: Commit**

```bash
git add src/MissionSession.ts src/main.ts test/MissionSession.test.ts
git commit -m "feat(lifecycle): explicit mission state with pause/resume and pausable timer"
```

---

### Task 5: Honest metrics — never record an untyped run as a best

**Files:**
- Modify: `src/MissionSession.ts` (`submit()`)
- Modify: `src/result/resultView.ts`
- Modify: `src/result/ResultModal.tsx`
- Modify: `test/MissionSession.test.ts`, `test/resultView.test.ts`
- Modify: `src/main.ts:238-267` (`handleSubmit` — pass the flag through)

**Interfaces:**
- Consumes: `MissionState` (Task 4)
- Produces: `SubmitResult` success arm becomes `{ ok: true; result: RunResult; unverified: boolean }`; `ResultView` gains `unverified: boolean`; `buildResultView(r: RunResult, unverified: boolean): ResultView`

- [ ] **Step 1: Write the failing tests**

Append to `test/MissionSession.test.ts`:

```ts
describe('MissionSession unverified runs', () => {
  it('flags a zero-keystroke win and leaves best scores untouched', async () => {
    const { session, app, getData } = makeSession();
    const doc = await new BundledContent().getMission('M-01');

    // First: an honest run with keystrokes, establishing a best.
    await session.start('M-01');
    session.metrics.addKeystroke();
    session.metrics.addKeystroke();
    app.store[session.notePath!] = doc.solution!;
    const honest = await session.submit();
    expect(honest.ok).toBe(true);
    if (honest.ok) expect(honest.unverified).toBe(false);
    expect(getData().missions['M-01'].best_keystrokes).toBe(2);

    // Then: a run without a single keystroke must not overwrite it.
    session.end();
    await session.start('M-01');
    app.store[session.notePath!] = doc.solution!;
    const untyped = await session.submit();
    expect(untyped.ok).toBe(true);
    if (untyped.ok) {
      expect(untyped.unverified).toBe(true);
      expect(untyped.result.is_new_best_ks).toBe(false);
      expect(untyped.result.is_new_best_time).toBe(false);
    }
    expect(getData().missions['M-01'].best_keystrokes).toBe(2);
    expect(getData().missions['M-01'].runs).toBe(2);
  });

  it('still awards XP and completion for an unverified run', async () => {
    const { session, app, getData } = makeSession();
    const doc = await new BundledContent().getMission('M-01');
    await session.start('M-01');
    app.store[session.notePath!] = doc.solution!;
    const res = await session.submit();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.result.xp_earned).toBe(doc.xp_reward);
    expect(getData().completed_missions).toContain('M-01');
  });
});
```

Append to `test/resultView.test.ts`:

```ts
it('marks an unverified run and suppresses its new-best flags', () => {
  const view = buildResultView({
    mission_id: 'M-02',
    elapsed_ms: 12_000,
    keystrokes: 0,
    ks_per_min: 0,
    xp_earned: 15,
    is_new_best_time: false,
    is_new_best_ks: false,
    delta_time_ms: 0,
    delta_keystrokes: 0,
    delta_ks_per_min: 0,
  }, true);
  expect(view.unverified).toBe(true);
  expect(view.rows.every((r) => !r.newBest)).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/MissionSession.test.ts test/resultView.test.ts`
Expected: FAIL — `Property 'unverified' does not exist` / `Expected 1 arguments, but got 2`

- [ ] **Step 3: Write the implementation**

In `src/MissionSession.ts`, widen the result type:

```ts
type SubmitResult =
  | { ok: true; result: RunResult; unverified: boolean }
  | { ok: false; diff: DiffResult };
```

Add the helper above the class:

```ts
/**
 * Bump run bookkeeping without touching best scores. Used for unverified runs, because
 * `ProgressionEngine.recordMissionRun` reads a 0 as "no value yet" (`cur > 0 ? min : next`)
 * and would adopt it as an unbeatable best — exactly the corruption seen on 2026-07-23.
 */
function bumpRunOnly(prev: MissionRecord | undefined, today: string): MissionRecord {
  return {
    best_time_ms: prev?.best_time_ms ?? 0,
    best_keystrokes: prev?.best_keystrokes ?? 0,
    best_ks_per_min: prev?.best_ks_per_min ?? 0,
    runs: (prev?.runs ?? 0) + 1,
    last_run: today,
  };
}
```

In `submit()`, replace everything from `const metrics = ...` down to the `return { ok: true, result }`:

```ts
    const metrics = this.metrics.getResult(elapsed);
    // No keystroke means the solution was not typed (paste, already-solved note, foreign
    // sync). The win counts, the record does not.
    const unverified = metrics.keystrokes === 0;
    const today = new Date(this.deps.clock.now()).toISOString().slice(0, 10);
    const data = this.deps.getData();
    const old: MissionRecord | undefined = data.missions[this._id];
    const record = unverified
      ? bumpRunOnly(old, today)
      : ProgressionEngine.recordMissionRun(old, metrics, today);
    let next: PluginData = { ...data, missions: { ...data.missions, [this._id]: record } };

    const { new_data } = ProgressionEngine.addXp(next, this._xpReward);
    next = ProgressionEngine.recordCompletion(new_data);
    if (!next.completed_missions.includes(this._id)) {
      next = { ...next, completed_missions: [...next.completed_missions, this._id] };
    }
    await this.deps.setData(next);

    const result: RunResult = {
      mission_id: this._id,
      elapsed_ms: metrics.elapsed_ms,
      keystrokes: metrics.keystrokes,
      ks_per_min: metrics.ks_per_min,
      xp_earned: this._xpReward,
      is_new_best_time: !unverified && (!old || metrics.elapsed_ms < old.best_time_ms),
      is_new_best_ks: !unverified && (!old || metrics.keystrokes < old.best_keystrokes),
      delta_time_ms: old ? metrics.elapsed_ms - old.best_time_ms : 0,
      delta_keystrokes: old ? metrics.keystrokes - old.best_keystrokes : 0,
      delta_ks_per_min: old ? metrics.ks_per_min - old.best_ks_per_min : 0,
    };
    return { ok: true, result, unverified };
```

In `src/result/resultView.ts`, extend the view model and signature:

```ts
export interface ResultView {
  title: string;
  rows: MetricRow[];
  xp: number;
  /** Run without a single keystroke — shown as such, never recorded as a best. */
  unverified: boolean;
}

export function buildResultView(r: RunResult, unverified = false): ResultView {
  return {
    title: r.mission_id,
    xp: r.xp_earned,
    unverified,
    rows: [
      // ... unchanged rows ...
    ],
  };
}
```

In `src/result/ResultModal.tsx`, render the badge inside `ResultApp`, directly after the metrics block:

```tsx
      <div class="nv-result-metrics">
        {view.rows.map((row) => (
          <Row row={row} />
        ))}
      </div>
      {view.unverified && (
        <div class="nv-result-unverified">
          UNVERIFIED — no keystrokes recorded, not saved as a best
        </div>
      )}
```

In `src/main.ts` `handleSubmit()`, pass the flag through:

```ts
      new ResultModal(this.app, buildResultView(res.result, res.unverified), this.settings.colorScheme, runDebrief).open();
```

Add the badge style to `styles.css`, next to the other `.nv-result-*` rules:

```css
.nv-result-unverified {
  margin-top: 0.6em;
  padding: 0.4em 0.6em;
  border: 1px solid var(--nv-warn, #ffb000);
  color: var(--nv-warn, #ffb000);
  font-size: 0.85em;
  letter-spacing: 0.05em;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: PASS — all tests green, typecheck clean

- [ ] **Step 5: Commit**

```bash
git add src/MissionSession.ts src/result/ src/main.ts styles.css test/
git commit -m "fix(progression): never record a zero-keystroke run as a best score"
```

---

### Task 6: diffHighlight — many lines instead of one

**Files:**
- Modify: `src/diffHighlight.ts`
- Modify: `test/diffHighlight.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `setDivergentLines: StateEffect<number[]>`; `showDivergentLines(view: EditorView, lines: number[]): void`; `clearHighlight(view: EditorView): void` (unchanged name). The old single-line `setDivergentLine` / `showDivergentLine` are removed.

- [ ] **Step 1: Write the failing test**

Replace `test/diffHighlight.test.ts` wholesale. Note the style: these tests drive the
**StateField** via `state.update({ effects })` and never construct an `EditorView` — there
is no DOM in the vitest node environment, so `showDivergentLines`/`clearHighlight` (which
call `view.dispatch`) are not directly testable and are covered by the smoke test instead.

```ts
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { diffHighlightField, setDivergentLines } from '../src/diffHighlight';

function stateWith(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [diffHighlightField] });
}

function decoRanges(state: EditorState): Array<{ from: number; to: number }> {
  const deco = state.field(diffHighlightField);
  const out: Array<{ from: number; to: number }> = [];
  deco.between(0, Math.max(1, state.doc.length), (from, to) => { out.push({ from, to }); });
  return out;
}

describe('diffHighlight', () => {
  it('marks the given 0-based line', () => {
    let state = stateWith('line0\nline1\nline2');
    state = state.update({ effects: setDivergentLines.of([1]) }).state;
    expect(state.field(diffHighlightField).size).toBe(1);
    const line = state.doc.line(2); // 0-based index 1 → 1-based line 2
    expect(decoRanges(state)).toEqual([{ from: line.from, to: line.to }]);
  });

  it('marks several lines at once', () => {
    let state = stateWith('alpha\nbravo\ncharlie');
    state = state.update({ effects: setDivergentLines.of([0, 2]) }).state;
    expect(state.field(diffHighlightField).size).toBe(2);
  });

  it('accepts unsorted indices (RangeSetBuilder needs ascending order)', () => {
    let state = stateWith('alpha\nbravo\ncharlie');
    state = state.update({ effects: setDivergentLines.of([2, 0]) }).state;
    expect(state.field(diffHighlightField).size).toBe(2);
  });

  it('clears the decorations on an empty array', () => {
    let state = stateWith('a\nb');
    state = state.update({ effects: setDivergentLines.of([0]) }).state;
    state = state.update({ effects: setDivergentLines.of([]) }).state;
    expect(state.field(diffHighlightField).size).toBe(0);
  });

  it('ignores out-of-range line indices', () => {
    let state = stateWith('only one line');
    state = state.update({ effects: setDivergentLines.of([5]) }).state;
    expect(state.field(diffHighlightField).size).toBe(0);
  });

  it('keeps the valid indices when one is out of range', () => {
    let state = stateWith('alpha\nbravo');
    state = state.update({ effects: setDivergentLines.of([0, 99]) }).state;
    expect(state.field(diffHighlightField).size).toBe(1);
  });

  it('skips blank lines — a zero-length mark decoration is invalid in CM6', () => {
    let state = stateWith('alpha\n\ncharlie');
    state = state.update({ effects: setDivergentLines.of([0, 1, 2]) }).state;
    expect(state.field(diffHighlightField).size).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/diffHighlight.test.ts`
Expected: FAIL — `showDivergentLines is not exported`

- [ ] **Step 3: Write the implementation**

Replace `src/diffHighlight.ts` wholesale:

```ts
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';

/** Set the divergent lines (0-based indices) to highlight; an empty array clears them. */
export const setDivergentLines = StateEffect.define<number[]>();

/** CM6 field marking every line that still differs from the solution. */
export const diffHighlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setDivergentLines)) {
        const builder = new RangeSetBuilder<Decoration>();
        // RangeSetBuilder requires ascending positions; callers may pass any order.
        for (const idx of [...e.value].sort((a, b) => a - b)) {
          const lineNum = idx + 1; // 0-based index → 1-based line
          if (lineNum < 1 || lineNum > tr.state.doc.lines) continue;
          const line = tr.state.doc.line(lineNum);
          // A zero-length mark decoration is rejected by CM6 — skip blank lines.
          if (line.from === line.to) continue;
          builder.add(line.from, line.to, Decoration.mark({ class: 'nv-diff-line' }));
        }
        return builder.finish();
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Highlight exactly these lines in a live editor, replacing any previous set. */
export function showDivergentLines(view: EditorView, lines: number[]): void {
  view.dispatch({ effects: setDivergentLines.of(lines) });
}

/** Clear every divergent-line highlight in a live editor. */
export function clearHighlight(view: EditorView): void {
  view.dispatch({ effects: setDivergentLines.of([]) });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/diffHighlight.test.ts`
Expected: PASS

> `src/main.ts` still imports `showDivergentLine` and will fail typecheck until Task 9.
> That is expected; do not fix it here beyond keeping the file compiling if the repo's
> pre-commit runs typecheck — in that case apply the Task 9 import change early.

- [ ] **Step 5: Commit**

```bash
git add src/diffHighlight.ts test/diffHighlight.test.ts
git commit -m "feat(diff): highlight every divergent line, not just the first"
```

---

### Task 7: HUD — progress line and paused state

**Files:**
- Modify: `src/HudMount.ts` (`HudRenderProps`)
- Modify: `src/MissionHud.tsx`
- Modify: `styles.css`
- Modify: `test/HudMount.test.ts` (only if its fixtures construct `HudRenderProps`)

**Interfaces:**
- Consumes: `LineProgress` (Task 3)
- Produces: `HudRenderProps` gains `paused: boolean` and `progress: LineProgress | null`

- [ ] **Step 1: Extend the props type**

In `src/HudMount.ts`, add to `HudRenderProps`:

```ts
  /** Mission is suspended because the player left the note. */
  paused: boolean;
  /** Live line progress, or null when the mission note is not open. */
  progress: LineProgress | null;
```

with the import:

```ts
import type { LineProgress } from './missionProgress';
```

- [ ] **Step 2: Render them**

In `src/MissionHud.tsx`, add the progress span after the keystrokes span and a paused class on the root:

```tsx
export function MissionHud(p: HudRenderProps) {
  return (
    <div class={`nv-hud nv-${p.scheme}${p.paused ? ' is-paused' : ''}`}>
      <div class="nv-hud-row">
        <span class="nv-hud-mission">{p.id}</span>
        <span class="nv-hud-timer">{p.paused ? `${fmt(p.elapsedMs)} ⏸` : fmt(p.elapsedMs)}</span>
        <span class="nv-hud-keystrokes">{p.keystrokes} keys</span>
        {p.progress && (
          <span class="nv-hud-progress" title="Lines matching the solution">
            {p.progress.matched}/{p.progress.total} lines
          </span>
        )}
```

The rest of the component stays as it is.

- [ ] **Step 3: Style it**

Append to `styles.css`, near the other `.nv-hud-*` rules:

```css
.nv-hud-progress {
  opacity: 0.85;
  letter-spacing: 0.04em;
}

.nv-hud.is-paused {
  opacity: 0.75;
}
```

- [ ] **Step 4: Run typecheck and the full suite**

Run: `npm run typecheck && npx vitest run`
Expected: `main.ts` will report missing `paused`/`progress` in its `control` object — that is Task 9. If `test/HudMount.test.ts` builds props, add `paused: false, progress: null` to its fixtures so the suite stays green.

- [ ] **Step 5: Commit**

```bash
git add src/HudMount.ts src/MissionHud.tsx styles.css test/HudMount.test.ts
git commit -m "feat(hud): live line progress and paused indicator"
```

---

### Task 8: Status bar, paused banner, and the threshold setting

**Files:**
- Create: `src/StatusBarItem.ts`
- Create: `src/PausedBanner.ts`
- Modify: `src/settings.ts`
- Modify: `src/SettingsTab.ts` (`missionsGroup`)
- Modify: `test/settings.test.ts`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `MissionState` (Task 4)
- Produces:
  - `class StatusBarItem { constructor(el: HTMLElement); set(text: string | null): void }`
  - `class PausedBanner { constructor(host: HTMLElement); show(p: PausedBannerProps): void; hide(): void; get isShown(): boolean }` with `interface PausedBannerProps { missionId: string; scheme: ColorScheme; onReturn: () => void; onAbort: () => void }`
  - `VimDojoSettings.pausedBannerMinutes: number` (default `5`)

- [ ] **Step 1: Add the setting and its test**

Append to `test/settings.test.ts`:

```ts
it('defaults the paused-banner threshold to five minutes', () => {
  expect(DEFAULT_SETTINGS.pausedBannerMinutes).toBe(5);
});

it('keeps a stored paused-banner threshold', () => {
  expect(mergeStoredSettings({ pausedBannerMinutes: 0 }).pausedBannerMinutes).toBe(0);
});
```

Run: `npx vitest run test/settings.test.ts` → FAIL.

In `src/settings.ts`, add to the interface and the defaults:

```ts
  /** Minutes a mission may stay paused before the floating reminder appears. 0 disables it. */
  pausedBannerMinutes: number;
```

```ts
  pausedBannerMinutes: 5,
```

Run: `npx vitest run test/settings.test.ts` → PASS.

- [ ] **Step 2: Surface it in the settings tab**

In `src/SettingsTab.ts`, append to `missionsGroup()`'s items array:

```ts
      { name: 'Paused reminder after',
        desc: 'Minutes a mission may stay paused before a floating reminder appears over the workspace. The status bar always shows a paused mission. Set to 0 to disable the reminder.',
        control: { type: 'text', key: 'pausedBannerMinutes', placeholder: '5' } },
```

Text controls hand back strings, so extend the coercion in `setControlValue` — insert before the final `else`:

```ts
    // A text control hands back a string; store a non-negative number and fall back to the
    // default on anything unparseable rather than writing NaN into data.json.
    else if (key === 'pausedBannerMinutes') {
      const n = Number.parseInt(String(value), 10);
      s.pausedBannerMinutes = Number.isFinite(n) && n >= 0 ? n : 5;
    }
```

Add the coercion test to `test/settingsTabControls.test.ts`, inside the existing
`describe('SettingsTab declarative control layer')` block (the file's `makeTab` helper is
already in scope):

```ts
  it('coerces the paused-banner threshold from its text control to a sane number', async () => {
    const { tab, settings } = makeTab({ pausedBannerMinutes: 5 });
    await tab.setControlValue('pausedBannerMinutes', '10');
    expect(settings.pausedBannerMinutes).toBe(10);
    await tab.setControlValue('pausedBannerMinutes', '0');   // 0 disables the banner
    expect(settings.pausedBannerMinutes).toBe(0);
    await tab.setControlValue('pausedBannerMinutes', 'abc'); // never write NaN to data.json
    expect(settings.pausedBannerMinutes).toBe(5);
    await tab.setControlValue('pausedBannerMinutes', '-3');
    expect(settings.pausedBannerMinutes).toBe(5);
  });
```

- [ ] **Step 3: Write the two thin DOM adapters**

Create `src/StatusBarItem.ts`:

```ts
/**
 * Thin wrapper over Obsidian's status-bar element. No logic — the text is computed by the
 * caller. Not unit-tested (no DOM in the vitest node env); verified in the smoke test,
 * same as ObsidianHudDom.
 */
export class StatusBarItem {
  constructor(private readonly el: HTMLElement) {
    this.el.addClass('nv-statusbar');
  }

  /** Set the text, or pass null to show nothing. */
  set(text: string | null): void {
    if (text === null) {
      this.el.setText('');
      this.el.toggleClass('is-hidden', true);
      return;
    }
    this.el.toggleClass('is-hidden', false);
    this.el.setText(text);
  }
}
```

Create `src/PausedBanner.ts`:

```ts
import type { ColorScheme } from './settings';

export interface PausedBannerProps {
  missionId: string;
  scheme: ColorScheme;
  onReturn: () => void;
  onAbort: () => void;
}

/**
 * Floating reminder shown when a mission has been paused for a while. Deliberately not
 * mounted on the mission editor — that note is not visible, which is the whole point.
 * Thin adapter, no logic; the "when" is decided by shouldShowPausedBanner.
 */
export class PausedBanner {
  private el: HTMLElement | null = null;

  constructor(private readonly host: HTMLElement) {}

  get isShown(): boolean { return this.el !== null; }

  show(p: PausedBannerProps): void {
    // Rebuild only when the mission changed — otherwise the buttons would be recreated
    // under the user's cursor on every tick.
    if (this.el && this.el.dataset.mission === p.missionId) return;
    this.hide();
    const el = this.host.createDiv({ cls: `nv-paused-banner nv-${p.scheme}` });
    el.dataset.mission = p.missionId;
    el.createSpan({ cls: 'nv-paused-label', text: `${p.missionId} PAUSED` });
    const actions = el.createDiv({ cls: 'nv-paused-actions' });
    const ret = actions.createEl('button', { cls: 'nv-btn nv-btn-return', text: 'RETURN' });
    ret.addEventListener('click', p.onReturn);
    const abort = actions.createEl('button', { cls: 'nv-btn nv-btn-abort', text: 'ABORT' });
    abort.addEventListener('click', p.onAbort);
    this.el = el;
  }

  hide(): void {
    this.el?.remove();
    this.el = null;
  }
}
```

> `createEl('button', …)` is correct here — the lint rule `prefer-create-el` only forbids
> `createEl('div')`/`createEl('span')`, for which shorthands exist.

- [ ] **Step 4: Style the banner**

Append to `styles.css`:

```css
.nv-paused-banner {
  position: fixed;
  right: 1.5em;
  bottom: 2.5em;
  z-index: var(--layer-notice, 60);
  display: flex;
  align-items: center;
  gap: 0.8em;
  padding: 0.6em 0.9em;
  border: 1px solid var(--nv-fg, #00ff41);
  background: var(--nv-bg, #0a0a0a);
  color: var(--nv-fg, #00ff41);
  font-family: var(--font-monospace);
  letter-spacing: 0.06em;
}

.nv-paused-actions {
  display: flex;
  gap: 0.4em;
}

.nv-statusbar.is-hidden {
  display: none;
}
```

- [ ] **Step 5: Run the suite and commit**

Run: `npx vitest run && npm run typecheck`
Expected: PASS

```bash
git add src/StatusBarItem.ts src/PausedBanner.ts src/settings.ts src/SettingsTab.ts styles.css test/
git commit -m "feat(ui): status-bar mission indicator, paused banner, threshold setting"
```

---

### Task 9: Wire it all into main.ts

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–8
- Produces: no new exports

- [ ] **Step 1: Update imports and fields**

In `src/main.ts`, change the diff-highlight import and add the new ones:

```ts
import { diffHighlightField, showDivergentLines, clearHighlight } from './diffHighlight';
import { resolvePresence } from './missionPresence';
import { shouldShowPausedBanner } from './missionProgress';
import { StatusBarItem } from './StatusBarItem';
import { PausedBanner } from './PausedBanner';
import type { LineProgress } from './missionProgress';
```

Add fields to the class:

```ts
  private statusBar!: StatusBarItem;
  private banner!: PausedBanner;
  /** Lines reported divergent by the last failed submit. The live highlight is the
   *  intersection of these with the currently divergent ones, so a corrected line clears
   *  immediately while never revealing a line the player has not submitted against yet. */
  private revealedLines: number[] = [];
  /** Last known line progress; kept when the note is closed so the HUD does not flicker. */
  private progress: LineProgress | null = null;
```

- [ ] **Step 2: Wire the events in `onload()`**

After the existing `layout-change` registration, add:

```ts
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.syncPresence()));
    this.statusBar = new StatusBarItem(this.addStatusBarItem());
    this.banner = new PausedBanner(this.app.workspace.containerEl);
```

Change the keystroke guard from `if (!this.session.activeMissionId) return;` to:

```ts
      if (this.session.state !== 'active') return;
```

- [ ] **Step 3: Add presence handling**

Add these methods to the class:

```ts
  /** Path of the note the player is currently in, or null. */
  private activeNotePath(): string | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path ?? null;
  }

  /**
   * Reconcile mission state against where the player actually is. Called from
   * active-leaf-change and from the 500ms tick as a safety net for cases that fire
   * no event. Both pause/resume and the Vim latch are idempotent.
   */
  private syncPresence(): void {
    if (this.session.state === 'idle') return;
    const presence = resolvePresence(this.activeNotePath(), this.session.notePath);
    if (presence === 'away' && this.session.state === 'active') {
      this.session.pause();
      this.restoreVim();
      new Notice('>_ Mission paused — Vim restored.');
    } else if (presence === 'focused' && this.session.state === 'paused') {
      this.session.resume();
      this.enterAutoVim();
    }
    this.repaint();
  }

  /** Open the mission note again; presence sync then resumes the run. */
  private async returnToMission(): Promise<void> {
    const path = this.session.notePath;
    if (!path) return;
    const file = this.app.vault.getFileByPath(path);
    if (!file) return;
    await this.app.workspace.getLeaf(false).openFile(file);
    this.syncPresence();
  }
```

- [ ] **Step 4: Recompute the live diff and progress in `repaint()`**

At the top of `repaint()`, before building `control`, insert:

```ts
    const id = this.session.activeMissionId;
    const vimActive = this.vimEnabled();
    const paused = this.session.state === 'paused';

    // Read the body straight from CodeMirror — a vault read twice a second would be
    // wasteful and async. When the note is not open the last known values simply stand.
    const cm = this.missionEditorView();
    if (id && cm) {
      const body = cm.state.doc.toString();
      this.progress = this.session.progressFor(body);
      const divergent = new Set(this.session.divergentLinesFor(body));
      showDivergentLines(cm, this.revealedLines.filter((l) => divergent.has(l)));
    }
    if (!id) { this.progress = null; this.revealedLines = []; }
```

and delete the two now-duplicated lines that previously opened the method
(`const id = …` and `const vimActive = …`).

In the same `control` object, add the two new props **and** switch the elapsed time to the
pausable timer — `metrics.getElapsedMs()` keeps running through a pause and would show a
climbing clock on a suspended mission:

```ts
          elapsedMs: this.session.elapsedMs(),   // was: this.session.metrics.getElapsedMs()
          keystrokes: this.session.metrics.getKeystrokes(),
          paused,
          progress: this.progress,
```

At the end of `repaint()`, after the HubView block, add the status bar and banner:

```ts
    // Status bar: always present while a mission exists.
    if (id) {
      const t = Math.floor(this.session.elapsedMs() / 1000);
      const clock = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      this.statusBar.set(paused ? `▸ ${id} PAUSED ${clock}` : `▸ ${id} ${clock}`);
    } else {
      this.statusBar.set(null);
    }

    // Banner: only once a pause has outlasted the configured threshold.
    if (id && paused
      && shouldShowPausedBanner(this.session.pausedMs(), this.settings.pausedBannerMinutes)) {
      this.banner.show({
        missionId: id,
        scheme: this.settings.colorScheme,
        onReturn: () => void this.returnToMission(),
        onAbort: () => this.handleAbandon(),
      });
    } else {
      this.banner.hide();
    }
```

Have the tick call presence sync too — replace the interval line in `onload()`:

```ts
    this.tick = window.setInterval(() => { this.syncPresence(); this.repaint(); }, 500);
```

> `syncPresence()` already calls `repaint()` when a mission is running; the extra call
> keeps the HUD live while idle and costs nothing measurable.

- [ ] **Step 5: Update submit, reset, abandon and the hint**

In `handleSubmit()`, replace the highlight calls and record the revealed lines:

```ts
    if (res.ok) {
      if (cm) clearHighlight(cm);
      this.hint = null;
      this.revealedLines = [];
      this.session.end();
      // ... unchanged ...
    } else {
      this.revealedLines = cm ? this.session.divergentLinesFor(cm.state.doc.toString()) : [];
      if (cm) showDivergentLines(cm, this.revealedLines);
      const off = res.diff.lines_off;
      new Notice(`>_ ${off} line${off !== 1 ? 's' : ''} differ — keep going`);
      void this.session.requestHint().then((h) => { if (h) { this.hint = h; this.repaint(); } });
    }
```

In `handleReset()` and `handleAbandon()`, add `this.revealedLines = [];` next to the existing `this.hint = null;`.

In `onunload()`, add `this.banner.hide();` before `this.restoreVim();`.

- [ ] **Step 6: Sharpen the hint text**

In `src/MissionSession.ts`, use the delta marker in `formatHint`:

```ts
import { countMatchingLines, markLineDelta, type LineProgress } from './missionProgress';

function formatHint(lineNum: number, current: string, solution: string): string {
  const { has, want } = markLineDelta(truncate(current, 60), truncate(solution, 60));
  return `>_ Line ${lineNum} differs\n\nHas:  ${has}\n\nWant: ${want}`;
}
```

> Truncate before marking, not after — marking first would let the guillemets fall
> outside the visible window on a long line.

- [ ] **Step 7: Verify the whole build**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all tests PASS, typecheck clean, `main.js` written

- [ ] **Step 8: Commit**

```bash
git add src/main.ts src/MissionSession.ts
git commit -m "feat(lifecycle): pause on leaving the mission note, live diff, status bar, banner"
```

---

### Task 10: Changelog, AGENTS.md drift, and the smoke test

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Create: `docs/superpowers/plans/2026-07-23-mission-lifecycle-smoketest.md`

- [ ] **Step 1: Changelog**

Under `## [Unreleased]` in `CHANGELOG.md`, add:

```markdown
### Added
- Missions pause when you leave the mission note: the timer stops, Vim mode is restored, and
  the status bar keeps showing the paused run. A floating reminder appears after 5 minutes
  (configurable, 0 disables it).
- Live line progress in the HUD (`12/16 lines`) — see how far a restoration has come without
  submitting.

### Fixed
- Divergent-line highlighting is recomputed live: a corrected line clears its marker
  immediately instead of staying red until the next submit.
- Hints mark the differing characters (`Emergency ex»it«` vs `ex»fil«`), so small slips are
  visible at a glance.
- A successful run without a single recorded keystroke is no longer stored as a best score.
  It still awards XP and completion, but is labelled `UNVERIFIED` in the result.
```

- [ ] **Step 2: Fix the stale AGENTS.md gotcha**

`AGENTS.md` known-gotcha 3 claims the declarative settings API is deferred; it shipped in
`10a1169`. Replace that list item with:

```markdown
3. **Settings are dual-path** — `getSettingDefinitions()` is the single truth (Obsidian 1.13+),
   `display()` → `renderImperative()` draws the same structure for ≤1.12. Add new rows to the
   definition groups, never to `display()` alone. Stateful CIPHER rows stay `render` hatches.
```

Add a line to the "Coding conventions → Timeouts / clocks" section:

```markdown
- Mission run time lives in `RunTimer` (ClockPort-injected, pausable) — the vendored
  `MetricsTracker` cannot pause and stays keystroke-only
```

- [ ] **Step 3: Write the smoke-test checklist**

Create `docs/superpowers/plans/2026-07-23-mission-lifecycle-smoketest.md`:

```markdown
# Smoke-Test — Mission-Lifecycle (in Pallas)

Deploy first: build, copy `main.js` + `manifest.json` + `styles.css` into
`10_Pallas/.obsidian/plugins/neurovim/`, then reload Obsidian.

- [ ] Mission M-02 starten → Vim ist an, HUD zeigt `0/21 lines`
- [ ] Eine Zeile korrigieren → Zähler steigt live, ohne Submit
- [ ] Andere Notiz öffnen → Notice „Mission paused", Vim ist **aus**, normales Tippen geht
- [ ] Statusleiste unten rechts zeigt `▸ M-02 PAUSED mm:ss`, Zeit steht still
- [ ] Zurück in die Missions-Notiz → Vim wieder an, Timer läuft weiter
- [ ] In die NeuroVim-Sidebar klicken → Mission bleibt **aktiv** (pausiert nicht)
- [ ] `pausedBannerMinutes` auf 1 setzen, Notiz verlassen, 1 min warten → Banner erscheint
- [ ] Banner-RETURN öffnet die Notiz und setzt fort; Banner-ABORT beendet sauber
- [ ] Submit mit Fehler → mehrere Zeilen rot; eine davon korrigieren → nur diese wird sofort sauber
- [ ] HINT zeigt `Has: … ex»it«` / `Want: … ex»fil«`
- [ ] Mission per Copy-Paste der Lösung ohne Tastendruck abschließen → Result zeigt
      `UNVERIFIED`, `data.json` behält den alten `best_keystrokes`
- [ ] Obsidian mit pausierter Mission beenden → Vim-Einstellung ist wiederhergestellt
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md AGENTS.md docs/superpowers/plans/
git commit -m "docs: changelog, AGENTS drift fix, lifecycle smoke-test checklist"
```
