import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';

/** Set the first divergent line (0-based) to highlight, or null to clear. */
export const setDivergentLine = StateEffect.define<number | null>();

/** CM6 field that marks the first divergent line after a failed submit. */
export const diffHighlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setDivergentLine)) {
        if (e.value === null) return Decoration.none;
        const lineNum = e.value + 1; // 0-based index → 1-based line
        if (lineNum < 1 || lineNum > tr.state.doc.lines) return Decoration.none;
        const line = tr.state.doc.line(lineNum);
        const builder = new RangeSetBuilder<Decoration>();
        builder.add(line.from, line.to, Decoration.mark({ class: 'nv-diff-line' }));
        return builder.finish();
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Highlight the first divergent line in a live editor. */
export function showDivergentLine(view: EditorView, lineIndex: number): void {
  view.dispatch({ effects: setDivergentLine.of(lineIndex) });
}

/** Clear any divergent-line highlight in a live editor. */
export function clearHighlight(view: EditorView): void {
  view.dispatch({ effects: setDivergentLine.of(null) });
}
