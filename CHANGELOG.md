# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow SemVer.

## [Unreleased]

### Changed

- Kit pins raised to obsidian-kit 0.61.0 / code-kit 0.28.0 (from 0.60.3 / 0.27.2). With Gemma 4 on LM Studio, "Denken aus" (thinking off) now sends the lowest level (`low`) for CIPHER, because LM Studio ignores `none` for that model and the thought would land in the answer. The debrief stays clean and the thought goes into the collapsible thinking block, but the model still thinks a little (a few tokens, a little time); the "Request" section says the setting cannot be fully switched off here. A backend or model family that this plugin's table does not know no longer throws; the Request section names it and sends only the standard fields. If the LLM Endpoint Manager is switched on after the plugin, the plugin now picks up its changes instead of staying blind for the session.
- Game core updated to 0.2.8. Every one of the 54 missions now has a measured par (before, only six showed a rating), so the rating chip appears everywhere and a few pars moved (KATA-12 22→20, KATA-13 16→15, KATA-14 14→15, R-10 24→25, R-06 14→10, R-14 30→45). Level thresholds 7 to 10 now need 900, 1150, 1300 and 1500 XP (before 1150, 1550, 2000, 2500) so one pass through the story reaches level 10; your XP is kept, so a level can rise after the update.
- A solved mission is scored by the core (`completeMission`), the same rule as in the web app and the Neovim port. Behaviour stays: XP on every completion, bests set only by a run with at least one keystroke.
- The line counter in the mission display no longer loses matches when you delete or insert lines. It aligns lines like the check does, so deleting two lines that the solution does not contain no longer drops the counter (40/45 → 38/45 before).

### Fixed

- The daily streak now counts your local day, not the UTC day. Between local midnight and the zone offset (00:00–02:00 in Berlin in summer) a mission used to count for the day before, so a streak could break or fail to grow.
- Briefings show their last line again. The plugin cut every line containing an arrow and a link; since the core dropped the dead "open to begin" line from all briefings, that filter only removed real content, such as the FRAGMENT-10 link in M-11.
- Mission content fixes from the core: straightened ASCII frames in 58 files, wrong quarters in M-12, coordinates in M-02, a clearer objective for M-04, R-20's roster data, and the level-1 briefing of M-04 now names cut and put.

## [0.14.3] — 2026-10-14

### Fixed

- CIPHER debrief no longer shows a model's thinking as part of the answer: Gemma 4 ignores the "no reasoning" request and writes its thought into the answer text, closed only by a `<channel|>` mark. The kit now recognises it (obsidian-kit 0.60.3, code-kit 0.27.2) and the result modal clears what it showed so far when the connection says it was thinking.

## [0.14.2] — 2026-10-14

### Changed

- Kit pins raised to obsidian-kit 0.60.1 / code-kit 0.27.1 (from 0.59.1 / 0.24.0). With the LLM Endpoint Manager installed, the CIPHER hints now say what is wrong — a missing API key, a switched-off endpoint, an unreachable server — instead of the generic "no endpoint". A warning about discarded request settings lists them sorted instead of in the order they were stored. Nothing else changes for you.

### Fixed

- A mission run just after midnight (local time) is now dated with your local day instead of the previous UTC day (`last_run` in the mission record; it is only stored, not shown). The daily streak is still counted by the vendored game core in UTC, so after midnight it can differ by one day from this date until the core is updated.
- The keystroke counter now works in the main window even when a pop-out window was the active one while the plugin loaded (before, it was tied to that pop-out and counted nothing in the main window, so a mission could end with 0 keystrokes). It now listens in the main window and in every pop-out.
- Settings, "CIPHER uplink": the endpoint explanation no longer appears twice; the hint that the same server can be listed as localhost and as a LAN address now sits in the intro text.

## [0.14.1] — 2026-10-12

### Changed

- Settings, endpoint list: the "move to top" and "remove endpoint" buttons stay together in one row instead of the bin icon sitting alone on a second line. The address and the model ID stay fully visible at normal window width (a very long ID gets a row of its own); in a narrow window the block of model and buttons moves to a second line as a whole, aligned to the right. Only the empty key field shows a shorter placeholder.
- Settings, "Request" section: for an endpoint whose model family or backend is not known yet, the header reads "Family: not detected yet" and "Backend: not detected yet" with a note that this is normal for a freshly added endpoint (it replaces "unknown"), and the fields say "Not sent yet — waits for the model family (see above)." instead of "Not sent — the model family is unknown".
- Kit pins raised to obsidian-kit 0.59.1 / code-kit 0.24.0 (from 0.57.0 / 0.24.0). The stored endpoint choice in `data.json` is now cleaned by the kit's shared `sanitizeChoice` instead of a local copy; the result is identical for every stored value (only non-empty strings survive), so nothing changes for you.

## [0.14.0] — 2026-10-12

### Changed

