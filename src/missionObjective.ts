import { splitInlineCode, type ObjectiveSegment, type MissionSummary } from '@neurovim/core';

/** What the HUD shows as the mission's target: concrete steps, or the summary as fallback. */
export type MissionObjective =
  | { kind: 'steps'; steps: ObjectiveSegment[][] }
  | { kind: 'summary'; text: string };

/**
 * The target, visible for the whole run. The only challenge is meant to be the Vim
 * motions, never guessing what to change — so authored `objective` steps win, each split
 * into prose and exact strings (backticks) the HUD sets apart. Missions without steps fall
 * back to their summary; null when neither exists.
 */
export function objectiveFor(
  m: Pick<MissionSummary, 'objective' | 'summary'> | undefined,
): MissionObjective | null {
  if (!m) return null;
  const steps = (m.objective ?? []).filter((s) => s.trim() !== '').map((s) => splitInlineCode(s));
  if (steps.length > 0) return { kind: 'steps', steps };
  const summary = m.summary?.trim();
  return summary ? { kind: 'summary', text: summary } : null;
}
