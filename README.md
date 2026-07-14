# NeuroVim (vim-dojo)

> Learn Vim by playing a cyberpunk spy-thriller — inside Obsidian.

An AI handler named **CIPHER** assigns you "missions" that are really Vim exercises:
restore CORP-corrupted transmissions, beat the clock, earn XP. You learn Vim almost by
accident; the story is the hook.

NeuroVim originally started life as an Obsidian plugin, then grew into a multi-target
game ([`neurovim-standalone`](https://codeberg.org/jkaindl/NeuroVIM): web + desktop +
Obsidian). **vim-dojo** brings it back home as a first-class, standalone Obsidian plugin.

## CIPHER uplink (experimental, optional)

Ask CIPHER for Vim advice — in character, powered by any OpenAI-compatible endpoint
(LM Studio, Ollama, OpenRouter, …). Configure endpoint + model under
Settings → NeuroVim → CIPHER uplink; leave them empty and the feature stays fully off.
During a mission, the HUD gains a CIPHER button that opens the uplink with the
mission's context attached.

Privacy: your questions plus the active mission's metadata (title, category, goal)
are sent to the endpoint you configure — never any other vault content.

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