- **The context length now sits on the endpoint row.** Below an endpoint that is reachable and has a model, the settings show "Context: loaded N · max M tokens" (only "max M" when the model is not loaded; nothing when the server names no number). It used to be a separate "Context" row under the list. Each lookup now gives up after 5 seconds instead of waiting on a server that never answers.
- **A model chosen on an endpoint row can be set back to "— (server picks)".** The model dropdown has that empty option again; picking it removes the row's model, and the server answers with whatever it has loaded. The global-model option of the 0.51 line is gone, and a stored global value is no longer read.
- **Without the LLM Endpoint Manager the model choice counts for the active row only.**
- **More precise endpoint hints.** The status icons say more about a timeout and about a server that does not speak an LLM API ("Not reachable" no longer ends in a stray dash); the input hints and tooltips come in the kit's English or German wording.
- **Secrets in your questions are caught more widely.** The `Bearer <token>` rule now matches from 8 characters and ignores case, so prose such as "Bearer authentication" is replaced too; the reply still shows your original text.
- Removing the model's `<think>` blocks from a reply is linear now; a degenerate answer with tens of thousands of open `<think>` tags used to stall for seconds.

### Fixed

- **A damaged `data.json` no longer stops the plugin from starting.** A non-text value in the old `llmModel` field (for example a number) made loading fail with a TypeError.

### Internal

- Kit pins raised to obsidian-kit 0.56.0 / code-kit 0.23.0 (new vendored modules: `embedding-connection`, `endpoint-plumbing`, `endpoint-status-text`, `embeddings-client`); the endpoint list's context-line CSS is part of `styles.css`.
- The old-setting migrations use the kit's `fillMissingRowModels` and `loadRequestSettings` (the `llmSuppressThinking` switch stays here as a migration callback with `foldLegacyThinking`); the plugin's own context lookup and its test are removed.
- GUI smoke W4 measures the kit's context line (two fake endpoints, plus a counter-probe: no number from the server, no line); the screenshot recipe's fake endpoint reports a context length so `settings.png` shows the line.

## [0.13.1] — 2026-10-10

### Documentation

- Re-captured the settings screenshot to show the shared endpoint list; refreshed two stale test/smoke doc references to the removed `effectiveModel`.

## [0.13.0] — 2026-10-09

### Changed

- **Requires Obsidian 1.11.4 or newer** (was 1.7.2): API keys now live in Obsidian's keychain, which exists from that version on.
- **API keys leave `data.json`.** A key from an earlier version moves into the keychain the first time CIPHER connects or you open the settings; the settings show it as "saved" with change and remove buttons, and `data.json` no longer carries it.
- **CIPHER's connection is the kit's shared one.** The endpoint list, "Request" section and request values come from the same building block as the other plugins, so some wording changed: "Test connection" (was "Test all"), "Try this endpoint first" (was "Use first"), "Timed out — network unreachable." The "Level picker in chat" row is gone (it never did anything here), and the context-length line now sits below the "Request" section and follows a changed endpoint or model right away.
- **A slow model gets time to load.** CIPHER waits up to 10 minutes for the first word instead of 2, so a model that LM Studio loads on demand no longer aborts the question.
- **The server's own error message comes through in full** when it rejects a question (it used to be cut to the status line).
- **Secrets in your questions are not sent.** Keys, tokens (`Bearer …`) and private-key blocks are replaced by placeholders before the question leaves your machine; the reply shows them in the original again.
- Unchanged on purpose: CIPHER still hides the model's reasoning, still treats an answer cut off at the token limit without any text as an error, and still shows replies as plain text.

## [0.12.1] — 2026-10-08

### Fixed

- The store scan warned that the objective panel used a CSS feature (`box-decoration-break`) only partially supported by Obsidian 1.6.5. Removed; a code string that wraps now shows its frame open at the line break.

## [0.12.0] — 2026-10-08

### Added

- **Objective panel in the mission HUD.** The target is now visible for the whole run, not only in the briefing before the start: the HUD lists the concrete edits the mission asks for, with the exact strings set apart as code, so the only challenge left is the Vim motion. The panel is open by default and can be collapsed with its "Objective" toggle; that choice holds until the mission ends. Missions without listed steps show their summary instead. A long list scrolls inside the panel instead of covering the note.

### Fixed

- **Every mission now says exactly what to do.** Some missions could only be solved by guessing — M-04, for example, wanted five blocks in an order that was written nowhere. All 54 missions and katas now list every target (exact spellings, counts, order, what stays), and each was replayed blind from the text and that list alone. Several briefings that contradicted their own solution were corrected on the way (core v0.2.7).
- **Mission M-08 starts again.** It failed with "has no solution — cannot play".
- **Notes changed by other plugins no longer fail a mission.** Plugins such as Obsidian Linter add frontmatter (`title`, `created`, `updated`) to the mission note and strip trailing spaces; the check used to count that as wrong lines and the hint pointed at the `---` fence. Now frontmatter and trailing whitespace are ignored by the check, the line counter and the hint, and the hint's line number is the line you see in the editor.

### Changed

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
