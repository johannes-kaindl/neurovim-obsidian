import { resolveParInfo, tierFor, type MissionRecord, type MissionSummary, type Tier } from '@neurovim/core';

/**
 * The par a human actually wrote for this mission, or null when none exists.
 *
 * The core can always produce a number — `resolvePar` falls back to a difficulty
 * formula — but that number is a guess, and measured against the real content it does
 * not hold: missions of equal difficulty differ by a factor of thirty in how much text
 * they change, so for many of them the computed gold threshold is below the count of
 * characters that must be typed at all. Judging a run against such a par tells the
 * player they failed at something that was never reachable. So: no authored par, no
 * verdict. This is the single place that decision lives.
 */
export function authoredPar(m: Pick<MissionSummary, 'par_keystrokes' | 'difficulty'>): number | null {
  const info = resolveParInfo({ parOverride: m.par_keystrokes, difficulty: m.difficulty });
  return info.source === 'authored' ? info.par : null;
}

/** Tier of the player's best run, or null when unplayed or unjudgeable. */
export function bestTier(
  m: Pick<MissionSummary, 'par_keystrokes' | 'difficulty'>,
  record: MissionRecord | undefined,
): Tier {
  const par = authoredPar(m);
  if (par === null || !record) return null;
  return tierFor(record.best_keystrokes, par);
}
