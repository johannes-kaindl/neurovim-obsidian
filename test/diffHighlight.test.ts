import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { diffHighlightField, setDivergentLine } from '../src/diffHighlight';

function stateWith(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [diffHighlightField] });
}

function decoRange(state: EditorState): { from: number; to: number } | null {
  const deco = state.field(diffHighlightField);
  let range: { from: number; to: number } | null = null;
  deco.between(0, Math.max(1, state.doc.length), (from, to) => { range = { from, to }; });
  return range;
}

describe('diffHighlight', () => {
  it('marks the given 0-based line after setDivergentLine', () => {
    let state = stateWith('line0\nline1\nline2');
    state = state.update({ effects: setDivergentLine.of(1) }).state;
    expect(state.field(diffHighlightField).size).toBe(1);
    const line = state.doc.line(2); // 0-based index 1 → 1-based line 2
    expect(decoRange(state)).toEqual({ from: line.from, to: line.to });
  });

  it('clears the decoration on setDivergentLine(null)', () => {
    let state = stateWith('a\nb');
    state = state.update({ effects: setDivergentLine.of(0) }).state;
    state = state.update({ effects: setDivergentLine.of(null) }).state;
    expect(state.field(diffHighlightField).size).toBe(0);
  });

  it('ignores an out-of-range line index', () => {
    let state = stateWith('only one line');
    state = state.update({ effects: setDivergentLine.of(5) }).state;
    expect(state.field(diffHighlightField).size).toBe(0);
  });
});
