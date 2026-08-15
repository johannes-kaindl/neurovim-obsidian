# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow SemVer.

## [Unreleased]

### Added
- **THE ARCHIVE** — new hub tab browsing the story layer: 9 loot artifacts and 14
  intercepted fragments, read in a modal with rendered markdown. Loot unlocks with
  your level; fragments are open from the start. The unlock state was already being
  tracked — this makes it visible.
- Archive groups collapse, and their headers show how many artifacts of the group are
  readable (`1/9`) — so a long loot list no longer buries the fragments below it. The
  collapsed state is remembered.

### Fixed
- Hub tabs wrap to a second row instead of running off the pane edge. In a narrow
  sidebar the last tab (UPLINK) was unreachable.
- The lore reader now follows the CRT colour scheme. It was built as a twin of the
  briefing modal but never inherited its palette rules, so artifacts rendered in the
  theme's colours while the hub behind them was green.
- ASCII headers in the reader scroll instead of wrapping — wrapping broke every box
  frame apart.
- Archive cards align consistently. Unlocked cards are `<button>`s and locked ones
  `<div>`s; Obsidian centres button content, so the two variants disagreed.

## [0.7.5] — 2026-08-12

### Changed
- CIPHER endpoint settings: each endpoint in the fallback list can now carry its own API key
  and model override, instead of one API key shared by every endpoint. Existing configurations
  migrate automatically — a previously-set API key is applied to every endpoint on first load
  after upgrading.
- A per-endpoint model override alone is enough to enable the CIPHER uplink — the global model
  field no longer has to be filled in as well. It stays the fallback for endpoints without an
  override, and an endpoint with neither still counts as unconfigured.
- Saving settings now takes effect on the next CIPHER request instead of after an Obsidian
  restart: an edited API key or model override no longer keeps serving the previously resolved
  endpoint configuration.

## [0.7.4] — 2026-07-29

### Changed
- Maintenance release, no functional changes. The community store did not pick up 0.7.3 —
  it reported no matching release although tag, assets and manifest were correct and publicly
  readable. This release exists to trigger a fresh scan.

## [0.7.3] — 2026-07-29

### Fixed
- **M-03 "Word Movement" was unsolvable without guessing.** The mission asks you to replace
  three surveillance codes, but neither the briefing nor the transmission said what to replace
  them *with* (`SCAN-7741` → `UNIT-7741`, `TRACE-3392` → `RELAY-3392`, `WATCH-0012` →
  `NODE-0012`). The briefing now names them, as it already did for comparable missions. Fixed
  upstream in the content monorepo and re-vendored; a new token-level invariant test there
  makes this class of defect fail the content gate instead of reaching players.

### Added
- German README (`README.de.md`) with a language switcher in both files, plus a community-store
  downloads badge.
- `CONTRIBUTING.md`, `SECURITY.md`, `LICENSING.md`, `CLA.md` and `LICENSE-DOCS`. `SECURITY.md`
  documents the threat model in full: mission-folder file access, the scope of keystroke
  recording, what CIPHER transmits and to whom, and plaintext API-key storage.

### Changed
- README: all repo-internal links are now absolute, since the community plugin directory
  renders the README without repo-root context and relative links break there. Requirements
  point at the central local-LLM setup guide instead of repeating server setup.

## [0.7.2] — 2026-07-27

### Changed
- Added a local store-lint gate: `eslint-plugin-obsidianmd` + type-checked `typescript-eslint`
  via `npm run lint` (`--max-warnings 0`) and a combined `npm run gate` (lint + typecheck +
  test). The release workflow now runs the gate instead of typecheck+test alone, so
  guideline findings surface before a release instead of during community-store review.
- Removed an unused type import (`HudPlacement`) from the settings tab.
- `npm run vendor` now copies every top-level content module instead of a hardcoded file
  list, which silently dropped new modules from the snapshot.
- Release tooling is delegated to the ecosystem's central `../tools/release/` (adds a
  preflight store checklist, a tag-state-based build and mirror verification) instead of a
  vendored copy that no longer received those fixes.
