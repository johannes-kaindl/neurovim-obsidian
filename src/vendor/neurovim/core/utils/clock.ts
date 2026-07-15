/** Injected timer port. Keeps timer-using classes testable in a plain Node
 *  environment (no `window`) while the real browser/Obsidian runtime always
 *  has `window` — only test environments lack it, which is why the bare
 *  global is never called directly from a tested module. Mirrors
 *  AudioEngine's own optional-injection style (contextFactory). */
export interface ClockPort {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

export const realClock: ClockPort = {
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id),
};
