/**
 * @neurovim/core — canonical state schema.
 *
 * Platform-neutral, pure TS interfaces (no classes, no implementation,
 * no Obsidian dependency). Source of truth for `StoragePort` (persistence),
 * engine logic and adapters. Ported from the legacy plugin
 * `32_NeuroVim/_dev/plugin-src/src/types.ts` (v1.0.0) — the legacy version stays untouched,
 * this file is the monorepo contract.
 *
 * See ADR-001 §Decisions (D1 curriculum, D4 audio constraint).
 */

// ── Mission identity & frontmatter ───────────────────────────
export type MissionStatus = 'idle' | 'active' | 'result';
export type HudMode = 'guide-onboard' | 'guide-idle' | 'mission';
export type MissionType = 'practice' | 'briefing' | 'loot' | 'sandbox';

export interface MissionFrontmatter {
  mission_id: string;
  mission_type: MissionType;
  title: string;
  category: string;
  xp_reward: number;
  locked: boolean;
  tier: string;
  /** Mission difficulty (1..N) — drives the computed par-tier default. Optional. */
  difficulty?: number;
  /** Hand-tuned keystroke par override (gold threshold). Optional; else computed from difficulty. */
  par_keystrokes?: number;
  /** One-line mission summary (existing in markdown; now typed). */
  summary?: string;
  /** Authored CIPHER "why this skill matters" line. Optional; GuidanceEngine falls back to guideWhyFor. */
  why?: string;
}

// ── Run result & records ─────────────────────────────────────
export interface RunResult {
  mission_id: string;
  elapsed_ms: number;
  keystrokes: number;
  ks_per_min: number;
  xp_earned: number;
  is_new_best_time: boolean;
  is_new_best_ks: boolean;
  delta_time_ms: number;
  delta_keystrokes: number;
  delta_ks_per_min: number;
}

export interface MissionRecord {
  best_time_ms: number;
  best_keystrokes: number;
  best_ks_per_min: number;
  runs: number;
  last_run: string;
}

// ── Persistent player state (= StoragePort payload) ──────────
export interface PluginData {
  missions: Record<string, MissionRecord>;
  total_xp: number;
  streak_current: number;
  streak_last_date: string;
  sidebar_module_state: Record<string, boolean>;
  unlocked: string[];
  completed_missions: string[];
  sandbox_bests: SandboxBests;
  onboarded: boolean;
  healedFrontmatters: Record<string, string>;
  ambient_enabled: boolean;
  /** First-run "What is Vim" primer gate. */
  vimPrimerSeen: boolean;
  /** Comms-Rail user override of the adaptive default. */
  railPin: 'open' | 'quiet' | null;
}

// ── Level / Progression ──────────────────────────────────────
export interface Level {
  level: number;
  title: string;
  xp_required: number;
  color: string;
}

export interface LevelUpResult {
  old_level: number;
  new_level: number;
  unlocked_missions: string[];
  unlocked_loot: string[];
}

// ── Runtime state (not persisted) ────────────────────────────
export interface MissionState {
  status: MissionStatus;
  mission_id: string | null;
  file_path: string | null;
  solution_path: string | null;
  corrupted_path: string | null;
  category: string | null;
  xp_reward: number;
  drill_mode: boolean;
  drill_count: number;
}

export interface DiffResult {
  matches: boolean;
  first_divergent_line: number;
  lines_off: number;
}

// ── Sandbox (THE RAVEN, M-08) ────────────────────────────────
export type SandboxDifficulty = 'easy' | 'normal' | 'hard';
export type SandboxStatus = 'active' | 'result';

export interface SandboxBests {
  easy: number | null;
  normal: number | null;
  hard: number | null;
}

export interface SandboxState {
  status: SandboxStatus | null;
  difficulty: SandboxDifficulty | null;
  remaining_glitches: number;
  cursor_hint: string | null;
}

export interface GlitchDefinition {
  id: string;
  type: 'insert_corp_line' | 'caps_word' | 'corp_word_replace' | 'tag_append' | 'join_lines';
  target_line_pattern: string;
  insert_after?: boolean;
  injected_text?: string;
  target_word?: string;
  replacement?: string;
  tag?: string;
  join_with_next?: boolean;
  vim_move: string;
  hint: string;
}

export interface AppliedGlitch {
  definition: GlitchDefinition;
  line_number: number;
}

export interface AppliedGlitches {
  text: string;
  glitches: AppliedGlitch[];
}

// ── Defaults ─────────────────────────────────────────────────
export const DEFAULT_PLUGIN_DATA: PluginData = {
  missions: {},
  total_xp: 0,
  streak_current: 0,
  streak_last_date: '',
  sidebar_module_state: { mission: true, cheatsheet: false, progress: false },
  unlocked: ['M-01', 'M-02', 'M-03', 'M-04', 'KATA-01'],
  completed_missions: [],
  sandbox_bests: { easy: null, normal: null, hard: null },
  onboarded: false,
  healedFrontmatters: {},
  ambient_enabled: false,
  vimPrimerSeen: false,
  railPin: null,
};

export const DEFAULT_MISSION_STATE: MissionState = {
  status: 'idle',
  mission_id: null,
  file_path: null,
  solution_path: null,
  corrupted_path: null,
  category: null,
  xp_reward: 0,
  drill_mode: false,
  drill_count: 0,
};

export const DEFAULT_SANDBOX_STATE: SandboxState = {
  status: null,
  difficulty: null,
  remaining_glitches: 0,
  cursor_hint: null,
};
