# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow SemVer.

## [Unreleased]

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
