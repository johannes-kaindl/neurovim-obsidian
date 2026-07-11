/**
 * GuidanceEngine — pure derivation of the diegetic guidance shown across the journey
 * (rail, briefing, NEXUS, result). No DOM/obsidian. The single hand-authored input is
 * a mission's `why:` line; everything else is derived from category, the cheatsheet,
 * the next mission, and the player's level. Adaptive visibility = verbosityTier(level),
 * overridable by a user pin.
 */
import { CheatsheetCategory, Keybinding } from '../data/cheatsheet';
import { getHintKeys } from '../utils/hints';
import { guideWhyFor } from '../data/cipher-quotes';

export type VerbosityTier = 0 | 1 | 2; // 0 full · 1 compact · 2 spine-only

export interface GuidanceInput {
  category: string | null;
  summary?: string;
  why?: string;
  /** Next mission in the same arc, or null at an arc's end. */
  next: { mission_id: string; title: string; category: string } | null;
  cheatsheet: CheatsheetCategory[];
  level: number;
  /** User override of the adaptive default. */
  pin?: 'open' | 'quiet' | null;
}

export interface GuidanceModel {
  skillTag: string;
  keys: Keybinding[];
  why: string;
  leadsTo: string | null;
  debrief: string;
  tier: VerbosityTier;
}

const CATEGORY_LABELS: Record<string, string> = {
  fundamentals: 'Modes & editing',
  navigation: 'Navigation (hjkl)',
  'word-movement': 'Word movement',
  operators: 'Operators (d, c, y)',
  'text-objects': 'Text objects',
  'search-replace': 'Search & replace',
  'marks-macros': 'Marks & macros',
  registers: 'Registers',
  case: 'Case operators',
  'visual-block': 'Visual block',
  'ex-commands': 'Ex commands',
  'pane-nav': 'Window panes',
  regex: 'Regex',
  combined: 'Combined skills',
};

export function skillTagFor(category: string | null): string {
  if (!category) return 'Vim practice';
  return CATEGORY_LABELS[category] ?? category;
}

export function verbosityTier(level: number): VerbosityTier {
  if (level <= 2) return 0;
  if (level <= 5) return 1;
  return 2;
}

export function deriveGuidance(input: GuidanceInput): GuidanceModel {
  const tier: VerbosityTier =
    input.pin === 'open' ? 0 : input.pin === 'quiet' ? 2 : verbosityTier(input.level);
  const skillTag = skillTagFor(input.category);
  const leadsTo = input.next ? `${input.next.title} (${input.next.mission_id})` : null;
  const debrief = input.next
    ? `You can use ${skillTag.toLowerCase()} now. Next: ${skillTagFor(input.next.category).toLowerCase()} — ${input.next.mission_id}.`
    : `You can use ${skillTag.toLowerCase()} now. Arc clear — THE RAVEN awaits.`;
  return {
    skillTag,
    keys: getHintKeys(input.category, input.cheatsheet),
    why: input.why?.trim() || guideWhyFor(input.category),
    leadsTo,
    debrief,
    tier,
  };
}
