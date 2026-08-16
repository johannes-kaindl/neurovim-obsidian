# NeuroVim (vim-dojo)

> 🇬🇧 English · [🇩🇪 Deutsch](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/README.de.md)

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/LICENSE)
[![Docs: CC BY-SA 4.0](https://img.shields.io/badge/docs-CC%20BY--SA%204.0-lightgrey.svg)](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/LICENSE-DOCS)
[![Release](https://img.shields.io/gitea/v/release/jkaindl/neurovim-obsidian?gitea_url=https%3A%2F%2Fgit.jkaindl.de&label=release)](https://git.jkaindl.de/jkaindl/neurovim-obsidian/releases)
[![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22neurovim%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=neurovim)
![Platform](https://img.shields.io/badge/platform-Obsidian%201.7.2%2B%20·%20desktop%20%26%20mobile-7c3aed)

> Learn Vim by playing a cyberpunk spy-thriller — inside Obsidian.

An AI handler named **CIPHER** assigns you "missions" that are really Vim exercises:
restore CORP-corrupted transmissions, beat the clock, earn XP. You learn Vim almost by
accident; the story is the hook.

<p align="center"><img src="https://git.jkaindl.de/jkaindl/neurovim-obsidian/raw/branch/main/docs/images/hero.png" width="820" alt="A NeuroVim mission open in an Obsidian note: the corrupted transmission in the editor with Vim mode active, and the mission HUD showing elapsed time, keystrokes and line progress"></p>

NeuroVim originally started life as an Obsidian plugin, then grew into a multi-target
game ([`neurovim-standalone`](https://git.jkaindl.de/jkaindl/NeuroVIM): web + desktop +
Obsidian). **vim-dojo** brings it back home as a first-class, standalone Obsidian plugin.

## Features

- **54 playable missions** across two story arcs — 40 story transmissions and 14 katas,
  each one a Vim exercise disguised as a transmission repair job. Missions unlock as you
  level up.
- **Real Vim, real notes.** Missions materialize as throwaway notes you edit with
  Obsidian's own Vim mode — not a simulator, not a sandbox widget.
- **Mission HUD** with live line progress, elapsed time, keystroke count, and a diff
  highlight that clears each line the moment you get it right.
- **Hints on demand** — character-precise, showing exactly where your line diverges
  (`ex»it«` vs `ex»fil«`).
- **XP, levels, and best scores** per mission (time and keystrokes), so a mission you
  already solved becomes a speedrun target.
- **Pause-safe.** Leave the mission note and the timer stops, Vim mode is restored, and a
  banner offers RETURN or ABORT — no phantom keystrokes from typing elsewhere.
- **CIPHER uplink** (optional) — in-character Vim advice and post-run debriefs from any
  OpenAI-compatible LLM endpoint, including fully local ones.
- **Cheatsheet** — a searchable Vim reference built into the pane.

<img src="https://git.jkaindl.de/jkaindl/neurovim-obsidian/raw/branch/main/docs/images/briefing.png" width="584" alt="The mission briefing: CIPHER explaining the job in character before the mission starts">

<img src="https://git.jkaindl.de/jkaindl/neurovim-obsidian/raw/branch/main/docs/images/missions.png" width="412" alt="The MISSIONS tab: completed missions marked with a check, available ones showing their XP reward, later ones still locked">

## Requirements

- **Obsidian 1.7.2 or newer**, desktop or mobile.
- **Obsidian's Vim mode** (Settings → Editor → Vim key bindings) for the intended
  experience. Without it the game still works — you just fix transmissions without Vim
  keybindings, which rather misses the point.
- **Optional, for CIPHER only:** an OpenAI-compatible endpoint (LM Studio, Ollama,
  OpenRouter, …). Leave the endpoint list empty and the whole feature stays off. Setting up
  a local LLM server is covered once, centrally, in the
  [local LLM setup guide](https://uplink.jkaindl.de/llm-setup) — including the `/v1` pitfall
  and reaching your desktop server from a phone.

## Install

**From the community store:** Settings → Community plugins → Browse → search "NeuroVim" →
Install → Enable.

**Manually, from a release:** download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://git.jkaindl.de/jkaindl/neurovim-obsidian/releases) into
`<vault>/.obsidian/plugins/neurovim/`, then enable NeuroVim under Community plugins.

Building from source is described under [Develop / build from source](#develop--build-from-source).

## Usage

Open the pane via the ribbon's terminal icon or the command **NeuroVim: Open**. It is
organized in tabs:

- **NEXUS** — your status (level/XP), the welcome transmission, and a one-click
  "next mission" button.
- **MISSIONS** — the full mission list.
- **GUIDE** — a searchable Vim cheatsheet (filter by key or description).
- **UPLINK** — the CIPHER chat (appears once an endpoint is configured).

A mission runs like this:

1. Pick a mission (or hit "next mission"). A briefing explains the objective; **BEGIN
   MISSION** materializes the transmission as a note and starts the timer.
2. Fix the corrupted lines in the note using Vim. The HUD tracks progress, time and
   keystrokes; **HINT** points at the first line that still diverges.
3. **SUBMIT** when the text matches. You earn XP, and your time and keystroke count are
   recorded — beating them later is the actual game.

Commands available in the palette: **NeuroVim: Open**, **NeuroVim: Submit mission**,
**NeuroVim: Reset mission**.

## Configuration

Settings → NeuroVim, grouped into **Missions**, **Appearance**, and **CIPHER uplink**;
each section remembers whether you left it open or closed.

### Missions

- **Mission folder** — where throwaway mission notes are created (default `_neurovim/`).
- **Auto Vim mode** — turn Obsidian's Vim mode on while a mission is active and restore
  your previous setting when it ends. Note that this changes your *global* editor Vim
  setting for the duration.
- **Open pane on startup** — off by default; the pane opens only when you ask for it.
- **Paused reminder after** — minutes a paused mission may sit before the floating
  reminder appears; `0` disables it. A paused mission always shows in the status bar
  either way.
- **Record run traces** — see [Run traces & privacy](#run-traces--privacy).

### Appearance

- **HUD placement** — where mission control (timer, submit/reset/abort) appears during a
  mission. The floating box can also be dismissed per mission via its × button.
- **CRT color scheme** — on: a fixed cyberpunk look (dark background, phosphor green),
  theme-independent and always legible. Off: adaptive colors that blend into your
  light/dark Obsidian theme.

### CIPHER uplink

- **Endpoints** — an ordered list rather than a single URL. The first reachable endpoint
  wins, so one synced list covers the same local LLM server showing up as `localhost` at
  your desk and as a LAN IP on the road. Add endpoints via presets or by typing a URL;
  "Test all" probes every entry and marks the active one. Existing single-endpoint configs
  from 0.4.x migrate automatically — nothing to do on upgrade.
- **Model** — picked from a dropdown populated by the active endpoint's `/v1/models`, with
  a free-text fallback if the list is empty or the endpoint is unreachable. When the
  endpoint reports it (LM Studio, Ollama), the model's context length is shown alongside.
- **Model thinking** — off by default, which is the faster path: CIPHER answers straight
  away instead of deliberating. Turn it on if you want the model to reason before
  answering. Models that always think (gpt-oss/harmony) are detected and the toggle
  disables itself with an explanation, since it can't turn those off anyway.
- **API key** — optional, for endpoints that require one.

<img src="https://git.jkaindl.de/jkaindl/neurovim-obsidian/raw/branch/main/docs/images/archive.png" width="412" alt="The ARCHIVE tab: a recovered loot artifact next to locked ones, each showing the level needed to unlock it">

<img src="https://git.jkaindl.de/jkaindl/neurovim-obsidian/raw/branch/main/docs/images/reader.png" width="584" alt="A lore artifact open in the reader, rendered as markdown in the CRT colour scheme">

<img src="https://git.jkaindl.de/jkaindl/neurovim-obsidian/raw/branch/main/docs/images/guide.png" width="412" alt="The GUIDE tab filtered by the search term delete, listing the matching Vim keys">

## How it works

- **Content is bundled in the plugin** — the story is *earned by playing*, never spoiled by
  files sitting in your vault. Missions unlock progressively as you level up.
- **Menus, story, and progression live in a plugin pane** (NEXUS). XP and best times are
  stored by the plugin (`data.json`).
- **Missions materialize as throwaway notes** in a folder you configure (default
  `_neurovim/`). You fix the transmission in a **real Obsidian note with real Vim mode**.
  Deleting a mission note — or the whole folder — loses no progress; the next mission
  re-creates it. (Fits the lore: transmissions are ephemeral.)

The plugin **never touches files outside the configured mission folder.**

## CIPHER uplink (experimental, optional)

Ask CIPHER for Vim advice — in character, powered by any OpenAI-compatible endpoint
(LM Studio, Ollama, OpenRouter, …). Configure endpoint + model under
Settings → NeuroVim → CIPHER uplink; leave the endpoint list empty and the feature stays
fully off. During a mission, the HUD gains a CIPHER button that opens the uplink with the
mission's context attached.

Privacy: your questions plus the active mission's metadata (title, category, goal)
are sent to the endpoint you configure — never any other vault content.

## Run traces & privacy

NeuroVim can record the keystroke sequence of each successful mission to a local file
(`traces.jsonl`, inside the plugin folder). This powers CIPHER's debrief ("you walked to
word 3 with `l l l` — `3w` is one move") and lets you analyse mission balance offline.

- **Local only.** Traces are written to your vault's plugin folder and never sent anywhere
  automatically. Requesting a CIPHER debrief sends that run's sequence to the LLM endpoint
  you configured (a local model via LM Studio/Ollama stays on your machine) — the same
  connection the CIPHER chat already uses.
- **Scoped.** Only keystrokes inside an active mission's editor are recorded. Nothing else
  in your vault is ever touched.
- **Optional.** Turn it off in Settings → "Record run traces". Delete `traces.jsonl` anytime.

## Develop / build from source

```bash
npm install
npm run vendor    # snapshot @neurovim/core + @neurovim/content from the monorepo
npm run build     # → main.js
npm run gate      # lint + typecheck + tests
```

`npm run vendor` reads the monorepo from `NEUROVIM_MONOREPO` (default: the maintainer's
checkout of `neurovim-standalone` at `../../neurovim-standalone` relative to this repo —
set the variable if yours lives elsewhere) and writes a pinned snapshot into
`src/vendor/neurovim/` (see `src/vendor/neurovim/VENDOR.json`). The monorepo remains the
single source of truth for game logic and content.

`npm run lint` runs `eslint-plugin-obsidianmd` — the same rule set the community store
scans with — at `--max-warnings 0`. Manual smoke test:
[`docs/SMOKE-TEST.md`](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/docs/SMOKE-TEST.md).

Before opening a pull request, please read
[`CONTRIBUTING.md`](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/CONTRIBUTING.md) —
in particular which changes belong here and which belong in the monorepo. Architecture,
conventions and known gotchas live in
[`AGENTS.md`](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/AGENTS.md).

## Release

`npm run release <version>` follows the ecosystem's dual-push flow (Forgejo origin +
GitHub mirror; the GitHub tag triggers the community-store release). The release tooling
itself lives centrally in `../tools/release/`, so releasing requires the repo to sit inside
the `obsidian-plugins/` workspace; building and testing work from a standalone clone.
Prerequisites, set up once: a Forgejo repo as `origin`, a `github` remote
(`git remote add github git@github.com:<owner>/<repo>.git`), and `~/.forgejo-token`.

## Security

The plugin never touches files outside the configured mission folder, and makes no network
requests until you configure a CIPHER endpoint. What gets recorded, what gets sent where, and
how to report a vulnerability privately:
[`SECURITY.md`](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/SECURITY.md).

## License

- **Code:** [GNU AGPL-3.0-or-later](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/LICENSE).
- **Documentation & text:** [CC BY-SA 4.0](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/LICENSE-DOCS).
- **Missions and story:** inherited from the [monorepo](https://git.jkaindl.de/jkaindl/NeuroVIM)
  under CC BY-SA 4.0.

A commercial license is available for uses the AGPL does not fit — see
[`LICENSING.md`](https://git.jkaindl.de/jkaindl/neurovim-obsidian/src/branch/main/LICENSING.md).
