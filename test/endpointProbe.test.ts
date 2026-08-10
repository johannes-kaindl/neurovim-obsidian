import { describe, it, expect, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { probeEndpoint } from '../src/llm/endpointProbe';
import type { ClockPort } from '../src/vendor/kit-obsidian/clock';

vi.mock('obsidian', async () => {
  const actual = await vi.importActual<typeof import('obsidian')>('obsidian');
  return { ...actual, requestUrl: vi.fn() };
});

const fakeClock: ClockPort = {
  now: () => 0,
  setTimeout: () => 0,
  clearTimeout: () => {},
};

describe('probeEndpoint', () => {
  it('sends a Bearer header built from the endpoint\'s own apiKey, not a global one', async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200, text: JSON.stringify({ data: [{ id: 'qwen3-8b' }] }),
    } as never);
    const result = await probeEndpoint({ url: 'http://a:1', apiKey: 'sk-row' }, fakeClock);
    expect(vi.mocked(requestUrl)).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { Authorization: 'Bearer sk-row' } }),
    );
    expect(result.status.kind).toBe('ok');
    expect(result.models).toEqual(['qwen3-8b']);
  });

  it('sends no Authorization header when the endpoint has no apiKey', async () => {
    vi.mocked(requestUrl).mockResolvedValue({ status: 200, text: '{"data":[]}' } as never);
    await probeEndpoint({ url: 'http://a:1' }, fakeClock);
    expect(vi.mocked(requestUrl)).toHaveBeenCalledWith(expect.objectContaining({ headers: {} }));
  });

  it('classifies a timeout via the injected clock instead of a real timer', async () => {
    vi.mocked(requestUrl).mockImplementation(() => new Promise(() => {})); // never resolves
    let firedAfterMs = -1;
    const timingClock: ClockPort = {
      now: () => 0,
      setTimeout: (fn, ms) => { firedAfterMs = ms; fn(); return 1; },
      clearTimeout: () => {},
    };
    const result = await probeEndpoint({ url: 'http://a:1' }, timingClock);
    expect(firedAfterMs).toBe(5_000);
    expect(result.status.kind).toBe('timeout');
  });
});
