# vim-dojo — AGENTS.md

> NeuroVim: Learn Vim by playing a cyberpunk spy-thriller, inside real Obsidian notes.
> Standalone, Community-Store-ready Obsidian plugin. Vendored game logic from `neurovim-standalone` monorepo.

> **Workspace standards (maintainer-local):** The binding conventions live in `_docs/CONVENTIONS.md`
> in the maintainer's multi-project workspace, `../../workspace/_docs` relative to this repo — not part of this
> repo, ignore if absent in your clone. Model: comply-or-explain.

## Project character

Plugin ID `neurovim` (display name "NeuroVim"), AGPL-3.0-or-later. TypeScript (ES2018, strict) with Preact (react-jsx, preact/compat aliasing) for the UI and CodeMirror 6 provided by Obsidian at runtime. esbuild bundles to `main.js`; tests run in Vitest (node environment, `test/obsidian-mock.ts` mocks the Obsidian API). The game logic is a pinned snapshot from the `neurovim-standalone` monorepo. Why, and the layout: `docs/internal/decisions.md`, `docs/internal/architecture.md`.

## Architecture principles

- **Security invariant:** vim-dojo **never** touches files outside the configured mission folder. Critical for Community Store review.
- **The monorepo owns the game logic.** Fix it there, then `npm run vendor`; never edit `src/vendor/neurovim/` by hand.
- **CM6 packages are external** — never bundle `@codemirror/*`; Obsidian provides them at runtime.
- **Kit first:** the LLM connection is the kit's `createLlmConnection`; UI follows `../UI-STANDARD.md`.

## Commands

| Script | Command | When |
|--------|---------|------|
| Dev | `npm run dev` | esbuild watch mode (Obsidian reloads on save) |
| Build | `npm run build` | Production bundle (no sourcemaps) |
| Typecheck | `npm run typecheck` | `tsc --noEmit` (`src/`); `npm run typecheck:test` and `npm run typecheck:scripts` cover `test/` and the drivers |
| Lint | `npm run lint` | Store gate: `eslint src --max-warnings 0` |
| Gate | `npm run gate` | lint + typecheck (src, test, scripts) + test + build — run before every release |
| Tests | `npm run test` / `npm run test:watch` | Vitest run all / watch |
| GUI smoke | `npm run smoke:gui -- --port <p>` | against a second instance; `--setup` builds the staging vault first; recipe in the driver head and `docs/SMOKE.md` |
| README images | `npm run shots` | recipe in `docs/images/README.md` |
| Vendor sync | `npm run vendor` | Pull core+content snapshot from neurovim-standalone monorepo |
| Preflight | `npm run preflight <version>` | Store checklist (manifest, LICENSE, versions.json, remotes) |
| Version bump | `npm run version-bump <version>` | package.json + manifest.json + versions.json |
| Release | `npm run release <version>` | Dual push (Forgejo + GitHub), changelog, tags — only the master session |

> Release tooling lives centrally in `../tools/release/` — this repo only delegates. A clone
> without the `obsidian-plugins/` parent directory can build and test, but not release.

## Conventions

- Changelog: write entries under `## [Unreleased]` only — the release tool auto-generates version headers.
- Commits, branches and the trailer follow `CORE-GIT-04..06`; the lint gate (`check-no-inline-disables.mjs`, PROF-TS-05) forbids inline `eslint-disable`.

## Gotchas

The gotchas to one area live in `.claude/rules/` and load when a file there is read (see Context index). Two apply to the whole repo:

- **A paused mission must not count keys:** guard on `MissionSession.state === 'active'`, not on "a mission exists".
- **Code that sets `settings.llmEndpoints` directly** (smoke driver, shots) calls `plugin.llm.invalidate()` itself; `saveSettings()` does not.

## Context index

- Before you read or change DOM, event wiring, timers (`ClockPort`) or Obsidian-API code under `src/` (including the result and briefing modals): `.claude/rules/obsidian-dom-ereignisse.md`.
- Before you change mission state, the HUD, the run timer or presence (`src/MissionSession.ts`, `src/HudMount.ts`, `src/RunTimer.ts`): `.claude/rules/mission-lebenszyklus.md`.
- Before you change settings, `SettingsTab.ts` or plugin data (`src/settings.ts`, `src/SettingsTab.ts`, `src/main.ts`, `src/storage/`): `.claude/rules/einstellungen.md`.
- Before you change the LLM connection, CIPHER's request values or the endpoint config (`src/llm/`, `src/main.ts`, `src/settings.ts`, `src/SettingsTab.ts`): `.claude/rules/llm-uplink.md`.
- Before you touch lint config, tsconfig or tests: `.claude/rules/lint-und-tests.md`.
- Before you run `npm run vendor` or edit anything under `src/vendor/`: `.claude/rules/vendor.md`.
- Before you change the module layout or the vendor model: `docs/internal/architecture.md`.
- Before you take over a "decided on purpose" or a deviation from the guideline: `docs/internal/decisions.md`.
- Before you run a GUI smoke against a second instance or build a driver: `docs/SMOKE.md`, `../.claude/rules/gui-smoke-treiber.md`, `../.claude/rules/obsidian-instanz.md`, `../.claude/rules/cdp-lock.md`.
- Before you record README images: `docs/images/README.md`, `../.claude/rules/readme-shots.md`, skill `readme-shots`.
- Before a release or a store submission: `../.claude/rules/release-und-store.md`, skills `plugin-release-setup` and `store-rescan`.
- Before you change a `styles.css` or UI: `../.claude/rules/store-css.md`, `../.claude/rules/ui-bausteine.md`, `../UI-STANDARD.md`.

