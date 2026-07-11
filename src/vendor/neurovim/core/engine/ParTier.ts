/**
 * ParTier — keystroke-based mastery scoring (gold/silver/bronze) for missions.
 * Pure logic, shared by adapters. Par = computed difficulty-scaled default, overridable
 * per mission via frontmatter. Tiers are multipliers off par. See spec
 * docs/superpowers/specs/2026-06-03-par-tiers-design.md.
 */
export type Tier = 'gold' | 'silver' | 'bronze' | null; // null = completed, no tier

// Threshold multipliers off par (gold = par itself). Tunable.
export const SILVER_FACTOR = 1.5;
export const BRONZE_FACTOR = 2.5;

// Deliberately generous, difficulty-scaled baseline. Initial values — tune after
// playtesting against the web keystroke counter.
export const PAR_BASE = 20;
export const PAR_PER_DIFFICULTY = 20;
export const FALLBACK_DIFFICULTY = 3;

/** Computed default par for a difficulty (0/undefined/null → FALLBACK_DIFFICULTY). */
export function defaultParKeystrokes(difficulty: number | null | undefined): number {
  const d = difficulty && difficulty > 0 ? difficulty : FALLBACK_DIFFICULTY;
  return PAR_BASE + d * PAR_PER_DIFFICULTY;
}

/** Resolved par: a positive frontmatter override wins, else the computed default. */
export function resolvePar(input: { parOverride?: number | null; difficulty?: number | null }): number {
  return input.parOverride && input.parOverride > 0
    ? input.parOverride
    : defaultParKeystrokes(input.difficulty);
}

/** Tier for a keystroke count against a par. null = completed but no tier. */
export function tierFor(keystrokes: number, par: number): Tier {
  if (keystrokes <= 0 || par <= 0) return null;
  if (keystrokes <= par) return 'gold';
  if (keystrokes <= par * SILVER_FACTOR) return 'silver';
  if (keystrokes <= par * BRONZE_FACTOR) return 'bronze';
  return null;
}

/**
 * The next better tier and how many keystrokes to shave to reach it. null when already
 * gold. When below bronze, targets bronze. Used for the "almost there" nudge.
 */
export function keystrokesToNextTier(
  keystrokes: number,
  par: number,
): { nextTier: Exclude<Tier, null>; delta: number } | null {
  if (keystrokes <= 0 || par <= 0) return null;
  const current = tierFor(keystrokes, par);
  if (current === 'gold') return null;
  if (current === 'silver') return { nextTier: 'gold', delta: keystrokes - par };
  if (current === 'bronze') return { nextTier: 'silver', delta: keystrokes - par * SILVER_FACTOR };
  return { nextTier: 'bronze', delta: keystrokes - par * BRONZE_FACTOR };
}
