import { withThinkingLevel, type RequestSettings, type ThinkingLevel } from '../vendor/kit/sampling-profiles';

/** What only this plugin decides about CIPHER's requests. Everything else — sampling values,
 *  thinking, client, time limits, endpoint source — comes from the kit's LLM connection. */

/** CIPHER answers a player's question next to the game — a conversational partner with some
 *  personality, not a transformer of text (kit profile mode `companion`). */
export const MODE = 'companion';

/** The plugin's own token budget — sent as `max_tokens` (the profile has no budget of its own). */
export const CIPHER_MAX_TOKENS = 1024;

/** Name this plugin gives the LLM Endpoint Manager when it asks for an endpoint. */
export const ENDPOINT_CALLER = 'neurovim';

/** Writes the thinking level for CIPHER's mode (the rule itself, incl. remembering the on-level the toggle switches back to,
 *  is the kit's `withThinkingLevel`). `save` is the plugin's `saveSettings` (it persists and repaints the hub; the row only
 *  redraws when its own state changed, so no loop). */
export async function setCipherThinking(
  settings: { request: RequestSettings },
  level: ThinkingLevel,
  save: () => Promise<void>,
): Promise<void> {
  settings.request = withThinkingLevel(settings.request, MODE, level);
  await save();
}
