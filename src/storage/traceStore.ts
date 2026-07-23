import type { RunTrace } from '../trace';

/** Minimal append sink — Obsidian's vault.adapter satisfies this (append creates on first
 *  write). Injected so the store is testable without Obsidian. */
export interface TraceSink {
  append(path: string, data: string): Promise<void>;
}

/** Append-only JSONL trace log. One run per line. Lives in the plugin config dir, never in
 *  vault content. Failures are swallowed: the run already succeeded upstream (XP persisted),
 *  telemetry must never take it down. */
export class TraceStore {
  constructor(private readonly sink: TraceSink, private readonly path: string) {}

  async append(trace: RunTrace): Promise<void> {
    try {
      await this.sink.append(this.path, JSON.stringify(trace) + '\n');
    } catch (e) {
      console.warn('NeuroVim: trace append failed', e);
    }
  }
}
