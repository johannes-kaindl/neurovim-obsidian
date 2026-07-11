# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow SemVer.

## [Unreleased]

### Added
- MVP vertical slice: pick a mission in the NeuroVim pane (NEXUS), materialize it as a
  throwaway note in a configurable folder, edit in Obsidian's real Vim mode, submit to
  verify against the bundled solution, and record XP/best times in `data.json`.
- Standalone plugin repo with `@neurovim/core` + `@neurovim/content` vendored from the
  `neurovim-standalone` monorepo (pinned at v0.2.4).
