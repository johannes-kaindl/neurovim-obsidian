import { describe, it, expect } from 'vitest';
import { BundledContent } from '../src/content/BundledContent';

describe('BundledContent', () => {
  it('lists missions including the default-unlocked M-01', async () => {
    const c = new BundledContent();
    const missions = await c.listMissions();
    expect(missions.length).toBeGreaterThan(0);
    expect(missions.map((m) => m.mission_id)).toContain('M-01');
  });

  it('returns M-01 with a transmission body and a solution target', async () => {
    const c = new BundledContent();
    const doc = await c.getMission('M-01');
    expect(doc.mission_id).toBe('M-01');
    expect(doc.transmissionBody.length).toBeGreaterThan(0);
    expect(typeof doc.solution).toBe('string');
    expect((doc.solution ?? '').length).toBeGreaterThan(0);
  });
});
