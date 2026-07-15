import type { MissionSummary, PluginData } from '@neurovim/core';

/** First unlocked mission the player hasn't completed yet, in list order. */
export function nextMission(missions: MissionSummary[], data: PluginData): MissionSummary | null {
  return missions.find(
    (m) => data.unlocked.includes(m.mission_id) && !data.completed_missions.includes(m.mission_id),
  ) ?? null;
}
