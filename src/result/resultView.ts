import type { RunResult } from '@neurovim/core';

export interface DeltaView {
  arrow: '▲' | '▼';
  magnitude: string;
  good: boolean;
}

export interface MetricRow {
  label: string;
  value: string;
  delta: DeltaView | null;
  newBest: boolean;
}

export interface ResultView {
  title: string;
  rows: MetricRow[];
  xp: number;
  /** Run without a single keystroke — shown as such, never recorded as a best. */
  unverified: boolean;
}

/** Sub-minute → "0.7s" (one decimal); >= 1 min → "M:SS". */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Build a DeltaView from a raw delta. Convention: ▲ = improvement / ▼ = regression
 * (up = better), regardless of the raw metric's direction. A zero delta is neutral (null).
 */
function delta(raw: number, betterWhenNegative: boolean, magnitude: string): DeltaView | null {
  if (raw === 0) return null;
  const good = betterWhenNegative ? raw < 0 : raw > 0;
  return { arrow: good ? '▲' : '▼', magnitude, good };
}

/** Pure: turn a RunResult into a presentation-ready view-model. No Obsidian/Preact/DOM. */
export function buildResultView(r: RunResult, unverified = false): ResultView {
  return {
    title: r.mission_id,
    xp: r.xp_earned,
    unverified,
    rows: [
      {
        label: 'TIME',
        value: formatDuration(r.elapsed_ms),
        delta: delta(r.delta_time_ms, true, `${(Math.abs(r.delta_time_ms) / 1000).toFixed(1)}s`),
        newBest: r.is_new_best_time,
      },
      {
        label: 'KEYSTROKES',
        value: String(r.keystrokes),
        delta: delta(r.delta_keystrokes, true, String(Math.abs(r.delta_keystrokes))),
        newBest: r.is_new_best_ks,
      },
      {
        label: 'KS/MIN',
        value: String(Math.round(r.ks_per_min)),
        delta: delta(r.delta_ks_per_min, false, Math.abs(r.delta_ks_per_min).toFixed(1)),
        newBest: false,
      },
    ],
  };
}
