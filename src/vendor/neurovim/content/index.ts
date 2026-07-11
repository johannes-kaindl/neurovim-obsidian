/**
 * @neurovim/content — versioned content source (Phase 3 step 3).
 *
 * SSOT = src/content/*.md. The build (build.mjs) generates src/generated/content.ts.
 * This module exposes ContentPort-conformant helpers over the generated manifest —
 * bundler-friendly, no runtime fs (web-ready). Consumed via adapter-web (Phase 4)
 * or directly; the Obsidian adapter still uses vault reads (ObsidianContent).
 */
import type { MissionSummary, MissionDoc, LoreDoc, GlitchDefinition } from '@neurovim/core';
import { ENTRIES, type RawContentEntry } from './generated/content';
import { RAVEN_ORIGINAL, RAVEN_GLITCH_POOL } from './generated/sandbox';
import { WELCOME_BODY } from './generated/welcome';

export { ENTRIES };
export type { RawContentEntry };

/** THE RAVEN sandbox source (M-08): clean original text + glitch pool. */
export function getSandboxSource(): { original: string; pool: GlitchDefinition[] } {
  return { original: RAVEN_ORIGINAL, pool: RAVEN_GLITCH_POOL };
}

/** Landing-page intro (Markdown) for the Welcome view. */
export function getWelcome(): string {
  return WELCOME_BODY;
}

/** The comprehensive Vim reference manual (EN) body — for the Reference overlay's Manual tab. */
export function getManual(): string {
  const e = ENTRIES.find((x) => x.role === 'ref' && x.id.includes('EN'));
  return e ? e.body : '';
}

function toSummary(e: RawContentEntry): MissionSummary {
  const fm = e.frontmatter;
  return {
    mission_id: String(fm.mission_id ?? e.id),
    mission_type: (fm.mission_type as MissionSummary['mission_type']) ?? 'practice',
    title: String(fm.title ?? e.id),
    category: String(fm.category ?? ''),
    xp_reward: Number(fm.xp_reward ?? 0),
    locked: Boolean(fm.locked ?? false),
    tier: String(fm.tier ?? ''),
    difficulty: fm.difficulty != null ? Number(fm.difficulty) : undefined,
    par_keystrokes: fm.par_keystrokes != null ? Number(fm.par_keystrokes) : undefined,
    summary: fm.summary != null ? String(fm.summary) : undefined,
    why: fm.why != null ? String(fm.why) : undefined,
    arc: e.arc,
    chapter: e.chapter,
  };
}

/** All playable missions (transmission + kata), optionally filtered by arc. */
export function listMissions(arc?: 'I' | 'II'): MissionSummary[] {
  return ENTRIES
    .filter((e) => e.role === 'transmission' || e.role === 'kata')
    .filter((e) => (arc ? e.arc === arc : true))
    .map(toSummary);
}

/** Full mission: transmission/kata body + the associated briefing body, if any. */
export function getMission(id: string): MissionDoc {
  const main = ENTRIES.find(
    (e) => (e.role === 'transmission' || e.role === 'kata') && e.id === id,
  );
  if (!main) throw new Error(`Mission not found: ${id}`);
  const briefing = ENTRIES.find((e) => e.role === 'briefing' && e.id === id);
  const solution = ENTRIES.find((e) => e.role === 'solution' && e.id === id);
  return {
    ...toSummary(main),
    transmissionBody: main.body,
    briefingBody: briefing?.body ?? '',
    solution: solution?.body,
  };
}

/** Lore artifact (loot/fragment/ref). */
export function getLore(id: string): LoreDoc {
  const e = ENTRIES.find(
    (x) => x.kind === 'lore' && x.id === id,
  );
  if (!e) throw new Error(`Lore not found: ${id}`);
  return {
    id: e.id,
    kind: e.role === 'loot' ? 'loot' : e.role === 'fragment' ? 'fragment' : 'ref',
    title: String(e.frontmatter.title ?? e.id),
    body: e.body,
  };
}

/** Index entry for the lore archive (no body — see getLore(id) for the full doc). */
export interface LoreSummary {
  id: string;
  kind: 'loot' | 'fragment' | 'ref';
  title: string;
  summary: string;
  /** LOOT only: the level at which it unlocks in the campaign (legibility badge). null for fragment/ref. */
  unlockLevel: number | null;
}

/** All lore artifacts (loot + fragment + ref) as index summaries, in manifest order. */
export function listLore(): LoreSummary[] {
  return ENTRIES
    .filter((e) => e.kind === 'lore')
    .map((e) => ({
      id: e.id,
      kind: e.role === 'loot' ? 'loot' : e.role === 'fragment' ? 'fragment' : 'ref',
      title: String(e.frontmatter.title ?? e.id),
      summary: String(e.frontmatter.summary ?? ''),
      unlockLevel:
        e.role === 'loot' && e.frontmatter.unlock_level != null
          ? Number(e.frontmatter.unlock_level)
          : null,
    }));
}
