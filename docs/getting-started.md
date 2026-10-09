# Getting started

This takes you from the install to your first finished mission. You need Obsidian 1.11.4 or newer and the plugin installed (see the [README](https://github.com/johannes-kaindl/neurovim-obsidian/blob/main/README.md#install)). CIPHER, the LLM handler, is optional and not needed here.

## 1. Turn on Vim mode

Open **Settings → Editor** and switch on **Vim key bindings**. NeuroVim teaches real Vim in a real note, so this is the point of the game. Or enable **Auto Vim mode** under **Settings → NeuroVim → Missions** (off by default): the plugin then switches Vim on while a mission runs and restores your previous setting afterwards.

## 2. Open the pane

Click the terminal icon **NeuroVim** in the ribbon, or run **NeuroVim: Open** from the command palette. The pane opens on **NEXUS**: your level and XP, a welcome transmission and a button for the next mission. The other tabs are **MISSIONS**, **ARCHIVE** and **GUIDE**; **UPLINK** appears once you configure a CIPHER endpoint.

## 3. Start the first mission

Open **MISSIONS** and click **M-01**. A briefing opens with CIPHER's instructions. Read it and press **▶ BEGIN MISSION**. The plugin creates a throwaway note in the folder `_neurovim/` (the **Mission folder** setting), opens it and starts the timer.

## 4. Fix the transmission

The note holds a corrupted transmission. Edit it with Vim until it matches the goal from the briefing. The mission HUD shows the lines that already match, the elapsed time and your keystroke count. If you are stuck, press **HINT**: it shows exactly where the first wrong line differs from the solution.

If you click into another note, the mission pauses (*Mission paused — Vim restored.*) and a banner offers **RETURN** or **ABORT**. Returning resumes the timer.

## 5. Submit

Press **SUBMIT**. While lines still differ you get a notice such as *2 lines differ — keep going* and the wrong lines are highlighted; they clear one by one as you fix them. When everything matches, a result window shows your XP, time and keystrokes. Beating those later is the actual game. **RESET** restarts the transmission and the timer, **ABORT** leaves the mission.

## 6. Keep going

The pane returns to **NEXUS** with your new XP, and **M-01** is marked with a check mark. More missions unlock as you level up; locked ones stay greyed out. **ARCHIVE** collects the lore artifacts you have earned, and **GUIDE** is a searchable Vim cheatsheet.

## Where to go next

The [README](https://github.com/johannes-kaindl/neurovim-obsidian/blob/main/README.md) describes every setting, the optional CIPHER uplink and what NeuroVim records. If something does not work as described here, see [Troubleshooting](troubleshooting.md).
