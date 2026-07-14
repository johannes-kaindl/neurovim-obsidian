import { describe, it, expect } from 'vitest';
import { ChatSession } from '../src/llm/chatSession';

describe('ChatSession', () => {
  it('appends entries and exposes them in order', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'q' });
    s.append({ role: 'assistant', text: 'a' });
    expect(s.entries.map((e) => e.text)).toEqual(['q', 'a']);
  });

  it('historyForPrompt maps user/assistant and skips error entries', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'q' });
    s.append({ role: 'error', text: 'Signal lost.', detail: 'HTTP 500' });
    s.append({ role: 'assistant', text: 'a' });
    expect(s.historyForPrompt()).toEqual([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ]);
  });

  it('reset clears entries and streaming but keeps the mission context', () => {
    const s = new ChatSession();
    s.setMission({ id: 'M-01', title: 'T', category: 'c' });
    s.append({ role: 'user', text: 'q' });
    s.streaming = 'partial';
    s.busy = true;
    s.reset();
    expect(s.entries).toEqual([]);
    expect(s.streaming).toBeNull();
    expect(s.busy).toBe(false);
    expect(s.mission?.id).toBe('M-01');
  });

  it('setMission(null) clears the mission but keeps the chat history', () => {
    const s = new ChatSession();
    s.append({ role: 'user', text: 'q' });
    s.setMission({ id: 'M-01', title: 'T', category: 'c' });
    s.setMission(null);
    expect(s.mission).toBeNull();
    expect(s.entries.length).toBe(1);
  });
});
