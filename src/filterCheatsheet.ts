import type { CheatsheetCategory } from '@neurovim/core';

/** Case-insensitive live filter over key + description; empty groups/categories drop. */
export function filterCheatsheet(cats: CheatsheetCategory[], query: string): CheatsheetCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return cats;
  return cats
    .map((cat) => ({
      ...cat,
      groups: cat.groups
        .map((g) => ({ ...g, keys: g.keys.filter((k) => k.key.toLowerCase().includes(q) || k.description.toLowerCase().includes(q)) }))
        .filter((g) => g.keys.length > 0),
    }))
    .filter((cat) => cat.groups.length > 0);
}
