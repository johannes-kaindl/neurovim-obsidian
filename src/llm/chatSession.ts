/** In-memory CIPHER chat state for one Obsidian session. Pure — no Obsidian imports.
 *  Not persisted by design (spec: no chat persistence in v1). */
import type { LlmMessage, MissionContext } from './cipherPrompt';

export type ChatRole = 'user' | 'assistant' | 'error';

export interface ChatEntry {
  role: ChatRole;
  text: string;
  /** Technical detail shown de-emphasized under an error line. */
  detail?: string;
}

export class ChatSession {
  private list: ChatEntry[] = [];
  /** Live assistant answer while a stream is running, else null. */
  streaming: string | null = null;
  busy = false;
  mission: MissionContext | null = null;

  get entries(): readonly ChatEntry[] { return this.list; }

  append(e: ChatEntry): void { this.list.push(e); }

  /** Prompt history: user/assistant turns only — error lines are UI-local. */
  historyForPrompt(): LlmMessage[] {
    return this.list
      .filter((e): e is ChatEntry & { role: 'user' | 'assistant' } => e.role !== 'error')
      .map((e) => ({ role: e.role, content: e.text }));
  }

  /** Channel reset: wipe the conversation; the mission context survives. */
  reset(): void {
    this.list = [];
    this.streaming = null;
    this.busy = false;
  }

  setMission(m: MissionContext | null): void { this.mission = m; }
}
