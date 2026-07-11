import { CheatsheetCategory, Keybinding } from '../data/cheatsheet';

// Returns up to 3 keys from the first group of the matching category (primary group only).
export function getHintKeys(
  category: string | null,
  cheatsheet: CheatsheetCategory[],
): Keybinding[] {
  if (!category) return [];
  return cheatsheet.find(c => c.id === category)?.groups[0]?.keys.slice(0, 3) ?? [];
}
