# Contributing

Thanks for considering a contribution. This document covers bug reports, pull requests,
and the one structural rule that trips people up first: **most of the game does not live
in this repo.**

## Where to file things

- **Bugs and feature requests:** [Forgejo issues](https://git.jkaindl.de/jkaindl/neurovim-obsidian/issues) (primary).
  The GitHub mirror exists for the Obsidian Community Plugin Directory and is not actively
  monitored for issues.
- **Pull requests:** Forgejo. PRs against the GitHub mirror will be politely redirected.
- **Security issues:** see [`SECURITY.md`](SECURITY.md) — please do not file these as public issues.

## Which repo does your change belong in?

This plugin is the Obsidian delivery of NeuroVim. The game logic and all mission content
are **vendored** from the [`neurovim-standalone`](https://git.jkaindl.de/jkaindl/NeuroVIM)
monorepo, which is the single source of truth for them.

| Your change | Repo |
|---|---|
| Mission text, story, a mission that is wrong or unsolvable | `neurovim-standalone` → `packages/content` |
| Scoring, progression, XP curve, mission verification | `neurovim-standalone` → `packages/core` |
| HUD, settings, pane, CIPHER uplink, Obsidian integration | **here** |

Anything under `src/vendor/` is a pinned snapshot — editing it directly is a change that
the next `npm run vendor` silently overwrites. Fix it upstream, then re-vendor:

```bash
# in neurovim-standalone
npm run build:content && npm test
# back here
npm run vendor && npm run gate
```

The snapshot's provenance (commit SHA + version) is tracked in
`src/vendor/neurovim/VENDOR.json` and belongs in the same commit as the vendored files.

## Bug reports

Good bug reports include:

1. Obsidian version (Settings → About).
2. Plugin version (Settings → Community plugins → Installed → NeuroVim).
3. Operating system + desktop/mobile.
4. Which mission you were in, and whether Obsidian's Vim mode was on.
5. What you expected vs. what happened.
6. Any errors visible in the developer console (`Cmd/Ctrl+Shift+I` → Console tab).

**For "this mission can't be solved" reports**, please say which line you got stuck on and
what the HINT button showed. Missions whose target values are never stated anywhere are a
recurring defect class in this project — those reports are genuinely useful.

## Pull requests

### Before you start

For anything non-trivial (new features, refactors, breaking changes), please open an issue
first to discuss the approach. Small fixes (typos, obvious bugs, doc improvements) can go
straight to a PR.

### Setup

```bash
git clone https://git.jkaindl.de/jkaindl/neurovim-obsidian.git
cd neurovim-obsidian
npm install
npm run vendor     # snapshot core + content from the monorepo
npm run gate       # lint + typecheck + tests — confirm a green baseline
```

`npm run vendor` reads the monorepo from `NEUROVIM_MONOREPO`; without a local checkout of
it you can still build and test against the committed snapshot.

### Workflow

1. **Branch:** `feat/<short-name>` for features, `fix/<short-name>` for bug fixes, from `main`.
2. **TDD for pure logic:** write the failing test first under `test/`, then the
   implementation. Pure modules (`RunTimer`, `missionProgress`, `missionPresence`, the
   `llm/` helpers) are expected to arrive with tests; the Settings UI has no unit tests and
   relies on review instead.
3. **Commit:** Conventional Commits with a scope — `feat(hud): …`, `fix(uplink): …`,
   `chore(vendor): …`. One logical change per commit.
4. **Green before pushing:** `npm run gate` must pass. It runs `eslint-plugin-obsidianmd` at
   `--max-warnings 0` — the same rule set the community store scans with, so a warning here
   is a finding there.
5. **PR description:** what changed, why, and how you tested it. Link the issue if there is one.

### House rules that the linter enforces

- **No inline `// eslint-disable`.** The store review rejects them. Exceptions go into
  `eslint.config.mjs` as a file-scoped override with a written justification.
- **Obsidian's DOM helpers only** — `el.createDiv()`, `el.createSpan()`, `el.createEl('p')`.
  Never `el.createEl('div')`.
- **No direct `window.setTimeout`** in new code — inject `ClockPort` so timeout paths stay
  testable.
- `src/vendor/**` is linted under the same rules as first-party code. If lint breaks after a
  re-vendor, the fix belongs in the monorepo — never an override here.

Architecture, conventions, and known gotchas are documented in [`AGENTS.md`](AGENTS.md).

### Releases (maintainer only)

```bash
npm run release <version>
```

Dual push (Forgejo `origin` + GitHub mirror); the mirrored tag triggers the community-store
release workflow. Tags are SemVer **without** a `v` prefix.

## Code of conduct

Be kind, assume good faith, and keep discussion on the technical merits. The maintainer
reserves the right to remove comments or close issues that go off the rails.

## License of contributions

- Code under **AGPL-3.0-or-later**; by contributing you accept the [CLA](CLA.md), which
  keeps the dual-licensing option described in [`LICENSING.md`](LICENSING.md) open.
- Documentation and text under **CC BY-SA 4.0** ([`LICENSE-DOCS`](LICENSE-DOCS)).
