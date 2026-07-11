/**
 * ContentPort — access to mission/lore content (ADR-001 §P4 / Decisions D3).
 *
 * - adapter-obsidian: Vault file API + path mapping from `data/chapters.ts`.
 * - adapter-web:      bundled `@neurovim/content` (Markdown→JSON build, D3).
 *
 * Provides both mission bodies (briefing/transmission) and lore artifacts
 * (fragments, loot, characters), which today exist as vault notes.
 */
import type { MissionFrontmatter } from '../types';

/** Lightweight mission overview (for lists/NEXUS dashboard, without body). */
export interface MissionSummary extends MissionFrontmatter {
  arc: 'I' | 'II';
  chapter: string;
}

/** Full mission incl. briefing/transmission body + solution. */
export interface MissionDoc extends MissionSummary {
  briefingBody: string;
  transmissionBody: string;
  /** Target solution (Dev-SOLUTIONS) — for diff validation. */
  solution?: string;
  /** Corrupt initial version (if mission type is correction). */
  corrupted?: string;
}

export interface LoreDoc {
  id: string;
  kind: 'fragment' | 'loot' | 'character' | 'organization' | 'ref';
  title: string;
  body: string;
}

export interface ContentPort {
  /** All missions, optionally filtered to a single arc. */
  listMissions(arc?: 'I' | 'II'): Promise<MissionSummary[]>;

  /** Full mission (briefing + transmission + solution if any). */
  getMission(id: string): Promise<MissionDoc>;

  /** Lore artifact (fragment/loot/character/organization/ref). */
  getLore(id: string): Promise<LoreDoc>;

  /** Optional: read a raw file (sandbox THE_RAVEN, REF sheets). */
  getRaw?(path: string): Promise<string>;
}
