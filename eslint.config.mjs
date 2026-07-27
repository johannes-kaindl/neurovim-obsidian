// Obsidian-Guideline-Gate (PROF-OBS-08): type-checked gegen ECHTE obsidian-Typen.
// Laeuft additiv zu typecheck/test — `npm run lint` ist mit `--max-warnings 0` scharf
// gestellt, weil eslint-plugin-obsidianmd die store-relevanten Guideline-Regeln
// ueberwiegend als `warning` fuehrt: ohne das Flag waere das Gate gruen und der
// Community-Store-Scanner meldete denselben Befund erst im Review.
// KEIN Inline-`// eslint-disable` — genuin unvermeidbare Ausnahmen NUR als Override
// unten, mit Begruendung (Review verbietet Inline-disables).
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
  { ignores: ["main.js", "node_modules/**", "test/**", "*.mjs", "*.config.*"] },
  ...tseslint.configs.recommendedTypeChecked,
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // --- Overrides (mit Begruendung) -----------------------------------------
  {
    rules: {
      // `obsidianmd/ui/sentence-case` ist fuer dieses Plugin repo-weit nicht erfuellbar,
      // und zwar aus drei unabhaengigen Gruenden — file-scoped waere Etikettenschwindel,
      // weil jede UI-Datei mindestens einen davon trifft:
      //  1. EIGENNAMEN: die Regel verlangt 'Neurovim' statt 'NeuroVim', 'vim restored'
      //     statt 'Vim restored' und 'Qwen3-8b' statt der Modell-ID 'qwen3-8b'. Alle drei
      //     Umschreibungen waeren schlicht Falschschreibungen.
      //  2. URLS: der Endpoint-Placeholder 'http://localhost:1234' wuerde zu
      //     'HTTP://localhost:1234'.
      //  3. CRT-AESTHETIK: die Terminal-Notices ('>_ MISSION PAUSED …') sind die bewusste
      //     comply-or-explain-Ausnahme dieses Plugins von UI-STANDARD.md (Spiel-Oberflaeche
      //     != Produktiv-Panel, im Cockpit dokumentiert).
      // Der Store-Scanner schaltet die Regel NICHT ab — die Befunde koennen im Review
      // als Warning auftauchen und sind dort mit denselben drei Punkten zu beantworten.
      "obsidianmd/ui/sentence-case": "off",
    },
  },
  {
    files: ["src/vendor/**"],
    rules: {
      // Vendorter Monorepo-Snapshot (SSOT: neurovim-standalone) — hier gefixt waere der
      // Fix beim naechsten `npm run vendor` weg. `String(fm.x ?? '')` auf `unknown`-
      // Frontmatter ist dort defensive Absicht, kein Bug: nur kaputtes Frontmatter
      // erzeugt '[object Object]'. Echter Fix gehoert ins Monorepo (Helper `asString`).
      // Die obsidianmd-Regeln bleiben hier bewusst SCHARF — der Store scannt den Vendor
      // -Code mit.
      "@typescript-eslint/no-base-to-string": "off",
    },
  },
);
