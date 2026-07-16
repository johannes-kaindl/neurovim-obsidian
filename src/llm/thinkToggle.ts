/**
 * Pure mapping of (model, suppress flag) onto request behaviour and toggle state.
 * Obsidian-/DOM-free. Mirrors image-to-markdown's reasoning_toggle.ts — the app layer
 * above the kit's reasoning primitives.
 */
import { isAlwaysOnThinker } from '../vendor/kit/reasoning';

/** Suppress only when the user wants it AND the model can actually be silenced.
 *  gpt-oss/harmony reject reasoning_effort:"none" — never suppress there. */
export function effectiveSuppress(model: string, suppress: boolean): boolean {
  return suppress && !isAlwaysOnThinker(model);
}

/** Description + disabled state for the settings toggle — mirrors effectiveSuppress on
 *  the UI side so the switch never promises something the request can't deliver. */
export function thinkToggleState(model: string, suppress: boolean): { desc: string; disabled: boolean } {
  if (isAlwaysOnThinker(model)) {
    return { desc: 'This model always thinks — it cannot be turned off.', disabled: true };
  }
  return {
    desc: suppress
      ? 'Off: CIPHER answers straight away. Faster, and vim tips rarely need deliberation.'
      : 'On: the model may think before answering. Slower; the thinking itself is not shown.',
    disabled: false,
  };
}
