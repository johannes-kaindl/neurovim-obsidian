# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow SemVer.

## [Unreleased]

- Hero demo as GIF and MP4 in the README (recorded sequence on mission M-08, theme Birds of Yore); recipe `npm run sequenz`, contract in `docs/images/README.md` § Sequenzen.

## [0.11.1] — 2026-10-03

### Changed

- The README now shows screenshots of the CIPHER uplink and of the settings.
- The manual smoke checklist is merged into `docs/SMOKE.md`; README links point there.
- Internal design notes moved out of the repository; the user documentation is unchanged.

## [0.11.0] — 2026-09-30

### Added

- The GitHub release now also carries a ready-to-unpack `neurovim.zip` (the plugin folder with `main.js`, `manifest.json` and `styles.css`) and a `checksums.sha256` file. For a manual install, download the zip and unpack it into `.obsidian/plugins/` instead of creating the folder and saving three files by hand.

### Changed

- **CIPHER's sampling now comes from the model profile instead of fixed values.** Until now every question went out with temperature 0.7 and `max_tokens` 1024, plus a "don't think" switch. Now the values depend on the model family (Qwen 3.8/3.6, Gemma 4, gpt-oss; detected from the LLM Endpoint Manager or estimated from the model name) and the backend (LM Studio, Open WebUI, …), using the kit's profile table for the `companion` mode. Visible effects: (1) Models get their vendor's recommended `top_p`/`top_k`/`min_p`, so answers differ slightly from 0.10.0. (2) The temperature is the mode's 0.7 unless you override it. (3) The token budget stays 1024; if you raise the thinking level, it is raised to the family's reserve so thinking cannot eat the whole budget. (4) gpt-oss cannot be switched off — it gets its lowest level (`minimal`), never `none`. (5) An unknown model family only gets the temperature, the budget and, where the backend understands it, the thinking level.
- **Settings: the row "Model thinking" is replaced by the section "Request"** (collapsed by default, under the endpoints). It shows per model family what is sent and whether it has an effect on your backend, takes your own values, sets the thinking level, and shows the last request and any deviations (for example: the model thought although thinking is off; an empty answer because thinking used up the budget). Your old "Model thinking" choice migrates once: switched off → thinking level off, switched on → the mode's on-level. The row "Level picker in chat" in that section has no effect here — NeuroVim has no chat button; the kit option to hide it follows.
- Kit chat client 0.44.0 (no user-visible change)

## [0.10.0] — 2026-09-26

### Changed
- **CIPHER: kit chat client instead of a local one** (`obsidian-kit` 0.43.0, `chat-client` + `chat-transport`). Visible effects: (1) The timeout now measures silence, not duration — a long, healthy answer is no longer cut off after 120 s; a server that goes quiet ends the request after 120 s without data. (2) An HTTP error shows the server's reason instead of "HTTP 404: …" plus a raw body excerpt. (3) If the server refuses the stream (origin/CORS check), the client retries once without streaming instead of reporting "unreachable". (4) Answers that end at the token limit before the first word (thinking used the budget) now count as failed with a reason. Sampling stays fixed (temperature 0.7, 1024 tokens); reasoning is still not shown.
- **Hide mission folder now hides the folder's contents too** (kit `folder-hide`): the old rule hid only the folder's title row, the children stayed visible in the explorer. The rule is also applied to the main window's document even when a pop-out window is active while the plugin loads.
- Kit pin raised to `obsidian-kit` 0.43.0; the endpoint list's stylesheet copy follows (a setting inside a row keeps its label). `think-splitter.ts` is vendored under its Kit name (was `think.ts`); the local `XhrSseTransport.ts` and `folder-visibility.ts` are gone.

## [0.9.0] — 2026-09-26

### Added
- **Help row at the top of the settings** with links to the documentation and the issue tracker (kit `help-setting`, `obsidian-kit` 0.43.0).
- **Hide mission folder** setting — hides the mission folder in the file explorer
  (display only; the folder still exists and still syncs). Off by default.

### Changed
- **Endpoints come from the LLM Endpoint Manager when it is installed** (kit `endpoint-source`, `obsidian-kit` 0.41.1, `code-kit` 0.7.0 re-vendored). The manager takes precedence; your local endpoint list stays as the fallback and is unchanged while the manager is missing or off. Visible effects: (1) With the manager, the CIPHER settings section shows "Endpoints come from the LLM Endpoint Manager" (endpoint choice, model choice, a button that copies your local endpoints into the manager) instead of the local list. The local list and the models on its rows stay saved, just hidden. (2) New setting `choice` (`endpointId`, `model`) holds the choice against the manager; an older `data.json` without it loads unchanged. (3) CIPHER counts as configured whenever the manager is installed; if the manager reports no endpoint there is no fallback to the local list, and if it hands out an endpoint without a model (and none is chosen) the uplink answers "no model set for the endpoint" instead of sending an empty model. (4) The failover stays: without the manager, the first reachable local endpoint still wins, is cached, and is re-resolved after a network failure.
- **Removed the global CIPHER model setting.** Model now lives entirely on the endpoint
  row (as it already did for overrides) — a model id only means something on the endpoint
  that reports it, so "global model + per-row override" was the same information in two
  places. Existing installs migrate automatically: a configured global model is copied
  onto every endpoint that doesn't already have its own.

### Fixed
- **Tier colours readable on light themes.** With the native colour scheme on a light
  Obsidian theme, gold measured 1.3:1 and silver 2.0:1 against the pane — invisible in
  practice. Light-theme native now uses darker metals of the same hue; CRT is unchanged.
- `scripts/debrief-lab.mjs` read `llmEndpoints[0]` as a string, but the field carries objects (`{url, apiKey, model}`) since 0.9.0 — the default path without `--endpoint` threw a `TypeError` on a real `data.json`. The shape is now read by `scripts/debrief-settings.mjs` (with a unit test); the pre-0.9.0 string form still works.

### Added
- **Mastery tiers (gold/silver/bronze) after a run** — but only for missions somebody
  wrote a par for. The result modal shows a tier badge with that par, and the mission
  list marks your best run with a small diamond in its tier colour.

  Missions without an authored par show no tier at all, and that is deliberate: the
  fallback formula computes a gold threshold from difficulty alone, which for many
  missions lands below the number of characters the solution requires you to type —
  measured against real runs, it would report failure at something unreachable. About
  six of 54 missions carry a par today; the rest stay unjudged until one is written.

## [0.8.0] — 2026-08-19

### Changed
- **The CIPHER uplink now comes from `@neurovim/core`.** Prompt building, the chat
  session and the turn choreography moved upstream behind the new `LlmPort`; this
  plugin keeps what is genuinely its own — transport, SSE, endpoint resolution and
  model choice — and wires them into the port via `CorePortAdapter`. Behaviour is
  unchanged, including the distinction between CUT (the killed turn still lands its
  partial answer as "— signal cut") and RST (the turn is disowned and the channel
  cleared). 489 lines removed, 48 added.

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
