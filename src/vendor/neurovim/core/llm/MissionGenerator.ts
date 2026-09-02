/**
 * MissionGenerator — the second consumer of LlmPort, and the first at a
 * non-chat call site.
 *
 * It does not ask a model for an exercise. It asks for a *clean* document plus
 * typed corruptions, then lets GlitchEngine derive the exercise from those. So
 * the solution is the clean text by identity, not by inspection, and the drill
 * cannot be presolved or underivable the way three waves of hand-written
 * missions were (2026-06-10, 2026-07-24, 2026-07-29).
 *
 * One hole remains open by construction, and it is guarded here rather than in
 * the engine: `applyGlitches` silently drops any corruption whose
 * `target_line_pattern` is absent from the text. A model that hallucinates one
 * pattern ships a drill with fewer corruptions than announced — in the limit, a
 * presolved one. `glitch-miss` is that guard.
 *
 * No retry lives here. The caller decides: an author wants to see what went
 * wrong, a runtime would silently roll again.
 */
import { GlitchEngine } from '../engine/GlitchEngine';
import type { GlitchDefinition, MissionFrontmatter } from '../types';
import type { LlmPort } from '../ports/LlmPort';
import {
  buildKataMessages, CATEGORY_GLITCHES, isGeneratableCategory, type GlitchType, type KataSpec,
} from './kataPrompt';

/** Stamped into every generated draft's frontmatter. Bump with the contract. */
export const GENERATOR_ID = 'MissionGenerator/1';

export interface KataFrontmatter extends MissionFrontmatter {
  tags: string[];
  sticker: string;
  color: string;
  completed: boolean;
  generated_by: string;
}

export interface GeneratedKata {
  frontmatter: KataFrontmatter;
  /** The corrupted document the operator starts from. */
  transmission: string;
  /** The repaired document — identical to the model's clean text. */
  solution: string;
  /** The corruptions that actually landed, with their inverse vim keys. */
  glitches: GlitchDefinition[];
}

export type GenerationFailure =
  /** The port reported a failure; its kind is in `detail`. */
  | 'llm'
  /** The answer held no JSON object at all. */
  | 'unparseable'
  /** JSON, but not the shape the prompt asked for. */
  | 'schema'
  /** The category has no inverse vocabulary — declined before spending a call. */
  | 'unsupported-category'
  /** A corruption whose inverse does not belong to the category. */
  | 'skill-mismatch'
  /** A corruption that does not do what its own type promises. */
  | 'glitch-shape'
  /** A corruption did not land — a hallucinated pattern. See the file header. */
  | 'glitch-miss'
  /** The corruptions left the text unchanged: an instantly-won drill. */
  | 'presolved';

export type GenerationResult =
  | { ok: true; kata: GeneratedKata }
  | { ok: false; reason: GenerationFailure; detail: string };

const fail = (reason: GenerationFailure, detail: string): GenerationResult =>
  ({ ok: false, reason, detail });

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Find the JSON object in an answer that may carry prose, a markdown fence or
 *  a reasoning model's narration around it.
 *
 *  Not "first { to last }": a model that *talks about* JSON writes braces in
 *  its prose, and that cut then spans two unrelated objects. Instead every
 *  brace is tried as a start, the balanced span from it is parsed, and the
 *  longest one that actually parses wins — the answer is reliably longer than
 *  anything the narration sketches. */
function extractJson(content: string): unknown {
  let best: unknown = null;
  let bestLen = 0;

  for (let i = 0; i < content.length; i++) {
    if (content[i] !== '{') continue;
    const span = balancedSpan(content, i);
    if (span === null || span.length <= bestLen) continue;
    try {
      const parsed: unknown = JSON.parse(span);
      if (typeof parsed === 'object' && parsed !== null) {
        best = parsed;
        bestLen = span.length;
      }
    } catch {
      /* not this one */
    }
  }
  return best;
}

