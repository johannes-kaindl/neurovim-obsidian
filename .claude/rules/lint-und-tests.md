---
paths:
  - "eslint.config.mjs"
  - "eslint.overrides.mjs"
  - "tsconfig*.json"
  - "vitest.config.ts"
  - "test/**"
  - "scripts/check-*.mjs"
---

# Lint-Gate und Tests — Gotchas

Gotchas zum Store-Lint und zu den Vitest-Tests.

## Linting (store gate)

- `eslint.config.mjs` runs `typescript-eslint` (type-checked) + `eslint-plugin-obsidianmd` — the same plugin the Community Store scanner uses. Local lint ≈ what the store will report.
- `--max-warnings 0` is mandatory: obsidianmd files most guideline rules as **warnings**, so `eslint src` alone exits 0 on findings the store then flags in review
- **No inline `// eslint-disable`** — `scripts/check-no-inline-disables.mjs` enforces it in the `lint` script. Exceptions go into `eslint.overrides.mjs` (the only place; `eslint.config.mjs` is template-managed, never edit it by hand) with a written justification. Exactly one exists: `ui/sentence-case` (off repo-wide — proper nouns `NeuroVim`/`Vim`/`qwen3-8b`, a URL placeholder, and the deliberate CRT-caps aesthetic)
- `src/vendor/**` is linted under the **same sharp rules** as own code. If lint breaks after `npm run vendor`, fix it in the monorepo and re-vendor — never add an override here
- Disabling a rule locally does **not** disable it in the store scan — expect those findings in review and answer them with the justification from the config

## Testing

- Vitest runs in node environment; `test/obsidian-mock.ts` mocks the Obsidian API
- `test/` has its own tsconfig (`tsconfig.test.json`, part of the gate as `typecheck:test`); `tsconfig.json` covers `src/` only
- TDD for pure logic; the wiring of the Obsidian edge files (tab drawing, views) is not unit-tested, the GUI smoke covers it
- Plan reference code is untested (CORE-AGENT-07): bugs in plan examples propagate verbatim to implementation; the review gate catches what TDD misses
