# Troubleshooting

Each entry starts with what you see — the wording is the plugin's own text — then the cause and what to do. If yours is not here, see [Getting help](#getting-help).

## Vim keys do nothing in the mission note

**Cause:** Obsidian's Vim mode is off. NeuroVim only switches it on for you when **Auto Vim mode** is enabled, and that is off by default.

**Fix:** turn on **Settings → Editor → Vim key bindings**, or enable **Auto Vim mode** under **Settings → NeuroVim → Missions**. The game still runs without Vim, but you then fix the transmission with ordinary editing, which misses the point.

## The mission stopped

> Mission paused — Vim restored.

**Cause:** the cursor left the mission note. The timer stops so that keystrokes elsewhere do not count. Your previous Vim setting is restored.

**Fix:** press **RETURN** in the banner, or click back into the mission note. **ABORT** ends the mission. If you find the floating reminder annoying, set **Paused reminder after** to `0`; a paused mission still shows in the status bar.

## Submit says lines differ

> 2 lines differ — keep going

**Cause:** the text does not match the solution yet. Wrong lines are highlighted and clear as you fix them.

**Fix:** press **HINT** to see what the first wrong line should be. Whitespace counts.

## A mission does not start

> NeuroVim: …

**Cause:** the text after the colon names the reason, for example that the mission note could not be created.

**Fix:** check that **Mission folder** is a valid folder name inside the vault and is not blocked by another file with the same name. Deleting the folder loses no progress; the next mission creates it again.

## A mission is greyed out

**Cause:** it is locked. Missions unlock as you level up.

**Fix:** finish more missions.

## The mission HUD is in the way

**Fix:** move it with **HUD placement** under **Settings → NeuroVim → Appearance**, or dismiss the floating box for this mission with its × button.

## The UPLINK tab is missing

**Cause:** no CIPHER endpoint is configured. The tab only appears once there is one, and the whole feature stays off until then. The **CIPHER** button in the mission HUD depends on it too.

**Fix:** add an address under **Settings → NeuroVim → CIPHER uplink → Endpoints**, for example `http://localhost:1234` for LM Studio. Setting up a local server is covered in the [local LLM setup guide](https://uplink.jkaindl.de/llm-setup).

## CIPHER answers "Signal lost"

> Signal lost. Check your uplink.

**Cause:** the request failed. A grey line under the message says why:

| Detail | Meaning |
|---|---|
| CIPHER uplink not configured | No endpoint is set. |
| no endpoint reachable | None of the addresses answered. |
| no model set for the endpoint | The endpoint has no default model and you chose none. |

**Fix:** open **Settings → NeuroVim → CIPHER uplink** and press **Test all**. Every endpoint shows its own status:

| Status | Meaning |
|---|---|
| Connection refused — server not running or wrong port. | The server is off, or the port is wrong. |
| Unknown host — typo in the address? | The host name does not resolve. |
| Timed out — network unreachable (wrong network / VPN off?). | You are on a network that cannot reach the server. |
| Responds, but not an OpenAI-compatible endpoint — wrong path or service? | Check the address; enter the base URL without a trailing `/v1`. |
| Access denied — missing or invalid API key. | Enter the key. |

Also pick a **Model** from the dropdown. It is filled from the active endpoint; when the endpoint is unreachable you can type the name.

## A CIPHER answer ends with "signal cut"

**Cause:** you pressed **CUT** while the answer was still streaming. The part that arrived is kept.

## No debrief after a mission

**Cause:** the debrief needs both a CIPHER endpoint and **Record run traces**, because CIPHER analyses your recorded keystrokes.

**Fix:** configure an endpoint, and check that **Record run traces** (on by default) under **Settings → NeuroVim → Missions** has not been switched off. See *Run traces & privacy* in the README for what is stored.

## The cheatsheet finds nothing

> No matches. CORP scrubbed that page.

**Fix:** search for a key or a word from its description, for example `delete`, `ciw` or `:%s`.

## Getting help

Open an issue at [github.com/johannes-kaindl/neurovim-obsidian/issues](https://github.com/johannes-kaindl/neurovim-obsidian/issues). Include the exact message, the Obsidian version and whether Vim key bindings were on.