/** The substring from `start` to its matching brace, string- and escape-aware,
 *  or null if it never closes. */
function balancedSpan(s: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

interface RawAnswer {
  title: string; summary: string; why: string;
  tags: string[]; targetText: string; glitches: GlitchDefinition[];
}

function checkShape(v: unknown): string | null {
  if (typeof v !== 'object' || v === null) return 'not an object';
  const a = v as Record<string, unknown>;
  for (const key of ['title', 'summary', 'why', 'targetText'] as const) {
    if (!isStr(a[key])) return `missing or empty: ${key}`;
  }
  if (!Array.isArray(a.tags) || !a.tags.every(isStr)) return 'tags must be a string array';
  if (!Array.isArray(a.glitches) || a.glitches.length === 0) return 'glitches must be a non-empty array';
  for (const g of a.glitches as Record<string, unknown>[]) {
    for (const key of ['id', 'type', 'target_line_pattern', 'vim_move', 'hint'] as const) {
      if (!isStr(g[key])) return `glitch ${String(g.id)}: missing ${key}`;
    }
    if (!KNOWN_TYPES.has(g.type as string)) return `unknown glitch type: ${String(g.type)}`;
  }
  return null;
}

/** Whether a corruption does what its type claims — the difference between a
 *  derivable drill and one that teaches the promised key.
 *
 *  Derivability is guaranteed by construction; this is not. A `caps_word` that
 *  also appends punctuation still diffs cleanly against the solution, but `ciw`
 *  no longer repairs it, so the drill quietly breaks its own skill claim. Seen
 *  on the very first generated draft: INITIATED!. for initiated. */
function checkGlitchShape(g: GlitchDefinition): string | null {
  // `iw` covers a run of word characters and stops at anything else, so an
  // apostrophe or hyphen turns one word into two objects and ciw no longer
  // finishes the repair. Measured on CNFIRM'D for confirmed.
  const oneWord = (v: string) => /^\w+$/.test(v);

  switch (g.type) {
    case 'caps_word':
      if (!isStr(g.target_word) || !isStr(g.replacement)) return `${g.id}: caps_word needs target_word and replacement`;
      if (!oneWord(g.target_word) || !oneWord(g.replacement)) {
        return `${g.id}: "${g.target_word}" is not a single word-character run — ciw would not cover it`;
      }
      if (g.replacement !== g.target_word.toUpperCase()) {
        return `${g.id}: caps_word replacement "${g.replacement}" is not "${g.target_word}" upper-cased — ciw would not repair it`;
      }
      return null;
    case 'corp_word_replace':
      if (!isStr(g.target_word) || !isStr(g.replacement)) return `${g.id}: corp_word_replace needs target_word and replacement`;
      if (!oneWord(g.target_word) || !oneWord(g.replacement)) {
        return `${g.id}: "${g.replacement}" is not a single word-character run — ciw would not cover it`;
      }
      return null;
    case 'tag_append':
      if (!isStr(g.target_word) || !isStr(g.tag)) return `${g.id}: tag_append needs target_word and tag`;
      if (/\s/.test(g.tag)) return `${g.id}: tag "${g.tag}" contains whitespace`;
      return null;
    case 'insert_corp_line':
      if (!isStr(g.injected_text)) return `${g.id}: insert_corp_line needs injected_text`;
      if (g.injected_text.includes('\n')) return `${g.id}: injected_text spans several lines — one dd would not clear it`;
      return null;
    case 'join_lines':
      return null;
  }
}

const KNOWN_TYPES = new Set<string>(
  Object.values(CATEGORY_GLITCHES).flat(),
);

export class MissionGenerator {
  constructor(private readonly llm: LlmPort) {}

  async generate(spec: KataSpec, missionId: string): Promise<GenerationResult> {
    if (!isGeneratableCategory(spec.category)) {
      return fail('unsupported-category',
        `${spec.category} has no reversible glitch vocabulary — authored content only`);
    }

    const res = await this.llm.complete(buildKataMessages(spec));
    if (!res.ok) return fail('llm', `${res.kind}: ${res.detail}`);

    const parsed = extractJson(res.content);
    if (parsed === null) return fail('unparseable', 'no JSON object in the answer');

    const problem = checkShape(parsed);
    if (problem) return fail('schema', problem);
    const answer = parsed as unknown as RawAnswer;

    const allowed: GlitchType[] = CATEGORY_GLITCHES[spec.category];
    const stray = answer.glitches.find(g => !allowed.includes(g.type));
    if (stray) {
      return fail('skill-mismatch',
        `${stray.type} does not practise ${spec.category} (allowed: ${allowed.join(', ')})`);
    }

    for (const g of answer.glitches) {
      const malformed = checkGlitchShape(g);
      if (malformed) return fail('glitch-shape', malformed);
    }

    // Applied one at a time, because an application is not an effect: a glitch
    // whose pattern matches a line that does not contain its target_word makes
    // String.replace a no-op, and applyGlitches still records it as applied.
    // Counting effects is what keeps the announced count honest.
    for (const g of answer.glitches) {
      const solo = GlitchEngine.applyGlitches(answer.targetText, [g]);
      if (solo.glitches.length === 0) {
        return fail('glitch-miss', `${g.id}: pattern "${g.target_line_pattern}" is not in targetText`);
      }
      if (solo.text === answer.targetText) {
        return fail('glitch-miss',
          `${g.id}: matched a line but changed nothing — "${g.target_word ?? g.target_line_pattern}" is not on it`);
      }
    }

    const { text } = GlitchEngine.applyGlitches(answer.targetText, answer.glitches);
    // Last-resort assertion. The per-glitch effect check above now precedes it
    // and, in practice, subsumes it: a second glitch that would undo a first
    // one targets an intermediate string absent from the original, so it fails
    // the effect check on its own. Kept because it costs one comparison and is
    // the only thing left standing if that reasoning is ever wrong.
    if (text === answer.targetText) {
      return fail('presolved', 'corruptions left the document unchanged');
    }

    return {
      ok: true,
      kata: {
        frontmatter: {
          mission_id: missionId,
          title: answer.title,
          tier: '⬛ KATA',
          xp_reward: spec.difficulty >= 3 ? 15 : 10,
          completed: false,
          difficulty: spec.difficulty,
          category: spec.category,
          tags: answer.tags,
          sticker: 'lucide//zap',
          color: '#444444',
          summary: answer.summary,
          why: answer.why,
          mission_type: 'practice',
          locked: false,
          generated_by: GENERATOR_ID,
        },
        transmission: text,
        solution: answer.targetText,
        glitches: answer.glitches,
      },
    };
  }
}

/** YAML-safe double quoting for free-text fields. */
const q = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Render a generated drill as a content-shaped markdown file. The solution is
 *  written separately and carries no frontmatter, matching `src/solutions/`. */
export function renderKataMarkdown(kata: GeneratedKata): string {
  const fm = kata.frontmatter;
  const lines = [
    '---',
    `mission_id: ${fm.mission_id}`,
    `title: ${q(fm.title)}`,
    `tier: ${q(fm.tier)}`,
    `xp_reward: ${fm.xp_reward}`,
    `completed: ${fm.completed}`,
    `difficulty: ${fm.difficulty}`,
    `category: ${fm.category}`,
    'tags:',
    ...fm.tags.map(t => `  - ${t}`),
    `sticker: ${fm.sticker}`,
    `color: ${q(fm.color)}`,
    `summary: ${q(fm.summary ?? '')}`,
    `why: ${q(fm.why ?? '')}`,
    `mission_type: ${fm.mission_type}`,
    `locked: ${fm.locked}`,
    `generated_by: ${fm.generated_by}`,
    '---',
    '',
    kata.transmission,
    '',
  ];
  return lines.join('\n');
}
