# Architecture

Layout of `neurovim-obsidian` and how the vendored game logic gets into it. Never loads on its own; the core of `AGENTS.md` points here.

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
  llm/                  — CIPHER uplink (core port adapter, request mode/budget, request-dropped notice); the connection itself is the kit's `createLlmConnection` (vendored)
  storage/              — ObsidianStorage (PluginData CRUD)
  result/               — Result modal (post-submit)
  briefing/             — Mission briefing modal
  content/              — Content port adapter
  vendor/neurovim/      — Vendored from neurovim-standalone (core + content)
test/                   — Vitest tests + obsidian-mock
scripts/                — vendor-neurovim.mjs, GUI-smoke driver, shots and sequence recipes (release tooling is central, see Commands in `AGENTS.md`)
```

## Vendor model

`src/vendor/neurovim/` is a pinned snapshot of the `neurovim-standalone` monorepo (core + content), the Kit modules come in separately through `tools/kit-sync.json`. Pin and sync rules: `.claude/rules/vendor.md`.
