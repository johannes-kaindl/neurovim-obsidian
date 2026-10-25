import type { RequestSettings, ThinkingLevel } from '../vendor/kit/sampling-profiles';

/** What only this plugin decides about CIPHER's requests. Everything else — sampling values,
 *  thinking, client, time limits, endpoint source — comes from the kit's LLM connection. */

/** CIPHER answers a player's question next to the game — a conversational partner with some
 *  personality, not a transformer of text (kit profile mode `companion`). */
export const MODE = 'companion';

/** The plugin's own token budget — sent as `max_tokens` (the profile has no budget of its own). */
export const CIPHER_MAX_TOKENS = 1024;

/** Name this plugin gives the LLM Endpoint Manager when it asks for an endpoint. */
export const ENDPOINT_CALLER = 'neurovim';

/** The thinking level the model row (and the settings) write for CIPHER's mode. A level other than
 *  "off" is remembered as the one the toggle switches back to. `save` is the plugin's `saveSettings`
 *  (it persists and repaints the hub; the row only redraws when its own state changed, so no loop). */
export async function setCipherThinking(
  settings: { request: RequestSettings },
  level: ThinkingLevel,
  save: () => Promise<void>,
): Promise<void> {
  const next: RequestSettings = { ...settings.request, thinking: { ...settings.request.thinking, [MODE]: level } };
  if (level !== 'off') next.lastOnLevel = { ...next.lastOnLevel, [MODE]: level };
  settings.request = next;
  await save();
}
