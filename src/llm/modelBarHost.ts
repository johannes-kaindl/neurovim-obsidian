import type { App } from 'obsidian';
import { buildModelBar, type ModelBar, type ModelBarConnection } from '../vendor/kit-obsidian/model-bar';
import { thinkingOffTexts, type ThinkingControlOptions, type ThinkingControlStrings } from '../vendor/kit-obsidian/thinking-control';

/** Texts of the thinking control in the row. The plugin has no UI language switch (it is English), so
 *  the kit's English texts for "off is not possible" and plain labels for the levels. */
export const THINKING_STRINGS: ThinkingControlStrings = {
  button: (level) => (level !== 'off' ? `Thinking: ${level}` : 'Thinking: off'),
  offNotPossible: thinkingOffTexts('en'),
  level: (l) => l,
  pickerLabel: 'Thinking level',
};

export interface ModelBarHostOptions {
  app: App;
  /** The four methods of `LlmConnection` the row needs (`plugin.llm`). */
  llm: ModelBarConnection;
  /** Name of the task, shown before the dropdown and in its `aria-label`. */
  label: string;
  thinking: Omit<ThinkingControlOptions, 'containerEl'>;
  /** CIPHER is answering: the row is locked. */
  busy: () => boolean;
  /** Identifies the endpoint the row talks to (source, list, choice). When it changes, the model list is reloaded: the row loads it only at
   *  mount otherwise. */
  listKey?: () => string;
  onError?: (error: unknown) => void;
}

export interface ModelBarHost {
  /** Redraws the row if (and only if) what it shows has changed since the last draw. */
  update(): void;
  /** Reloads the model list (the endpoint changed). */
  refresh(): Promise<void>;
  destroy(): void;
}

/** Builds the kit's model row ONCE into `el` and keeps it. The hub pane repaints every 500 ms and hands
 *  over fresh option objects each time, so everything the row reads goes through `source()` (the latest
 *  options), never through what was current at mount. `update()` is cheap and called after every
 *  repaint: it redraws only when the state the row shows changed, because a redraw rebuilds the
 *  dropdown's entries, and an open dropdown must survive the timer. */
export function mountModelBarHost(el: HTMLElement, source: () => ModelBarHostOptions): ModelBarHost {
  const stamp = (): string => {
    const o = source();
    const src = o.llm.source();
    return [o.busy(), o.llm.modelInUse(), o.thinking.current(), o.thinking.levelPicker(), src.family, src.backend, src.defaultModel ?? ''].join('|');
  };
  const first = source();
  let seen = stamp();
  let listKey = first.listKey?.() ?? '';
  let destroyed = false;
  const build = (): ModelBar => buildModelBar({
    app: first.app,
    containerEl: el,
    llm: {
      models: (o) => source().llm.models(o),
      setModel: (m) => source().llm.setModel(m),
      modelInUse: () => source().llm.modelInUse(),
      source: () => source().llm.source(),
    },
    label: first.label,
    strings: { lang: 'en' },
    thinking: {
      family: () => source().thinking.family(),
      backend: () => source().thinking.backend?.(),
      current: () => source().thinking.current(),
      onLevel: () => source().thinking.onLevel(),
      setLevel: (l) => source().thinking.setLevel(l),
      levelPicker: () => source().thinking.levelPicker(),
      strings: first.thinking.strings,
    },
    disabled: () => source().busy(),
    onError: (e) => source().onError?.(e),
  });
  const bar = build();
  return {
    update(): void {
      if (destroyed) return;
      const key = source().listKey?.() ?? '';
      if (key !== listKey) {
        // Another endpoint: its models are not the ones on show. `refresh` redraws when the list is in.
        listKey = key;
        seen = stamp();
        void bar.refresh();
        return;
      }
      const now = stamp();
      if (now === seen) return;
      seen = now;
      bar.update();
    },
    refresh: () => (destroyed ? Promise.resolve() : bar.refresh()),
    destroy(): void { destroyed = true; bar.destroy(); },
  };
}
