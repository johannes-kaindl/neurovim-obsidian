import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';

/** Set the divergent lines (0-based indices) to highlight; an empty array clears them. */
export const setDivergentLines = StateEffect.define<number[]>();

/** CM6 field marking every line that still differs from the solution. */
export const diffHighlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setDivergentLines)) {
        const builder = new RangeSetBuilder<Decoration>();
        // RangeSetBuilder requires ascending positions; callers may pass any order.
        for (const idx of [...e.value].sort((a, b) => a - b)) {
          const lineNum = idx + 1; // 0-based index → 1-based line
          if (lineNum < 1 || lineNum > tr.state.doc.lines) continue;
          const line = tr.state.doc.line(lineNum);
          // A zero-length mark decoration is rejected by CM6 — skip blank lines.
          if (line.from === line.to) continue;
          builder.add(line.from, line.to, Decoration.mark({ class: 'nv-diff-line' }));
        }
        return builder.finish();
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Highlight exactly these lines in a live editor, replacing any previous set. */
export function showDivergentLines(view: EditorView, lines: number[]): void {
  view.dispatch({ effects: setDivergentLines.of(lines) });
}

/** Clear every divergent-line highlight in a live editor. */
export function clearHighlight(view: EditorView): void {
  view.dispatch({ effects: setDivergentLines.of([]) });
}
