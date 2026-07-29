# Security Policy

## Supported versions

Only the latest published release is supported with security fixes. Older versions do not
receive backports — the plugin updates through the Obsidian community store, so upgrading
is a click.

## Reporting a vulnerability

Please **do not** file security issues as public Codeberg or GitHub issues.

Report privately by email to **code@jkaindl.de** (PGP welcome) with:

1. A description of the issue and its potential impact.
2. Steps to reproduce, including a minimal example if possible.
3. The plugin version and Obsidian version where you observed it.
4. Any suggested mitigation, if you have one.

You will get an acknowledgement within **7 days** and, for confirmed issues, a fix or a
coordinated disclosure plan within **30 days**. If you hear nothing within 7 days, please
open a non-sensitive Codeberg issue saying you sent a security email (without the details)
so it can be chased.

## Threat model

NeuroVim writes notes into your vault, records keystrokes during a mission, and — if you
configure it — talks to an LLM endpoint. That is a wider surface than most plugins, so it is
spelled out here honestly.

### File access

- **The plugin only ever touches the configured mission folder** (default `_neurovim/`).
  This invariant is the reason the mission folder is a setting in the first place, and it is
  the one thing a change to this plugin must never break.
- **Mission notes are disposable and get overwritten** each time the mission is started.
  Pointing the mission-folder setting at a folder that holds real notes is therefore
  destructive by design — a note whose name collides with a mission's will be replaced.
  Keep it on a dedicated folder.
- Deleting the mission folder loses no progress; XP and best scores live in the plugin's own
  `data.json`.

### Keystroke recording

- With **Record run traces** enabled, the keystroke sequence of a successful mission is
  appended to `traces.jsonl` inside the plugin folder. This powers CIPHER's debrief.
- **Recording is scoped to the active mission's editor.** Keystrokes typed anywhere else in
  Obsidian are not captured. A defect that widened this scope would turn the feature into a
  keylogger, which is why the mission lifecycle guards on `state === 'active'` rather than
  on "a mission exists" — a paused mission records nothing.
- Traces are **local only** and never transmitted on their own. Delete `traces.jsonl` at any
  time, or turn the setting off.

### Network

- **No network access unless you configure an endpoint.** With the CIPHER endpoint list
  empty, the plugin makes no outbound requests at all — no telemetry, no update pings, no
  remote resources.
- When configured, requests go **only to the endpoints you entered**. What is sent: your
  chat message, the active mission's metadata (title, category, objective), and — if you
  request a debrief — that run's keystroke sequence. No other vault content is ever included.
- A local endpoint (LM Studio, Ollama) keeps all of it on your machine; a hosted endpoint
  (OpenRouter, …) does not. That choice is yours and the plugin does not second-guess it.
- **The API key is stored in plaintext** in the plugin's `data.json`, like every Obsidian
  plugin setting. If your vault is synced or shared, that file goes with it. Use a scoped or
  throwaway key for endpoints that require one.
- Requests use Obsidian's `requestUrl` and a scoped `XMLHttpRequest` for streaming — never
  the global `fetch`.

### Code execution and DOM

- **No `eval`, no `new Function`, no dynamic `import`** in the plugin source or its bundle.
- No `innerHTML`/`outerHTML` writes — the UI is built with Obsidian's DOM helpers.
- Mission content is **bundled**, not fetched: the story ships inside the plugin as a pinned
  snapshot of the [`neurovim-standalone`](https://codeberg.org/jkaindl/NeuroVIM) monorepo
  (provenance in `src/vendor/neurovim/VENDOR.json`). It is not read from your vault and not
  downloaded at runtime.

### Out of scope

Supply-chain issues in Obsidian itself or in the `@codemirror/*` packages it provides at
runtime belong upstream; fixes will be pulled in as they land. The same goes for the LLM
endpoint you point CIPHER at — the plugin cannot vouch for a server you configured.
