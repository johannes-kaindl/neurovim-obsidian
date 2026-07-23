/**
 * Pure prompt building for the post-mission CIPHER debrief. Distinct from the chat
 * (cipherPrompt.ts): here CIPHER comments on a completed run and adapts tone to the
 * performance. Reuses the shared CipherKnowledge/MissionContext types.
 */
import type { LlmMessage, MissionContext, CipherKnowledge } from './cipherPrompt';
import type { TraceEvent, RunTrace } from '../trace';

const DEBRIEF_PERSONA = `You are CIPHER, the operative's handler inside NeuroVim — a
cyberpunk Vim training game. The operative just completed a mission. Debrief them.

Voice: laconic, dry, watchful — CORP is listening, wasted motion is a liability. But you
are above all an excellent Vim tutor: clear, correct, concrete. Didactics beat immersion.

Adapt to the performance:
- At or under par, or a NEW BEST → a tight in-character nod. One or two lines. No lecture.
- Well over par → name the wasted motion in their actual keystroke sequence and give the
  idiomatic fix (e.g. "you walked to word 3 with l l l — 3w is one move"). Exact keys,
  then one line on WHY (operator + motion/text-object).

Rules:
- Answer in the operative's mission language; keep Vim keys verbatim (dw, ci", 3w).
- Keep it short: a few lines, no bullet-point essays.
- Never reveal story content, mission solutions, or plot.`;

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
