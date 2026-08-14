import type { LoreSummary } from '@neurovim/content';

/** One artifact as the archive shows it: index data plus the derived lock state. */
export interface ArchiveEntry {
  id: string;
  title: string;
  summary: string;
  locked: boolean;
  /** LOOT only: the level that unlocks it. null for fragments. */
  unlockLevel: number | null;
}

export interface ArchiveSection {
  kind: 'loot' | 'fragment';
  label: string;
  entries: ArchiveEntry[];
}

/** Section order is the reading order of the archive. REF is absent on purpose:
 *  the EN quick reference already lives in the GUIDE tab (getManual), and
 *  99-THE_RAVEN is the sandbox source. */
const SECTIONS: { kind: 'loot' | 'fragment'; label: string }[] = [
  { kind: 'loot', label: 'LOOT — Recovered Files' },
  { kind: 'fragment', label: 'FRAGMENTS — Intercepts' },
];

/**
 * Groups lore artifacts and derives their lock state. Only loot gates on `unlocked`
 * (ProgressionEngine.backfillUnlocks writes loot ids there); fragments are always open.
 */
export function buildArchive(items: LoreSummary[], unlocked: string[]): ArchiveSection[] {
  const owned = new Set(unlocked);
  return SECTIONS.map(({ kind, label }) => ({
    kind,
    label,
    entries: items
      .filter((it) => it.kind === kind)
      .map((it) => ({
        id: it.id,
        title: it.title,
        summary: it.summary,
        locked: kind === 'loot' && !owned.has(it.id),
        unlockLevel: it.unlockLevel,
      })),
  })).filter((s) => s.entries.length > 0);
}
