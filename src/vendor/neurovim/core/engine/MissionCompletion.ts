import { PluginData, LevelUpResult, MissionRecord } from '../types';
import { ProgressionEngine } from './ProgressionEngine';
import type { MetricsResult } from './MetricsTracker';
import { resolvePar, tierFor, keystrokesToNextTier, Tier } from './ParTier';

/** The mission fields a completion needs. */
export interface CompletedMission {
  mission_id: string;
  xp_reward: number;
  par_keystrokes?: number | null;
  difficulty?: number | null;
}

export interface CompletionResult {
  /** The new player state, ready to persist. */
  data: PluginData;
  xp: number;
  level_up: LevelUpResult | null;
  /** This mission's personal bests after the run (also in data.missions). */
  record: MissionRecord;
  par: number;
  tier: Tier;
  to_next_tier: { nextTier: Exclude<Tier, null>; delta: number } | null;
  /** Solved without a single keystroke: the win and its XP count, the bests do not. */
  unverified: boolean;
}

/** A run that may not set bests: only the counter and the date move. recordMissionRun reads a
 *  0 as "no value yet" and would adopt it as a best — the corruption neurovim-obsidian fixed on
 *  2026-07-23, moved up here so every consumer applies it. */
function bumpRunOnly(prev: MissionRecord | undefined, today: string): MissionRecord {
  return {
    best_time_ms: prev?.best_time_ms ?? 0,
    best_keystrokes: prev?.best_keystrokes ?? 0,
    best_ks_per_min: prev?.best_ks_per_min ?? 0,
    runs: (prev?.runs ?? 0) + 1,
    last_run: today,
  };
}

/**
 * Everything that happens when a mission is solved, as one pure function: XP on every
 * completion (repeats included), the daily streak, the completed list (no duplicates), the
 * personal bests (not for a run without keystrokes), and the par score. Moved up from
 * adapter-web's submit() and neurovim-obsidian's MissionSession so every consumer
 * scores a run the same way — the Neovim port is proven against its conformance vectors.
 * `today` is the player's local day (YYYY-MM-DD) the run counts for — `localDay()` at the call site.
 */
export function completeMission(
  data: PluginData,
  mission: CompletedMission,
  metrics: MetricsResult,
  today: string,
): CompletionResult {
  const { new_data, level_up } = ProgressionEngine.addXp(data, mission.xp_reward);
  let next = ProgressionEngine.recordCompletion(new_data, today);
  if (!next.completed_missions.includes(mission.mission_id)) {
    next = { ...next, completed_missions: [...next.completed_missions, mission.mission_id] };
  }
  // No keystroke means the solution was not typed (pasted, already-solved text, an outside edit).
  const unverified = metrics.keystrokes === 0;
  const prev = next.missions[mission.mission_id];
  const record = unverified ? bumpRunOnly(prev, today) : ProgressionEngine.recordMissionRun(prev, metrics, today);
  next = { ...next, missions: { ...next.missions, [mission.mission_id]: record } };
  const par = resolvePar({ parOverride: mission.par_keystrokes, difficulty: mission.difficulty });
  return {
    data: next,
    xp: mission.xp_reward,
    level_up,
    record,
    par,
    tier: tierFor(metrics.keystrokes, par),
    to_next_tier: keystrokesToNextTier(metrics.keystrokes, par),
    unverified,
  };
}
