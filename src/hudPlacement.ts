/** Where the mission-control HUD is shown. */
export type HudPlacement = 'sidebar' | 'box' | 'auto';

/** Concrete surface the HUD is rendered on for the current state. */
export type HudTarget = 'sidebar' | 'box' | 'none';

/**
 * Decide where the mission-control HUD goes, given the user's placement setting,
 * whether the NeuroVim pane is currently visible, and whether the user dismissed
 * the box for this mission. Only called while a mission is active.
 *
 * - 'sidebar': pane only (nothing when the pane is closed).
 * - 'box': always the floating box (until dismissed for this mission).
 * - 'auto': pane when visible, floating box otherwise (until dismissed).
 */
export function resolveHudTarget(
  placement: HudPlacement,
  paneVisible: boolean,
  boxDismissed: boolean,
): HudTarget {
  if (placement === 'sidebar') return paneVisible ? 'sidebar' : 'none';
  if (placement === 'box') return boxDismissed ? 'none' : 'box';
  // 'auto'
  if (paneVisible) return 'sidebar';
  return boxDismissed ? 'none' : 'box';
}
