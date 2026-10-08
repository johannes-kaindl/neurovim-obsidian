import { DiffResult } from '../types';

/** A mission text reduced to what the player is scored on, plus where it starts in the document. */
export interface NormalizedMissionText {
  /** Scored lines: frontmatter and surrounding blank lines removed, trailing whitespace stripped. */
  lines: string[];
  /** Document line index of `lines[0]` — add it to map a scored index back onto the editor. */
  offset: number;
}

// A YAML block at the very top, closed by its own fence. A lone `---` without a closing
// fence is content (a horizontal rule), not frontmatter, and stays scored.
// Each line matches exactly one way (`[^\r\n]*` cannot swallow the `\r`): with `[^\n]*`
// a CRLF note that opens a fence and never closes it backtracks exponentially and freezes
// the host on submit.
const FRONTMATTER = /^---[ \t]*\r?\n(?:[^\r\n]*\r?\n)*?---[ \t]*(?:\r?\n|$)/;

/**
 * Strip host noise before scoring. Vault plugins (Obsidian Linter, timestamp and title
 * plugins) add YAML frontmatter and drop trailing spaces in the mission note; none of that
 * is a Vim skill, so none of it may fail a run. Solutions never carry frontmatter — the
 * content build parses it off — so stripping is only ever applied to what the host added.
 */
export function normalizeMissionText(text: string): NormalizedMissionText {
  // A BOM from a Windows editor would hide the fence from the `^---` anchor.
  const bom = text.startsWith('\uFEFF') ? 1 : 0;
  const fm = FRONTMATTER.exec(text.slice(bom));
  const head = fm ? fm[0] : '';
  const all = text.slice(bom + head.length).split('\n').map((l) => l.replace(/\s+$/, ''));
  let start = 0;
  while (start < all.length && all[start] === '') start++;
  let end = all.length;
  while (end > start && all[end - 1] === '') end--;
  const headLines = head ? head.split('\n').length - (head.endsWith('\n') ? 1 : 0) : 0;
  return { lines: all.slice(start, end), offset: headLines + start };
}

export function getDiff(current: string, solution: string): DiffResult {
  const currentLines = normalizeMissionText(current).lines;
  const solutionLines = normalizeMissionText(solution).lines;
  let first_divergent_line = -1;
  let lines_off = 0;
  const maxLen = Math.max(currentLines.length, solutionLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (currentLines[i] !== solutionLines[i]) {
      if (first_divergent_line === -1) first_divergent_line = i;
      lines_off++;
    }
  }
  if (lines_off === 0) return { matches: true, first_divergent_line: -1, lines_off: 0 };
  return { matches: false, first_divergent_line, lines_off };
}

/**
 * All 0-based **document** line indices where `current` differs from `solution`, after the
 * same normalization getDiff uses. Empty array when they match. Drives reveal-corruption
 * highlighting (location to look at — not the fix), so the indices point at editor lines:
 * frontmatter a vault plugin added above the text shifts them, it does not misplace them.
 */
export function getDivergentLines(current: string, solution: string): number[] {
  const cur = normalizeMissionText(current);
  const b = normalizeMissionText(solution).lines;
  const max = Math.max(cur.lines.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < max; i++) {
    if (cur.lines[i] !== b[i]) out.push(i + cur.offset);
  }
  return out;
}
