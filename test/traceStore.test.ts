import { describe, it, expect, vi } from 'vitest';
import { TraceStore, type TraceSink } from '../src/storage/traceStore';
import type { RunTrace } from '../src/trace';

const trace: RunTrace = {
  mission_id: 'M1', ts: 'T', outcome: 'success', elapsed_ms: 1, keystrokes: 2,
  ks_per_min: 3, par_keystrokes: 4, is_new_best_time: false, is_new_best_ks: false,
  events: [{ k: 'd', t: 1 }],
};

function fakeSink(): TraceSink & { data: string } {
  const s = { data: '', append: async (_p: string, d: string) => { s.data += d; } };
  return s;
}

describe('TraceStore', () => {
  it('appends exactly one JSONL line per trace', async () => {
    const sink = fakeSink();
    const store = new TraceStore(sink, 'traces.jsonl');
    await store.append(trace);
    expect(sink.data).toBe(JSON.stringify(trace) + '\n');
    expect(sink.data.split('\n').filter(Boolean)).toHaveLength(1);
  });

  it('accumulates across appends', async () => {
    const sink = fakeSink();
    const store = new TraceStore(sink, 'traces.jsonl');
    await store.append(trace);
    await store.append(trace);
    expect(sink.data.split('\n').filter(Boolean)).toHaveLength(2);
  });

  it('swallows a sink failure (telemetry never breaks the run)', async () => {
    const sink: TraceSink = { append: () => Promise.reject(new Error('disk full')) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new TraceStore(sink, 'traces.jsonl');
    await expect(store.append(trace)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
