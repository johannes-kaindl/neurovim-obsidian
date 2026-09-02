/**
 * kataPrompt — prompt assembly for generated KATA drills.
 *
 * The model never writes the exercise. It writes a *clean* text plus typed,
 * reversible corruptions; GlitchEngine derives the exercise from those. That
 * is why solvability is a property of the construction and not of the answer:
 * the solution simply *is* the clean text.
 *
 * The corollary is this file's other job — telling the model which corruptions
 * exist for the requested category. A glitch type earns its place only if its
 * inverse is a vim operation the category is meant to teach.
 */
import type { LlmMessage } from '../ports/LlmPort';
import type { GlitchDefinition } from '../types';

export type GlitchType = GlitchDefinition['type'];

/** Categories a generator can serve, and the corruptions that fit them.
 *  Read off the inverse operations the sandbox pool already records in
 *  `vim_move`: dd, ciw, f#+dw, a<Enter>. */
export const CATEGORY_GLITCHES: Record<string, GlitchType[]> = {
  navigation: ['corp_word_replace', 'caps_word'],
  'text-objects': ['caps_word', 'corp_word_replace'],
  operators: ['insert_corp_line', 'tag_append'],
  editing: ['join_lines', 'tag_append'],
  fundamentals: ['corp_word_replace', 'insert_corp_line'],
};

/** Whether a content category has an inverse vocabulary at all. `regex`,
 *  `visual-block`, `registers`, `marks-macros` and `ex-commands` do not —
 *  they are declined rather than served badly. */
export function isGeneratableCategory(category: string): boolean {
  return Object.prototype.hasOwnProperty.call(CATEGORY_GLITCHES, category);
}

export interface KataSpec {
  /** Content category — must satisfy `isGeneratableCategory`. */
  category: string;
  /** 1..5, mirrors the authored `difficulty` frontmatter. */
  difficulty: number;
  /** How many corruptions the drill should carry. */
  glitchCount: number;
  /** Optional flavour hint, e.g. "relay grid", "cargo manifest". */
  theme?: string;
}

const SYSTEM = [
  'You are CIPHER, handler in a cyberpunk spy thriller, writing a training drill',
  'for a Vim-learning game. Answer with one JSON object and nothing else — no',
  'prose before or after, no markdown fence.',
].join(' ');

/** A fully filled example per corruption type.
 *
 *  Filled, not sketched: an example carrying "…" comes back with that field
 *  missing. Measured against gemma-4-e4b, which dropped `target_line_pattern`
 *  on every glitch when the schema showed an ellipsis there. A small model
 *  copies the shape it is shown, so the shape has to be complete.
 *
 *  All examples describe the same imaginary document, so their patterns read
 *  as a coherent set rather than five unrelated fragments. */
export function glitchExample(type: GlitchType): Record<string, string | boolean> {
  switch (type) {
    case 'insert_corp_line':
      return {
        id: 'g01', type, target_line_pattern: 'Status', insert_after: true,
        injected_text: '>> CORP NOTICE: COMPLY <<',
        vim_move: 'dd', hint: 'dd — delete the CORP line',
      };
    case 'caps_word':
      return {
        id: 'g01', type, target_line_pattern: 'Status',
        target_word: 'active', replacement: 'ACTIVE',
        vim_move: 'ciw', hint: 'ciw — restore lowercase: active',
      };
    case 'corp_word_replace':
      return {
        id: 'g01', type, target_line_pattern: 'Vector',
        target_word: 'NORTH', replacement: 'NORHT',
        vim_move: 'ciw', hint: 'ciw — restore NORTH',
      };
    case 'tag_append':
      return {
        id: 'g01', type, target_line_pattern: 'Relay',
        target_word: 'ONLINE', tag: '#CORP',
        vim_move: 'dw', hint: 'f# then dw — delete the CORP tag',
      };
    case 'join_lines':
      return {
        id: 'g01', type, target_line_pattern: 'Payload:',
        vim_move: 'a<Enter>', hint: 'after the comma — a<Enter> to split',
      };
  }
}

export function buildKataMessages(spec: KataSpec): LlmMessage[] {
  const allowed = CATEGORY_GLITCHES[spec.category] ?? [];
  const theme = spec.theme ? `Theme: ${spec.theme}.` : 'Pick a fitting in-world theme yourself.';

  const user = [
    `Write a KATA drill. Category: ${spec.category}. Difficulty: ${spec.difficulty} of 5.`,
    theme,
    '',
    'targetText is the CLEAN, repaired document — 8 to 16 short lines of in-world',
    'material (a relay grid, a manifest, a log). Plain text, no markdown headings.',
    '',
    `Then describe exactly ${spec.glitchCount} corruptions of it. Every`,
    'target_line_pattern and target_word MUST appear verbatim in targetText —',
    'a pattern that does not match is a discarded corruption and fails the drill.',
    '',
    `Allowed corruption types for this category (use only these): ${allowed.join(', ')}.`,
    'Copy these shapes exactly — every key shown is required, ids count up g01, g02, …:',
    ...allowed.map(t => `  ${JSON.stringify(glitchExample(t))}`),
    '',
    'Answer shape:',
    '{',
    '  "title": "two or three words, in-world",',
    '  "summary": "one sentence, what the operator practises",',
    '  "why": "one sentence in CIPHER\'s voice on why the skill matters",',
    '  "tags": ["vim/…", "vim/…"],',
    '  "targetText": "line\\nline\\n…",',
    `  "glitches": [ ${allowed.map(t => JSON.stringify(glitchExample(t))).join(', ')} ]`,
    '}',
  ].join('\n');

  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ];
}
