import { describe, it, expect } from 'vitest';
import { buildDebriefMessages, serializeSequence } from '../src/llm/debriefPrompt';
import type { RunTrace } from '../src/trace';

const knowledge = { quickRef: 'QREF', cheatsheet: 'CHEAT' };
const mission = { id: 'M1', title: 'First Cut', category: 'delete', why: 'wasted motion is a liability', parKeystrokes: 11 };
const trace: RunTrace = {
  mission_id: 'M1', ts: 'T', outcome: 'success', elapsed_ms: 8200, keystrokes: 23,
  ks_per_min: 168, par_keystrokes: 11, is_new_best_time: true, is_new_best_ks: false,
  events: [{ k: 'l' }, { k: 'l' }, { k: 'l' }, { k: 'd' }, { k: 'w' }].map((e, i) => ({ ...e, t: i * 100 })),
};

describe('serializeSequence', () => {
  it('joins keys in order', () => {
    expect(serializeSequence(trace.events)).toBe('l l l d w');
  });
  it('marks an empty sequence', () => {
    expect(serializeSequence([])).toBe('(no keystrokes recorded)');
  });
});

describe('buildDebriefMessages', () => {
  const msgs = buildDebriefMessages({ knowledge, mission, trace });

  it('opens with a CIPHER system prompt carrying the knowledge base', () => {
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('CIPHER');
    expect(msgs[0].content).toContain('QREF');
  });
  it('puts the sequence and metrics in the user turn', () => {
    const user = msgs[msgs.length - 1];
    expect(user.role).toBe('user');
    expect(user.content).toContain('l l l d w');
    expect(user.content).toContain('23');   // keystrokes
    expect(user.content).toContain('11');   // par
  });
  it('does not crash when par is null', () => {
    const t2 = { ...trace, par_keystrokes: null };
    const m = buildDebriefMessages({ knowledge, mission: null, trace: t2 });
    expect(m[m.length - 1].content).toContain('l l l d w');
  });
});
