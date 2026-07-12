import { App, MarkdownView } from 'obsidian';
import { render, h } from 'preact';
import { MissionHud } from './MissionHud';
import type { HudDom, HudHandle, HudRenderProps } from './HudMount';

/**
 * Real HudDom over the Obsidian workspace. Finds the CM editor of the mission note
 * and mounts a Preact HUD container onto it. Thin adapter — verified via the Obsidian
 * smoke test, not unit-tested (no DOM in the vitest node env).
 */
export class ObsidianHudDom implements HudDom {
  constructor(private readonly app: App) {}

  editorElFor(notePath: string): HTMLElement | null {
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === notePath) {
        const el = view.contentEl.querySelector('.cm-editor');
        if (el instanceof HTMLElement) return el;
      }
    }
    return null;
  }

  create(editorEl: unknown): HudHandle {
    const host = editorEl as HTMLElement;
    const container = document.createElement('div');
    container.className = 'nv-float-hud-container';
    host.appendChild(container);
    return {
      render: (props: HudRenderProps) => render(h(MissionHud, props), container),
      destroy: () => { render(null, container); container.remove(); },
    };
  }
}