- The declared license is now `AGPL-3.0-or-later`, matching the LICENSE text that ships
  with the plugin (it was declared as `AGPL-3.0-only`). No change to the license itself.
- README restructured to the ecosystem's canonical layout: added Features, Requirements,
  Install, Usage and Configuration sections (the last documenting every setting), plus a
  badge row. Existing content was kept.

### Fixed
- The mission briefing's start button read `▶ MISSION BEGINNEN` (German) in an otherwise
  English UI — now `▶ BEGIN MISSION`.
- Frontmatter values that are YAML maps or lists no longer reach the UI as
  `[object Object]` (fixed upstream in the monorepo, vendored as `bdefaaa`).

## [0.7.1] — 2026-07-24

### Fixed
- Removed an unnecessary type assertion in the settings tab, flagged by the community-store
  review (`no-unnecessary-type-assertion`, `SettingsTab.ts`). `SettingDefinition.action`
  already carries the asserted signature after the `typeof === 'function'` guard.

## [0.7.0] — 2026-07-24

### Changed
- The default mission folder is now `_neurovim/` (was `NeuroVim/`), so it sorts with the
  other underscore-prefixed utility folders. Existing installs keep their configured folder.
- Settings now use Obsidian's declarative settings API (`getSettingDefinitions()`), so each
  setting is findable in Obsidian's global settings search on 1.13+. The collapsible sections
  are replaced by native setting groups (Missions / Appearance / CIPHER uplink). A `display()`
  fallback keeps the exact same layout on Obsidian ≤1.12, so `minAppVersion` stays at 1.7.2.

### Fixed
- Result screen: the DEBRIEF/RETRY buttons no longer hand a promise-returning function to a
  click handler that expects no return value (store-review `no-misused-promises` warning).
- Leaving the mission note no longer leaves a mission silently running. Previously the timer
  kept counting and Obsidian's global Vim mode stayed on, so `hjkl` hijacked typing in other
  notes and only ABORT restored it.
- Divergent-line highlighting is recomputed live: a line you fix clears its marker right away
  instead of staying red until the next submit.
- Hints mark the differing characters (`Emergency ex»it«` vs `ex»fil«`), so a slip of a few
  characters is visible at a glance instead of hiding in two similar-looking lines.
- A successful run without a single recorded keystroke is never stored as a best score. Such a
  run still awards XP and completion, but is labelled `UNVERIFIED` in the result. Previously a
  0 was read as "no value yet" and became an unbeatable best.
- Vendored the content fix from the monorepo (`8f5e5c3`): M-02 and two other missions demanded
  solution lines absent from their transmission and were unsolvable without knowing the answer.
  The monorepo now also gates this with a solution-derivability test.

### Added
- Missions pause when you leave the mission note: the timer stops, keystrokes stop counting,
  and your previous Vim setting is restored. Returning to the note resumes the run. The status
  bar shows the running or paused mission, and a floating reminder appears once a pause exceeds
  the configured threshold (default 5 minutes, `0` disables it).
- Live line progress in the HUD (`12/16 lines`) — see how far a restoration has come without
  submitting. Counted against the solution's line count, so a note missing lines cannot look
  complete.
- CIPHER debrief: after a successful mission, request an on-demand, sequence-based
  debriefing in the Result screen — CIPHER names wasted motion and gives the idiomatic fix.
- Run traces: the keystroke sequence of each successful run is recorded locally to
  `traces.jsonl` (toggle in Settings, on by default) for debriefs and offline balance analysis.

## [0.5.1] — 2026-07-16

### Fixed
- Use Obsidian's DOM helpers throughout (`createDiv` instead of `createEl('div')` and of
  `activeDocument.createElement`), per the store review's `prefer-create-el` rule. The floating
  HUD now builds its container from the host element, so a HUD in a pop-out window lands in that
  window rather than in whichever one happens to be active.

## [0.5.0] — 2026-07-16

