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

interface AlignOp {
  kind: 'keep' | 'drop' | 'add';
  /** Index in `a` the op stands at (for `add`: the line it would be inserted before). */
  at: number;
}

/**
 * Largest middle (after the common prefix and suffix) that is still aligned: n·m table cells,
 * 250 000 = 500 × 500 lines. Solutions stay under ~100 lines, so a mission never comes near;
 * the cap exists because the table costs O(n·m) time and memory and a pasted wall of text
 * would freeze check and reveal. Past it the middle is not aligned at all (see `alignLines`).
 * Ports must use the same number — it is part of the conformance vectors.
 */
export const LCS_CELL_LIMIT = 250_000;

/**
 * Align `a` (the player's lines) onto `b` (the solution) along a longest common subsequence.
 * Deterministic, so every port aligns identically: common prefix first, then the common suffix
 * over what the prefix left (the two never overlap), then a suffix-LCS table over the middle;
 * on a tie the line of `a` is dropped before a line of `b` is added. When the middle has more
 * than LCS_CELL_LIMIT cells (n·m) there is no table: every middle line of `a` is dropped, then
 * every middle line of `b` is added, so the middle contributes nothing to the common count.
 */
function alignLines(a: string[], b: string[]): { ops: AlignOp[]; common: number } {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let q = 0;
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
  const n = a.length - p - q;
  const m = b.length - p - q;
  // An empty middle side needs no table either: its result is the same drops or adds.
  const useTable = n > 0 && m > 0 && n * m <= LCS_CELL_LIMIT;
  // L[i][j] = LCS length of a[p+i .. p+n) and b[p+j .. p+m).
  const L: number[][] = Array.from({ length: useTable ? n + 1 : 0 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; useTable && i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = a[p + i] === b[p + j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const ops: AlignOp[] = [];
  for (let k = 0; k < p; k++) ops.push({ kind: 'keep', at: k });
  let i = 0;
  let j = 0;
  while (useTable && i < n && j < m) {
    if (a[p + i] === b[p + j]) {
      ops.push({ kind: 'keep', at: p + i });
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      ops.push({ kind: 'drop', at: p + i });
      i++;
    } else {
      ops.push({ kind: 'add', at: p + i });
      j++;
    }
  }
  for (; i < n; i++) ops.push({ kind: 'drop', at: p + i });
  for (; j < m; j++) ops.push({ kind: 'add', at: p + n });
  for (let k = 0; k < q; k++) ops.push({ kind: 'keep', at: p + n + k });
  return { ops, common: p + q + (useTable ? L[0][0] : 0) };
}

export function getDiff(current: string, solution: string): DiffResult {
  const a = normalizeMissionText(current).lines;
  const b = normalizeMissionText(solution).lines;
  const { ops, common } = alignLines(a, b);
  const lines_off = Math.max(a.length, b.length) - common;
  if (lines_off === 0) return { matches: true, first_divergent_line: -1, lines_off: 0 };
  const first = ops.find((o) => o.kind !== 'keep')!;
  return { matches: false, first_divergent_line: first.at, lines_off };
}

/**
 * All 0-based **document** line indices where `current` differs from `solution`, after the
 * same normalization and alignment getDiff uses. Empty array when they match. Drives
 * reveal-corruption highlighting (location to look at — not the fix): lines to remove or
 * change are marked; a run of missing lines that borders no such line marks the line at its
 * insertion point (the last line when it is missing at the end). Indices point at editor
 * lines: frontmatter a vault plugin added above the text shifts them, it does not misplace them.
 */
export function getDivergentLines(current: string, solution: string): number[] {
  const cur = normalizeMissionText(current);
  const { ops } = alignLines(cur.lines, normalizeMissionText(solution).lines);
  const marked = new Set<number>();
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    if (op.kind === 'drop') marked.add(op.at);
    if (op.kind !== 'add' || (k > 0 && ops[k - 1].kind === 'add')) continue;
    let end = k;
    while (end + 1 < ops.length && ops[end + 1].kind === 'add') end++;
    const bordersDrop = (k > 0 && ops[k - 1].kind === 'drop') || (end + 1 < ops.length && ops[end + 1].kind === 'drop');
    if (!bordersDrop && cur.lines.length > 0) marked.add(Math.min(op.at, cur.lines.length - 1));
  }
  return [...marked].sort((x, y) => x - y).map((i) => i + cur.offset);
}
