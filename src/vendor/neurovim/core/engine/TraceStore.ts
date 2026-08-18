import type { RunTrace } from './RunTrace';

/** Minimal append sink — Obsidian's `vault.adapter` satisfies it as-is (append creates the
 *  file on first write). Injected so the store is testable without any platform runtime.
 *  Deliberately not a fifth port: it is a one-method callback an adapter already owns an
 *  object for, not a platform capability the core has to negotiate (ADR-001 fixes four). */
export interface TraceSink {
  append(path: string, data: string): Promise<void>;
}

/** Append-only JSONL trace log. One run per line. Failures are swallowed: the run already
 *  succeeded upstream (XP persisted), telemetry must never take it down. */
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
