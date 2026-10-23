---
paths:
  - "src/SettingsTab.ts"
  - "src/settings.ts"
  - "src/main.ts"
  - "src/storage/**"
  - "test/settings.test.ts"
  - "test/settingsTabControls.test.ts"
  - "test/loadPluginData.test.ts"
  - "test/helpRow.test.ts"
---

# Einstellungen und Plugin-Daten — Gotchas

Gotchas zu `SettingsTab.ts`, `settings.ts` und `storage/`.

- `display()` re-renders the entire tab (e.g. after "Test all") — persist UI state (collapsed sections) in PluginData
- `mergeStoredSettings`: do NOT spread raw `data.json` into defaults — legacy fields reappear via spread
- **Settings are dual-path** — `getSettingDefinitions()` is the single truth (Obsidian 1.13+), `display()` → `renderImperative()` draws the same structure for ≤1.12. Add new rows to the definition groups, never to `display()` alone; text controls hand back strings, so coerce in `setControlValue`. Stateful CIPHER rows stay `render` hatches.
- Plugin data: `this.data` loaded in `loadData()`, saved via `saveData(this.data)` — always merge, never replace