## Memory

- **SDD artifacts live in the cockpit, not in the repo** (CORE-META-14): specs, plans and task reports under `$VAULT/25_Coding/neurovim-obsidian/_SDD/` (maintainer-local). The repo keeps the design essence in `docs/internal/decisions.md` and `CHANGELOG.md`; `docs/superpowers/` does not exist in the repo — do not add anything there.
- **Cockpit (SSOT for status, tasks, history):** `$VAULT/25_Coding/neurovim-obsidian/neurovim-obsidian.md` (maintainer-local); read it at the start, update it at the end. Tasks in `_Tasks/`, logs in `_Log/<date>.md`.
- **Never in the repo:** absolute paths outside the repo (`/Users/…`, vault paths) — use placeholders (`$VAULT/…`, `~/…`, repo-relative). Provenance as repo name + `file:line` is welcome. Gate: `scripts/check-no-abs-paths.mjs` (part of `npm test`).

## Abweichungen von der Leitkonvention

Reasoned deviations (comply-or-explain); wording and derivation in `docs/internal/decisions.md`.

- **UI-STANDARD (native-first)** — the CRT cyberpunk look (`--nv-*` palette) is the game's interface, not a productive panel; it stays. The hub and stream-area deviations below belong to it.
- **Lint override `ui/sentence-case`** (off repo-wide, in `eslint.overrides.mjs`): proper nouns `NeuroVim`/`Vim`/`qwen3-8b`, a URL placeholder and the deliberate CRT-caps aesthetic.

## UI-Abweichungen

- **hub** — Grund: Preact/JSX-Frontend, das den Hub bei jedem 500-ms-Tick neu rendert und
  Tabs per bedingtem Rendern wechselt; `buildHubInto` ist imperativ und lebt vom
  mount-once-Umblenden per `is-hidden`. Der Kit-Modulkopf schliesst dieses Repo namentlich
  aus (`obsidian-kit/src/obsidian/hub.ts`). Dazu zwei repo-eigene Gruende: `.nv-tabs`/`.nv-tab`
  sind Vertrag von `scripts/gui-smoke.ts` und `scripts/shots.ts` (neun Fundstellen) — ein
  Wechsel auf `okit-hub-*` macht Pruefpunkte und Aufnahme-Rezept gleichzeitig blind; und
  `HUB_CSS` bringt Theme-Variablen mit, die dem CRT-Schema (`--nv-*`) widersprechen, das als
  comply-or-explain-Ausnahme dieses Repos ohnehin dokumentiert ist. Das **Verhalten** der Norm
  ist uebernommen: `a8452b1` setzt alle vier Zutaten aus `UI-STANDARD.md` §4, inklusive eines
  eigenen Label-Elements, das ellipsiert. `effectiveTab` kann zudem etwas, das das Kit nicht
  kann — einen Tab abfangen, der zur Laufzeit verschwindet (UPLINK gibt es nur bei
  konfiguriertem LLM).
  — gilt-solange: `src/HubView.tsx` enthaelt `preact`

- **stream-area** — Grund: `src/result/ResultModal.tsx` rendert den CIPHER-Debrief per
  Preact/JSX (`h`/`render`) und kann `buildStreamArea` (ein DOM-bauendes Kit-Modul) strukturell
  nicht konsumieren — dieselbe Lage wie beim Hub-Baustein. Nicht-Adoption ist laut
  `UI-STANDARD.md` §8 hier zulässig, nicht säumig. Die zwei Wirt-Eigenschaften, die kein Modul
  liefert, sind trotzdem übernommen: `.nv-result-body` bekommt `max-height`/`overflow-y: auto`
  (`70vh`, Muster wie `.nv-briefing-body`/`.nv-lore-body`), damit die Aktionsleiste bei langem
  Debrief-Text nicht unterläuft. Das zweite Kriterium (fokussiertes Tipp-Feld übersteht einen
  Repaint) trifft hier nicht zu — der Debrief-Bereich ist reine Ausgabe, kein Eingabefeld.
  — gilt-solange: `src/result/ResultModal.tsx` enthaelt `preact`

## Dach-Kontext (obsidian-plugins)

This repo lives under the coordination umbrella `<code-workspace>/obsidian-plugins/`.
**Before solving a problem:** check `../AGENTS.md` (kit-first rule) and `../REGISTRY.md`
(solution registry) — many problems are already solved in sister plugins or in `obsidian-kit`.

**Before any UI work** (views, modals, settings tabs, CSS): `../UI-STANDARD.md` is binding
(Obsidian-native first, one frontend per plugin, theme CSS variables only).
