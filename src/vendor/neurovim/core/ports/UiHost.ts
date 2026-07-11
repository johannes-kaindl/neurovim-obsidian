/**
 * Port: mount container for Preact UI trees.
 *
 * Decouples the Preact components from the question of WHERE they are mounted.
 * - adapter-obsidian: `ItemView` (sidebar), `Modal` (Result/LevelUp), MarkdownPostProcessor.
 * - adapter-web: DOM `<div>` overlays / routes.
 *
 * The Preact components themselves (FloatHUD, SandboxHUD, *Module, modal contents)
 * move unchanged into `core/ui` and depend only on this port.
 * See coupling pattern P5.
 */
import type { ComponentChild } from 'preact';

export interface UiHost {
  /** Mounts a Preact tree into a host container; returns an unmount function. */
  mount(node: ComponentChild): () => void;
}
