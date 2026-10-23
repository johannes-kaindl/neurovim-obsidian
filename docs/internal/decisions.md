# Decisions

The why of `neurovim-obsidian`: design decisions and reasoned deviations. Never loads on its own; the core of `AGENTS.md` points here. The derivation stays in the maintainer's cockpit.

## Design decisions

- **Game logic lives in the monorepo, the plugin vendors a snapshot.** The Obsidian plugin vendors the snapshot; the Neovim plugin is a Lua port that follows the monorepo's conformance vectors. The vendor script copies every top-level `.ts` of `packages/content/src`, because a hardcoded file list once dropped new modules and left imports unresolvable.
- **Mission run time is its own timer (`RunTimer`).** The vendored `MetricsTracker` cannot pause and counts keystrokes only.
- **Presence follows the active note.** Obsidian's Vim mode is global, so "visible somewhere" would leave Vim mode changed when the user switches to another note.
- **Settings are dual-path.** `getSettingDefinitions()` (Obsidian 1.13+) is the single truth, taken from the house canon (REGISTRY, vault-rag 0.17.0): it cleared the store warning `prefer-setting-definitions` and makes the settings searchable from 1.13; `display()` draws the same structure as the fallback for 1.12 and older (`minAppVersion` stays low).
- **CIPHER's reasoning is never shown; a reply cut off at the token limit without text is an error (`truncated`).** CIPHER is a story character, and watching it think breaks the immersion; reasoning is discarded.
- **The connection is the kit's `createLlmConnection` (Welle 15, 2026-10-09).** Endpoint source, remembered resolution, model lists, request values and the settings sections come from the kit instead of a copy in each plugin.

## Deviations from the guideline

- **UI-STANDARD (native-first):** the CRT cyberpunk look (`--nv-*` palette) is the game's interface, not a productive panel; it stays. The **hub and stream area** (Preact instead of the kit's DOM modules) belong to it; their full reasoning stands under "UI-Abweichungen" in `AGENTS.md`, where the UI standard asks for it (UI-STANDARD §1a).
- **Lint override `ui/sentence-case`** (off repo-wide), justified in `eslint.overrides.mjs`: proper nouns, a URL placeholder and the deliberate CRT-caps aesthetic.