### Added
- Settings are grouped into collapsible sections (Missions / Appearance / CIPHER uplink);
  the open/closed state is remembered.
- The CIPHER endpoint is now an ordered fallback list instead of a single URL — the first
  reachable one is used. One synced list covers the same local LLM server showing up as
  `localhost` at your desk and as a LAN IP on the road. Existing single-endpoint settings
  from 0.4.x migrate automatically.
- New "Model thinking" toggle (off by default): CIPHER answers straight away instead of
  deliberating. Models that always think (gpt-oss/harmony) are detected and the toggle
  disables itself instead of promising something the request can't deliver.
- The selected model's context length is shown when the endpoint reports it (LM Studio,
  Ollama).

## [0.4.3] — 2026-07-15

## [0.4.2] — 2026-07-15

## [0.4.1] — 2026-07-15

## [0.4.0] — 2026-07-15

## [0.3.0] — 2026-07-14

### Added
- Mission briefings are now shown before a mission starts. Selecting a mission opens a
  briefing modal that renders the briefing's markdown — the CIPHER transmission, objective,
  skills and XP — as CRT-styled callouts; the mission itself begins only on **▶ Mission
  beginnen**, so the story is surfaced instead of skipped straight into the editor.

### Fixed
- Light-theme readability for the fixed CRT scheme. Sidebar mission entries kept the theme's
  light button background (green-on-light, barely legible); the CRT palette now wins on those
  buttons regardless of theme.
- Briefing callouts were invisible under a light theme: Obsidian blends callouts with
  `mix-blend-mode: darken`, which erased them against the modal's dark background. They now
  render on the CRT palette in every theme.
- Removed the copy button Obsidian attaches to the briefing's ASCII code block — meaningless
  for read-only lore.

## [0.2.2] — 2026-07-12

### Changed
- The NeuroVim pane no longer opens automatically on Obsidian startup. Added an opt-in
  **Open pane on startup** setting (off by default); open the pane anytime via the ribbon
  icon or the "Open NeuroVim" command.

## [0.2.1] — 2026-07-12

### Fixed
- Keystroke counting now captures Vim normal-mode commands and navigation (`h`/`j`/`k`/`l`,
  motions, operators). These are consumed by the CodeMirror/Vim layer and never reached the
  previous `document`-level listener, so navigating showed 0 keystrokes; counting now happens
  in the capture phase, scoped to editor targets, so every mission keystroke is counted.

## [0.2.0] — 2026-07-12

### Added
- Result modal after a successful submit: replaces the plain notice with a CRT modal showing
  time / keystrokes / KS·MIN — each with a delta vs. your best (▲ improvement / ▼ regression)
  and a `NEW BEST` badge — plus the XP earned. Pure `buildResultView` view-model (unit-tested),
  rendered via an Obsidian `Modal` with the mission-scheme (CRT/native) applied to the frame.

## [0.1.0] — 2026-07-12

### Added
- MVP vertical slice: pick a mission in the NeuroVim pane (NEXUS), materialize it as a
  throwaway note in a configurable folder, edit in Obsidian's real Vim mode, submit to
  verify against the bundled solution, and record XP/best times in `data.json`.
- Standalone plugin repo with `@neurovim/core` + `@neurovim/content` vendored from the
  `neurovim-standalone` monorepo (pinned at v0.2.4).
- Editor HUD: floating mission control (mission id, timer, keystrokes, submit/reset/abort)
  over the mission note, with a `hudPlacement` setting (`auto` / `sidebar` / `box`) — sidebar
  block when the pane is open, floating box otherwise — and a per-mission dismiss (×).
- In-editor diff highlight: a failed submit marks the first divergent line in the editor.
- Color scheme setting (`CRT` fixed dark/phosphor vs. `native` Obsidian-theme-adaptive),
  applied consistently across the whole NeuroVim UI.
- Auto Vim mode setting: turns Obsidian's Vim mode on for the duration of a mission and
  restores the previous setting when it ends.
