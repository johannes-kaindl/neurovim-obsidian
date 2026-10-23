---
paths:
  - "src/*.ts"
  - "src/*.tsx"
  - "src/result/**"
  - "src/briefing/**"
  - "src/lore/**"
  - "test/obsidian-mock.ts"
---

# Obsidian-API, DOM und Ereignisse — Gotchas

Gotchas zu DOM-Bau, Ereignis-Verdrahtung und Obsidian-API in `src/` (ohne `src/vendor/`).

## DOM creation

- **Always** use Obsidian's shorthand helpers: `el.createDiv()`, `el.createSpan()`, `el.createEl('p')`
- **Never** `el.createEl('div')` — Store Lint `prefer-create-el` flags it (the rule's tests contradict its README; trust the tests)

## Event wiring (transient elements)

- Input fields: commit on **`blur`**, NOT `onChange` (Obsidian fires onChange per keystroke → garbage entries)
- List item handlers: resolve by **value**, NOT render index (list mutations make stale indices delete wrong items)
- `Component.registerDomEvent`: only for elements that live as long as the Component. For transient/re-rendered elements use plain `addEventListener` (GC'd when detached)
- (The blur/by-value rules above are now carried by the kit's endpoint list in `src/vendor/`; they apply to any new form of your own.)

## Timeouts / clocks

- Use `ClockPort` injection (never `window.setTimeout` directly) — makes timeout paths testable under Vitest

## Obsidian API

- `app.readNote(path)` — async, may throw for inaccessible notes
