/** Whether the player is currently in the mission note. */
export type Presence = 'focused' | 'away';

/**
 * Decide presence from the active note alone — deliberately not "visible in some split".
 * Obsidian's Vim mode is a global setting, so the moment the cursor sits in another note
 * the player is typing there, and that is exactly when Vim has to go back.
 *
 * Clicking the sidebar, settings or the command palette does NOT make a note inactive:
 * Obsidian keeps the last markdown leaf as the active file, so HUD buttons stay usable.
 */
export function resolvePresence(
  activeNotePath: string | null,
  missionPath: string | null,
): Presence {
  if (missionPath === null) return 'away';
  return activeNotePath === missionPath ? 'focused' : 'away';
}
