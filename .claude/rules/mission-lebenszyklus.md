---
paths:
  - "src/MissionSession.ts"
  - "src/MissionHud.tsx"
  - "src/HudMount.ts"
  - "src/ObsidianHudDom.ts"
  - "src/ObsidianMissionApp.ts"
  - "src/RunTimer.ts"
  - "src/missionPresence.ts"
  - "src/hudPlacement.ts"
  - "src/keystrokeCounter.ts"
  - "test/MissionSession.test.ts"
  - "test/RunTimer.test.ts"
  - "test/missionPresence.test.ts"
  - "test/HudMount.test.ts"
---

# Mission-Lebenszyklus, Uhren und HUD — Gotchas

Gotchas zu Session-Zustand, Anwesenheit und Zeitgeber.

## Run time

- Mission run time lives in `RunTimer` (ClockPort-injected, pausable); the vendored `MetricsTracker` cannot pause and is keystroke-only

## Mission lifecycle

- `MissionSession.state` is `idle | active | paused` — guard on `state === 'active'`, not on "a mission exists", or a paused mission counts keys typed elsewhere
- Presence comes from the **active** note (`resolvePresence`), not from "visible somewhere": Obsidian's Vim mode is global, so leaving the note must restore it
- HUD container: build on `host.createDiv()` (inherits host's document), NOT `activeDocument`
