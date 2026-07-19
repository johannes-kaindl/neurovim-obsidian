# vim-dojo — AGENTS.md

> NeuroVim: Learn Vim by playing a cyberpunk spy-thriller, inside real Obsidian notes.
> Standalone, Community-Store-ready Obsidian plugin. Vendored game logic from `neurovim-standalone` monorepo.

## Stack

- **Language:** TypeScript (ES2018, strict, JSX via Preact)
- **UI:** Preact (react-jsx, preact/compat aliasing) + CodeMirror 6 (provided by Obsidian at runtime)
- **Build:** esbuild → `main.js` (CJS, tree-shaking, inline sourcemaps in dev)
- **Tests:** Vitest (node environment) — `test/obsidian-mock.ts` mocks the Obsidian API
- **Plugin ID:** `neurovim` (display name: "NeuroVim")
- **License:** AGPL-3.0-only

## Commands

| Script | Command | When |
|--------|---------|------|
| Dev | `npm run dev` | esbuild watch mode (Obsidian reloads on save) |
| Build | `npm run build` | Production bundle (no sourcemaps) |
| Typecheck | `npm run typecheck` | `tsc --noEmit` (src/ only — test/ not included) |
| Tests | `npm run test` | Vitest run all |
| Tests (watch) | `npm run test:watch` | Vitest watch mode |
| Vendor sync | `npm run vendor` | Pull core+content snapshot from neurovim-standalone monorepo |
| Release | `npm run release <version>` | Dual push (Codeberg + GitHub), changelog, tags |

## Repo structure

```
src/                    — plugin source (flat, no deep nesting)
  main.ts               — Plugin entry point (NeuroVimPlugin)
  HudMount.ts           — HUD mounting/unmounting lifecycle
  MissionHud.tsx        — HUD component (Preact)
  MissionSession.ts     — Session state: start/verify/reset/end/XP
  ObsidianHudDom.ts     — DOM placement (host-relative, not activeDocument)
  ObsidianMissionApp.ts — Editor integration (CM6 + vim mode)
  SettingsTab.ts        — Settings UI (collapsible sections)
  HubView.tsx           — Plugin pane (NEXUS/MISSIONS/GUIDE/UPLINK tabs)
  llm/                  — CIPHER uplink (endpoint resolver, chat, thinking toggle)
  storage/              — ObsidianStorage (PluginData CRUD)
  result/               — Result modal (post-submit)
  briefing/             — Mission briefing modal
  content/              — Content port adapter
  vendor/neurovim/      — Vendored from neurovim-standalone (core + content)
test/                   — Vitest tests + obsidian-mock
docs/superpowers/       — Design specs + implementation plans
  specs/                — Design docs (review before coding)
  plans/                — Implementation plans (executor artifacts, archived after merge)
scripts/                — vendor-neurovim.mjs, release.mjs
```

## Vendor model

- `src/vendor/neurovim/` is a **pinned snapshot** from `neurovim-standalone` monorepo
- Monorepo (`/Users/Shared/code/neurovim-standalone`) is the **SSOT** for game logic
- Pin tracked in `src/vendor/neurovim/VENDOR.json` (commit SHA + version)
- To sync: fix in monorepo → `npm run vendor` → verify → commit vendor + VENDOR.json
- tsconfig/esbuild alias `@neurovim/core` and `@neurovim/content` → vendor paths

## Coding conventions

### DOM creation
- **Always** use Obsidian's shorthand helpers: `el.createDiv()`, `el.createSpan()`, `el.createEl('p')`
- **Never** `el.createEl('div')` — Store Lint `prefer-create-el` flags it (the rule's tests contradict its README; trust the tests)
- HUD container: build on `host.createDiv()` (inherits host's document), NOT `activeDocument`

### Event wiring (transient elements)
- Input fields: commit on **`blur`**, NOT `onChange` (Obsidian fires onChange per keystroke → garbage entries)
- List item handlers: resolve by **value**, NOT render index (list mutations make stale indices delete wrong items)
- `Component.registerDomEvent`: only for elements that live as long as the Component. For transient/re-rendered elements use plain `addEventListener` (GC'd when detached)

### Timeouts / clocks
- Use `ClockPort` injection (never `window.setTimeout` directly) — makes timeout paths testable under Vitest

### Settings
- `display()` re-renders the entire tab (e.g. after "Test all") — persist UI state (collapsed sections) in PluginData
- `mergeStoredSettings`: do NOT spread raw `data.json` into defaults — legacy fields reappear via spread
- Changelog: write entries under `## [Unreleased]` only — `release.mjs` auto-generates version headers

### Obsidian API
- `metadataCache.getFirstLinkpathDest(link, sourcePath)` — `sourcePath` must be per-item, NOT a shared closure
- `app.readNote(path)` — async, may throw for inaccessible notes
- Plugin data: `this.data` loaded in `loadData()`, saved via `saveData(this.data)` — always merge, never replace

### Testing
- Vitest runs in node environment — DOM tests use `makeFakeEl` mock helpers
- `test/` is **not** in tsconfig's `include` — type-only imports on non-existent paths won't error
- TDD for pure logic; Settings UI has no unit tests (review gate is the safety net)

## Known gotchas

1. **Plan reference code is untested** — bugs in plan examples propagate verbatim to implementation. Review gate catches what TDD misses.
2. **`tsconfig` excludes `test/`** — type-only imports on non-existent paths in tests slip through silently
3. **`getSettingDefinitions` / declarative Settings API** — deferred. `SettingDefinitionGroup` has no `collapsible` support; migration would destroy collapsible sections. Re-evaluate when Obsidian 1.13 hits public.
4. **Endpoint probe / model context** still use `window.setTimeout` instead of ClockPort — timeout paths untested
5. **CM6 packages are external** — never bundle `@codemirror/*`; Obsidian provides them at runtime

## Cockpit

- Location: `/Users/Shared/10_ObsidianVaults/10_Pallas/25_Coding/vim-dojo/vim-dojo.md`
- Contains: status, current focus, decision log, session history
- Base file: `vim-dojo.base` (Kanban board for tasks)
- Logs: `_Log/<date>.md`
- Tasks: `_Tasks/`

## Remotes

- **Primary:** `https://codeberg.org/jkaindl/neurovim-obsidian` (origin)
- **Mirror:** `https://github.com/johannes-kaindl/neurovim-obsidian` (github-mirror)
- Dual push via `npm run release`

## Security invariant

vim-dojo **never** touches files outside the configured mission folder. Critical for Community Store review.
