import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { diffHighlightField, setDivergentLines } from '../src/diffHighlight';

/** Drives the StateField directly: there is no DOM in the vitest node env, so the
 *  EditorView-based helpers (showDivergentLines/clearHighlight) are covered by the
 *  Obsidian smoke test rather than here. */
function stateWith(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [diffHighlightField] });
}

function decoRanges(state: EditorState): Array<{ from: number; to: number }> {
  const deco = state.field(diffHighlightField);
  const out: Array<{ from: number; to: number }> = [];
  deco.between(0, Math.max(1, state.doc.length), (from, to) => { out.push({ from, to }); });
  return out;
}

describe('diffHighlight', () => {
  it('marks the given 0-based line', () => {
    let state = stateWith('line0\nline1\nline2');
    state = state.update({ effects: setDivergentLines.of([1]) }).state;
    expect(state.field(diffHighlightField).size).toBe(1);
    const line = state.doc.line(2); // 0-based index 1 → 1-based line 2
    expect(decoRanges(state)).toEqual([{ from: line.from, to: line.to }]);
  });

  it('marks several lines at once', () => {
    let state = stateWith('alpha\nbravo\ncharlie');
    state = state.update({ effects: setDivergentLines.of([0, 2]) }).state;
    expect(state.field(diffHighlightField).size).toBe(2);
  });

  it('accepts unsorted indices (RangeSetBuilder needs ascending order)', () => {
    let state = stateWith('alpha\nbravo\ncharlie');
    state = state.update({ effects: setDivergentLines.of([2, 0]) }).state;
    expect(state.field(diffHighlightField).size).toBe(2);
  });

  it('clears the decorations on an empty array', () => {
    let state = stateWith('a\nb');
    state = state.update({ effects: setDivergentLines.of([0]) }).state;
    state = state.update({ effects: setDivergentLines.of([]) }).state;
    expect(state.field(diffHighlightField).size).toBe(0);
  });

  it('ignores out-of-range line indices', () => {
    let state = stateWith('only one line');
    state = state.update({ effects: setDivergentLines.of([5]) }).state;
    expect(state.field(diffHighlightField).size).toBe(0);
  });

  it('keeps the valid indices when one is out of range', () => {
    let state = stateWith('alpha\nbravo');
    state = state.update({ effects: setDivergentLines.of([0, 99]) }).state;
    expect(state.field(diffHighlightField).size).toBe(1);
  });

  it('skips blank lines — a zero-length mark decoration is invalid in CM6', () => {
    let state = stateWith('alpha\n\ncharlie');
    state = state.update({ effects: setDivergentLines.of([0, 1, 2]) }).state;
    expect(state.field(diffHighlightField).size).toBe(2);
  });
});
