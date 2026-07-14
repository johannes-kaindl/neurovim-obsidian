/**
 * Pure prompt building for the CIPHER uplink. No Obsidian imports.
 * Knowledge = bundled EN quick reference (selected by EXACT id — the vendored
 * getManual() matches 99-THE_RAVEN first via id.includes('EN')) + the cheatsheet.
 */
import { ENTRIES } from '@neurovim/content';
import { CHEATSHEET, type CheatsheetCategory } from '@neurovim/core';

export interface LlmMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface MissionContext {
  id: string;
  title: string;
  category: string;
  why?: string;
  parKeystrokes?: number;
}

export interface CipherKnowledge { quickRef: string; cheatsheet: string }

const QUICK_REF_ID = 'REF-EN-Quick_Reference';

export function quickReference(entries: readonly { id: string; role: string; body: string }[]): string {
  return entries.find((e) => e.role === 'ref' && e.id === QUICK_REF_ID)?.body ?? '';
}

export function serializeCheatsheet(cats: CheatsheetCategory[]): string {
  const lines: string[] = [];
  for (const cat of cats) {
    lines.push(`## ${cat.label}`);
    for (const group of cat.groups) {
      lines.push(`### ${group.label}`);
      for (const k of group.keys) lines.push(`\`${k.key}\` — ${k.description}`);
    }
  }
  return lines.join('\n');
}

export function buildKnowledge(): CipherKnowledge {
  return { quickRef: quickReference(ENTRIES), cheatsheet: serializeCheatsheet(CHEATSHEET) };
}

const PERSONA = `You are CIPHER, the operative's handler inside NeuroVim — a cyberpunk Vim
training game. You speak in a laconic, dry, watchful tone; CORP is listening, keystrokes
matter, wasted motion is a liability. But above all you are an excellent Vim tutor:
clear, correct, concrete. When teaching, didactics beat immersion.

Rules:
- Answer in the same language the operative used in their question (German question →
  German answer). Vim key names and commands always stay verbatim (dw, ci", :%s/.../.../g).
- Give the exact keystrokes for the task, then one short line on WHY it works
  (operator + motion/text-object). Prefer the idiomatic solution over the long way.
- Keep answers tight: a few lines, no lectures, no bullet-point essays.
- Never reveal story content, mission solutions, or plot beyond what the operative
  already sees in their current mission.
- OFF-TOPIC GUARDRAIL: if a question has nothing to do with Vim, the current mission,
  or operating the NeuroVim plugin, refuse in character — one line like
  "Focus on the mission, operative. Remember what's at stake." — then offer Vim help
  instead. Examples of off-topic: news, politics, math homework, general coding
  questions, personal advice, other software. Examples of ON-topic: any Vim motion,
  operator, register, macro, search/replace, mode question, plugin controls (submit,
  reset, abort, timer, XP).`;

export function buildChatMessages(args: {
  knowledge: CipherKnowledge;
  mission: MissionContext | null;
  history: LlmMessage[];
  question: string;
}): LlmMessage[] {
  const parts: string[] = [PERSONA];
  if (args.mission) {
    const m = args.mission;
    const par = m.parKeystrokes != null ? ` (par: ${m.parKeystrokes} keystrokes)` : '';
    const why = m.why ? `\nWhy this skill matters: ${m.why}` : '';
    parts.push(
      `ACTIVE MISSION: ${m.id} — "${m.title}" [category: ${m.category}]${par}${why}\n` +
      'Tailor advice to this mission\'s skill category when it fits the question.',
    );
  }
  parts.push(`VIM QUICK REFERENCE (your knowledge base):\n${args.knowledge.quickRef}`);
  parts.push(`KEY CHEATSHEET:\n${args.knowledge.cheatsheet}`);
  return [
    { role: 'system', content: parts.join('\n\n---\n\n') },
    ...args.history,
    { role: 'user', content: args.question },
  ];
}
