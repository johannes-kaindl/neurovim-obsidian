import { describe, it, expect } from 'vitest';
import {
  buildChatMessages, quickReference, serializeCheatsheet, buildKnowledge,
} from '../src/llm/cipherPrompt';
import type { CipherKnowledge, MissionContext } from '../src/llm/cipherPrompt';

const KNOWLEDGE: CipherKnowledge = { quickRef: 'QUICKREF-BODY', cheatsheet: 'CHEATSHEET-BODY' };

describe('quickReference', () => {
  it('selects the ref entry by exact id — not the RAVEN false match of getManual()', () => {
    const entries = [
      { id: '99-THE_RAVEN', role: 'ref', body: 'raven' },
      { id: 'REF-EN-Quick_Reference', role: 'ref', body: 'the real reference' },
    ];
    expect(quickReference(entries)).toBe('the real reference');
  });

  it('returns empty string when the entry is missing', () => {
    expect(quickReference([])).toBe('');
  });
});

describe('serializeCheatsheet', () => {
  it('flattens categories/groups into compact "key — description" lines', () => {
    const out = serializeCheatsheet([
      {
        id: 'fundamentals',
        label: 'FUNDAMENTALS',
        groups: [{ label: 'MODES', keys: [{ key: 'i', description: 'insert before cursor' }] }],
      },
    ]);
    expect(out).toContain('## FUNDAMENTALS');
    expect(out).toContain('### MODES');
    expect(out).toContain('`i` — insert before cursor');
  });
});

describe('buildKnowledge', () => {
  it('builds from the real vendored bundle: non-empty quickRef and cheatsheet', () => {
    const k = buildKnowledge();
    expect(k.quickRef.length).toBeGreaterThan(1000);
    expect(k.cheatsheet).toContain('FUNDAMENTALS');
  });
});

describe('buildChatMessages', () => {
  const mission: MissionContext = {
    id: 'M-01', title: 'First Contact', category: 'fundamentals',
    why: 'Modes are the spine.', parKeystrokes: 12,
  };

  it('starts with one system message carrying persona, guardrail, and knowledge', () => {
    const msgs = buildChatMessages({ knowledge: KNOWLEDGE, mission: null, history: [], question: 'how do I delete a word?' });
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('CIPHER');
    expect(msgs[0].content).toContain('Focus on the mission');       // off-topic guardrail
    expect(msgs[0].content).toContain('QUICKREF-BODY');
    expect(msgs[0].content).toContain('CHEATSHEET-BODY');
    expect(msgs[0].content).toContain('same language the operative used'); // answer-language rule
  });

  it('includes mission context only when a mission is active', () => {
    const withM = buildChatMessages({ knowledge: KNOWLEDGE, mission, history: [], question: 'q' });
    expect(withM[0].content).toContain('First Contact');
    expect(withM[0].content).toContain('par: 12 keystrokes');
    const without = buildChatMessages({ knowledge: KNOWLEDGE, mission: null, history: [], question: 'q' });
    expect(without[0].content).not.toContain('First Contact');
  });

  it('appends history then the new question as the last user message', () => {
    const msgs = buildChatMessages({
      knowledge: KNOWLEDGE, mission: null,
      history: [
        { role: 'user', content: 'earlier q' },
        { role: 'assistant', content: 'earlier a' },
      ],
      question: 'new question',
    });
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(msgs[msgs.length - 1].content).toBe('new question');
  });
});
