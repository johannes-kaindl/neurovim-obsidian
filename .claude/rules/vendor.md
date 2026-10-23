---
paths:
  - "src/vendor/**"
  - "scripts/vendor-neurovim.mjs"
  - "tools/kit-sync.json"
  - "tsconfig*.json"
  - "esbuild.config.mjs"
---

# Vendor-Modell — Gotchas

Zu `src/vendor/neurovim/` (Spielelogik aus dem Monorepo) und den Kit-Kopien.

- `src/vendor/neurovim/` is a **pinned snapshot** from the `neurovim-standalone` monorepo
- The monorepo (checked out at `~/Projects/jkaindl/apps/neurovim`, override with `NEUROVIM_MONOREPO`) is the **SSOT** for game logic
- Pin tracked in `src/vendor/neurovim/VENDOR.json` (commit SHA + version)
- To sync: fix in monorepo → `npm run vendor` → verify → commit vendor + VENDOR.json
- The script copies **every** top-level `.ts` of `packages/content/src` (plus `generated/`) — a hardcoded file list used to drop new modules, leaving imports unresolvable
- tsconfig/esbuild alias `@neurovim/core` and `@neurovim/content` → vendor paths
