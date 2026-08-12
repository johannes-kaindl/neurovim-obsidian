// Repo-eigene ESLint-Abweichungen — der EINZIGE Ort dafuer. Der Kern
// (eslint.config.mjs) ist template-verwaltet, Inline-disables blockt das Lint-Gate.
// Jeder Override braucht eine Begruendung im Kommentar.
//
// Zwei Klassen, zwei Preise (Details: _docs/docs/obsidian-plugin-publishing.md):
// - Kosmetik-/Benennungsregeln (z. B. ui/sentence-case bei Eigennamen/API-Namen):
//   Override ist die richtige Antwort und kostet nichts — der Scanner hat keinen
//   Mangel gefunden, sondern eine Konvention falsch angelegt.
// - Faehigkeitsregeln (z. B. settings-tab/prefer-setting-definitions): der Scanner
//   bewertet den Mangel, nicht die Begruendung — ein Override hier ist gestundete
//   Schuld und kostet die Store-Wertung ("Satisfactory" statt "Passed").
//   Marker fuer solche Faelle: `// STORE-SCHULD:` + wo die Abloesung geplant ist.
export default [
  {
    // Type-aware Linting braucht das Build-tsconfig des Repos. Achtung Falle
    // (json_viewer 1.9.0): ein obsidian→Mock-paths-Alias im referenzierten tsconfig
    // laesst die type-aware Regeln auf einen losen Mock aufloesen → no-unsafe-*-Kaskade.
    // .tsx dazu (uebernommen aus der Alt-Config): vim-dojo nutzt Preact/JSX in src/**/*.tsx.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
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
    rules: {
      "obsidianmd/ui/sentence-case": "off",
    },
  },
];
// Kein Override fuer `src/vendor/**`: die 9 `no-base-to-string`-Befunde des vendorten
// Content-Snapshots sind an der Wurzel behoben (Monorepo `bdefaaa`, Helper `asString`)
// statt hier stillgestellt. Der Vendor-Code laeuft damit unter denselben scharfen Regeln
// wie eigener Code — bricht der Lint nach einem `npm run vendor`, gehoert der Fix ins
// Monorepo und danach ein erneutes Vendoring, nie ein Override hier.
