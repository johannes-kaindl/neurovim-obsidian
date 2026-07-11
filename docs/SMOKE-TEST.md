# Manual smoke test (Jay — 3 min in Obsidian)

1. Symlink/copy this repo's `manifest.json`, `main.js`, `styles.css` into a test vault's
   `.obsidian/plugins/neurovim/`, enable the plugin.
2. Click the terminal ribbon icon → the NeuroVim pane opens showing NEXUS with a mission list.
3. Click **M-01** → a note `NeuroVim/M-01-The-Three-Modes.md` opens; the pane switches to
   Mission-Control with a running timer.
4. Enable Vim mode (Settings → Editor → Vim key bindings) → edit the note to match the target.
5. Click **Submit** → on a mismatch you get "N lines differ"; when correct you get
   "+XP" and the pane returns to NEXUS with XP increased and M-01 marked ✓.
6. Delete the `NeuroVim/` folder → click M-01 again → note is re-created, no data lost.
