import { listMissions, getMission } from '@neurovim/content';
import type { ContentPort, MissionSummary, MissionDoc, LoreDoc } from '@neurovim/core';

/** ContentPort backed by the vendored, bundled @neurovim/content (NOT the vault). */
export class BundledContent implements ContentPort {
  async listMissions(arc?: 'I' | 'II'): Promise<MissionSummary[]> {
    return listMissions(arc);
  }
  async getMission(id: string): Promise<MissionDoc> {
    return getMission(id);
  }
  async getLore(_id: string): Promise<LoreDoc> {
    throw new Error('Lore is not part of the MVP');
  }
}
