import type { RunResult } from '@neurovim/core';

/** One recorded keystroke: key name, optional Vim mode, ms since mission start. */
export interface TraceEvent { k: string; m?: string; t: number }

/** A completed run's full record: metrics (from RunResult) + the keystroke sequence.
 *  Serialized one-per-line into traces.jsonl. v1 records only successful runs. */
export interface RunTrace {
  mission_id: string;
  ts: string;
  outcome: 'success';
  elapsed_ms: number;
  keystrokes: number;
  ks_per_min: number;
  par_keystrokes: number | null;
  is_new_best_time: boolean;
  is_new_best_ks: boolean;
  events: TraceEvent[];
}

export function buildRunTrace(
  result: RunResult,
  events: TraceEvent[],
  par: number | null,
  ts: string,
): RunTrace {
  return {
    mission_id: result.mission_id,
    ts,
    outcome: 'success',
    elapsed_ms: result.elapsed_ms,
    keystrokes: result.keystrokes,
    ks_per_min: result.ks_per_min,
    par_keystrokes: par,
    is_new_best_time: result.is_new_best_time,
    is_new_best_ks: result.is_new_best_ks,
    events,
  };
}
