/**
 * Pure prompt building for the post-mission CIPHER debrief. Distinct from the chat
 * (cipherPrompt.ts): here CIPHER comments on a completed run and adapts tone to the
 * performance. Reuses the shared CipherKnowledge/MissionContext types.
 */
import type { LlmMessage, MissionContext, CipherKnowledge } from './cipherPrompt';
import type { TraceEvent, RunTrace } from '../trace';

// The two-stage <think> format matters: small local models reason out loud instead of
// answering. Fighting that with "don't think" fails (see scripts/debrief-lab). Channelling
// the reasoning into a <think> block lets the CipherClient's ThinkSplitter strip it, so the
// operative only ever sees the debrief. Capable models (Qwen3, larger Gemma) honour it or
// suppress reasoning outright; tiny models (gemma-e4b) obey only loosely — the real lever
// there is a bigger model, not more prompt.
const DEBRIEF_PERSONA = `You are CIPHER, a laconic Vim handler in a cyberpunk training game. The operative just finished a mission. You write their debrief.

Work in two stages, exactly this format:

<think>
Here, and ONLY here, do your analysis: scan the keys, find the single biggest wasted pattern, decide the fix. Think as long as you need.
</think>
Then, after </think>, write the debrief and NOTHING else.

The debrief:
- 1 to 3 short lines. No preamble, no restating the data, no repeating the sequence.
- Tone: dry, watchful, in character — but foremost a precise Vim tutor.
- Clean run, at or under par, or a NEW BEST → one dry nod, no tips.
- Over par → name ONE concrete wasted pattern from their keys and give the idiomatic fix. Vim keys verbatim (dw, 3w, ci"). One short line on why.
- Answer in the operative's language. Never reveal story, plot, or mission solutions.

Example — clean run (12 keystrokes, par 11, NEW BEST):
<think>Under par, new best, nothing to correct. Just a nod.</think>
Clean cut. Under par and a new best — CORP won't have felt a thing.

Example — over par (40 keystrokes, par 14 | keys: l l l l l l w w x x j j d d):
<think>Six l in a row to move right — that's 3w. Repeated x to erase — dd is the line kill. Pick the l-crawl, it's the loudest.</think>
Sloppy motion. You crawled with l l l l l l where 3w lands it. And dd beats tapping x line by line. Tighten up.`;

export function serializeSequence(events: TraceEvent[]): string {
  if (events.length === 0) return '(no keystrokes recorded)';
  return events.map((e) => e.k).join(' ');
}

export function buildDebriefMessages(args: {
  knowledge: CipherKnowledge;
  mission: MissionContext | null;
  trace: RunTrace;
}): LlmMessage[] {
  const { knowledge, mission, trace } = args;
  const parts: string[] = [DEBRIEF_PERSONA];
  if (mission) {
    const why = mission.why ? `\nWhy this skill matters: ${mission.why}` : '';
    parts.push(`MISSION: ${mission.id} — "${mission.title}" [category: ${mission.category}]${why}`);
  }
  parts.push(`VIM QUICK REFERENCE (your knowledge base):\n${knowledge.quickRef}`);
  parts.push(`KEY CHEATSHEET:\n${knowledge.cheatsheet}`);

  const parLine = trace.par_keystrokes != null ? ` (par: ${trace.par_keystrokes})` : '';
  const secs = (trace.elapsed_ms / 1000).toFixed(1);
  const best = trace.is_new_best_time || trace.is_new_best_ks ? ' — NEW BEST' : '';
  const user =
    `Debrief this run of mission ${trace.mission_id}${best}.\n` +
    `Keystrokes: ${trace.keystrokes}${parLine}. Time: ${secs}s.\n` +
    `Keystroke sequence: ${serializeSequence(trace.events)}`;

  return [
    { role: 'system', content: parts.join('\n\n---\n\n') },
    { role: 'user', content: user },
  ];
}
