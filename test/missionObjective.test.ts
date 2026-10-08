import { describe, it, expect } from 'vitest';
import { objectiveFor } from '../src/missionObjective';

describe('objectiveFor', () => {
  it('splits every authored step into text and exact-string segments', () => {
    const o = objectiveFor({ objective: ['Change `exit` to `exfil`', 'Delete the line `DECOY`'], summary: 's' });
    expect(o).toEqual({
      kind: 'steps',
      steps: [
        [{ code: false, text: 'Change ' }, { code: true, text: 'exit' }, { code: false, text: ' to ' }, { code: true, text: 'exfil' }],
        [{ code: false, text: 'Delete the line ' }, { code: true, text: 'DECOY' }],
      ],
    });
  });

  it('falls back to the summary when the mission has no objective', () => {
    expect(objectiveFor({ summary: 'Fix the roster.' })).toEqual({ kind: 'summary', text: 'Fix the roster.' });
  });

  it('treats an empty or blank objective list as absent', () => {
    expect(objectiveFor({ objective: [], summary: 'S' })).toEqual({ kind: 'summary', text: 'S' });
    expect(objectiveFor({ objective: ['  '], summary: 'S' })).toEqual({ kind: 'summary', text: 'S' });
  });

  it('drops blank steps but keeps the rest', () => {
    expect(objectiveFor({ objective: ['', 'Do `x`'] })).toEqual({
      kind: 'steps',
      steps: [[{ code: false, text: 'Do ' }, { code: true, text: 'x' }]],
    });
  });

  it('returns null when there is nothing to show', () => {
    expect(objectiveFor(undefined)).toBeNull();
    expect(objectiveFor({})).toBeNull();
    expect(objectiveFor({ summary: '   ' })).toBeNull();
  });
});
