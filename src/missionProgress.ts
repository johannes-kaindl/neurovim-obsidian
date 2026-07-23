/** How many solution lines the note currently reproduces. */
export interface LineProgress {
  matched: number;
  /** Line count of the SOLUTION — a note missing lines must not report itself complete. */
  total: number;
}

/**
 * Count positionally matching lines. Trims exactly like the vendored `getDiff`, so the
 * counter can never claim "16/16" for a body that submit rejects.
 */
export function countMatchingLines(current: string, solution: string): LineProgress {
  const cur = current.trim().split('\n');
  const sol = solution.trim().split('\n');
  let matched = 0;
  for (let i = 0; i < sol.length; i++) {
    if (cur[i] === sol[i]) matched++;
  }
  return { matched, total: sol.length };
}

/**
 * Wrap the differing middle of two lines in guillemets so a three-character slip
 * (`exit` vs `exfil`) is visible at a glance. Common prefix and suffix stay bare.
 * A pure insertion/deletion yields an empty pair `»«` on one side — it marks WHERE
 * something is missing rather than silently showing an unchanged-looking line.
 *
 * Guillemets are deliberately textual: the hint renders in an Obsidian `Notice`,
 * which takes no markup.
 */
export function markLineDelta(current: string, solution: string): { has: string; want: string } {
  if (current === solution) return { has: current, want: solution };

  let pre = 0;
  const maxPre = Math.min(current.length, solution.length);
  while (pre < maxPre && current[pre] === solution[pre]) pre++;

  let suf = 0;
  const maxSuf = Math.min(current.length - pre, solution.length - pre);
  while (suf < maxSuf
    && current[current.length - 1 - suf] === solution[solution.length - 1 - suf]) suf++;

  const mark = (s: string): string =>
    `${s.slice(0, pre)}»${s.slice(pre, s.length - suf)}«${s.slice(s.length - suf)}`;

  return { has: mark(current), want: mark(solution) };
}

/** Whether a pause has lasted long enough to warrant the floating banner. */
export function shouldShowPausedBanner(pausedMs: number, thresholdMinutes: number): boolean {
  if (thresholdMinutes <= 0) return false;
  return pausedMs >= thresholdMinutes * 60_000;
}
