# NeuroVim (vim-dojo)

> Learn Vim by playing a cyberpunk spy-thriller — inside Obsidian.

An AI handler named **CIPHER** assigns you "missions" that are really Vim exercises:
restore CORP-corrupted transmissions, beat the clock, earn XP. You learn Vim almost by
accident; the story is the hook.

NeuroVim originally started life as an Obsidian plugin, then grew into a multi-target
game ([`neurovim-standalone`](https://codeberg.org/jkaindl/NeuroVIM): web + desktop +
Obsidian). **vim-dojo** brings it back home as a first-class, standalone Obsidian plugin.

## Hub pane

The NeuroVim pane is organized in tabs:

- **NEXUS** — your status (level/XP), the welcome transmission, and a one-click
  "next mission" button.
- **MISSIONS** — the full mission list.
- **GUIDE** — a searchable Vim cheatsheet (filter by key or description).
- **UPLINK** — the CIPHER chat (appears once an endpoint is configured).

## CIPHER uplink (experimental, optional)

Ask CIPHER for Vim advice — in character, powered by any OpenAI-compatible endpoint
(LM Studio, Ollama, OpenRouter, …). Configure endpoint + model under
Settings → NeuroVim → CIPHER uplink; leave the endpoint list empty and the feature stays
fully off. During a mission, the HUD gains a CIPHER button that opens the uplink with the
mission's context attached.

Privacy: your questions plus the active mission's metadata (title, category, goal)
are sent to the endpoint you configure — never any other vault content.

### Settings

Settings → NeuroVim is grouped into three collapsible sections — **Missions**,
**Appearance**, and **CIPHER uplink**; each remembers whether you left it open or closed.

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

## How it works (the hybrid model)

- **Content is bundled in the plugin** — the story is *earned by playing*, never spoiled by
  files sitting in your vault. Missions unlock progressively as you level up.
- **Menus, story, and progression live in a plugin pane** (NEXUS). XP and best times are
  stored by the plugin (`data.json`).
- **Missions materialize as throwaway notes** in a folder you configure (default
  `NeuroVim/`). You fix the transmission in a **real Obsidian note with real Vim mode**.
  Deleting a mission note — or the whole folder — loses no progress; the next mission
  re-creates it. (Fits the lore: transmissions are ephemeral.)

The plugin **never touches files outside the configured mission folder.**

> Enable Obsidian's Vim mode (Settings → Editor → Vim key bindings) for the intended
> experience. Without it the game still works, but without Vim keybindings.

## Develop / build from source

```bash
npm install
npm run vendor    # snapshot @neurovim/core + @neurovim/content from the monorepo
npm run build     # → main.js
npm test          # vitest
npm run typecheck
```

`npm run vendor` reads the monorepo from `NEUROVIM_MONOREPO` (default
`/Users/Shared/code/neurovim-standalone`) and writes a pinned snapshot into
`src/vendor/neurovim/` (see `src/vendor/neurovim/VENDOR.json`). The monorepo remains the
single source of truth for game logic and content.

Manual smoke test: [`docs/SMOKE-TEST.md`](docs/SMOKE-TEST.md).

## Release

`npm run release <version>` follows the ecosystem's dual-push flow (Codeberg origin +
GitHub mirror; the GitHub tag triggers the community-store release). Prerequisites, set up
once: a Codeberg repo as `origin`, a `github` remote
(`git remote add github git@github.com:<owner>/<repo>.git`), and `~/.codeberg-token`.
Community-store submission is a later step — verify the plugin `id` (`neurovim`) is free in
the community list first.

## License

[GNU AGPL-3.0-only](LICENSE) for code. Narrative/content is inherited from the monorepo
under CC BY-SA 4.0. A commercial license is available for uses the AGPL does not fit (see
the monorepo's `LICENSING.md`).
