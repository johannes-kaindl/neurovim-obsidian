import { DiffResult } from '../types';

export function getDiff(current: string, solution: string): DiffResult {
  if (current.trim() === solution.trim()) {
    return { matches: true, first_divergent_line: -1, lines_off: 0 };
  }
  const currentLines = current.trim().split('\n');
  const solutionLines = solution.trim().split('\n');
  let first_divergent_line = -1;
  let lines_off = 0;
  const maxLen = Math.max(currentLines.length, solutionLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (currentLines[i] !== solutionLines[i]) {
      if (first_divergent_line === -1) first_divergent_line = i;
      lines_off++;
    }
  }
  return { matches: false, first_divergent_line, lines_off };
}

/**
 * All 0-based line indices where `current` differs from `solution`, after the same
 * trim getDiff uses. Empty array when they match. Drives reveal-corruption highlighting
 * (location to look at — not the fix).
 */
export function getDivergentLines(current: string, solution: string): number[] {
  if (current.trim() === solution.trim()) return [];
  const a = current.trim().split('\n');
  const b = solution.trim().split('\n');
  const max = Math.max(a.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) out.push(i);
  }
  return out;
}
