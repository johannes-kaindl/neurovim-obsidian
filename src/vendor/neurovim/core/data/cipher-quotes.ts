export type QuoteEvent = 'success' | 'fast' | 'slow' | 'perfect_ks' | 'wrong_answer' | 'drill' | 'level_up' | 'streak' | 'guide_why';

const QUOTES: Record<string, Record<string, string[]>> = {
  fundamentals: {
    success: [
      "The tool responded. That's all that mattered.",
      'Clean. You understood the difference between modes.',
      'Most people fight the tool. You used it.',
      'Signal restored. NEXUS has updated your record.',
      'Normal, Insert, Escape. You have all three now.',
    ],
    fast: [
      'Faster than last time. The muscle is forming.',
      "That's what it feels like when it becomes reflex.",
    ],
    slow: [
      'It was correct. Speed comes later.',
      'Correct is more important than fast. For now.',
    ],
    guide_why: ['Modes are the spine of everything you touch. Fight them and the tool fights back.'],
  },
  navigation: {
    success: [
      'Precise. Character by character, line by line.',
      'You moved through the file like you owned it.',
      'Navigation is thought made visible. Good thinking.',
      'hjkl. Four keys. Infinite territory.',
    ],
    fast: [
      "You didn't hesitate. That's different from being fast.",
      "The cursor went where you looked. That's the goal.",
    ],
    guide_why: ['Move without the mouse or you will never keep pace with CORP.'],
  },
  'word-movement': {
    success: [
      "Word by word. That's the right unit for this work.",
      "w and b aren't shortcuts. They're the correct resolution.",
      'You moved at the level of meaning, not characters.',
    ],
    fast: ['w is faster than l because it should be.'],
  },
  operators: {
    success: [
      'd, c, y. The three verbs. Everything else is grammar.',
      'You deleted what needed deleting. Nothing more.',
      "Operators compose. You're starting to see it.",
      'CORP injected six lines. You removed six lines. Clean ratio.',
    ],
    fast: [
      'Efficient. The tool obeys you now.',
      "That's not speed. That's knowing exactly what to do.",
    ],
    perfect_ks: [
      'Minimum keystrokes. Maximum result. That\'s Vim.',
      "Less is the point. You're getting it.",
    ],
  },
  'text-objects': {
    success: [
      'ci". Two keystrokes to replace any quoted value. Remember that.',
      'The brackets are the map. You read the map.',
      "Text objects aren't shortcuts. They're the correct vocabulary.",
      'Inside or around — you chose correctly.',
    ],
    fast: ['You went straight to the container. No wandering.'],
  },
  'search-replace': {
    success: [
      ':%s — the most powerful line in any file. Use it wisely.',
      'Systematic corruption requires systematic counter. Good.',
      "Thirty-one replacements, one command. That's leverage.",
      "CORP bets on your impatience. You proved them wrong.",
    ],
    fast: ["You saw the pattern before you moved. That's the key."],
  },
  combined: {
    success: [
      'The poem is restored. Ren Voss typed it in 2041. You restored it in 2047.',
      'Every Nevermore you recovered is the same word.',
      'Field Training complete. What comes next is no longer training.',
      'WRAITH sends confirmation. Handoff can proceed.',
    ],
    fast: ['Ghost-level. WRAITH has noted your time.'],
    perfect_ks: ["That's how THE RAVEN would have done it."],
  },
  registers: {
    success: [
      'The register held it. You knew where to look.',
      '"a through "z. Named memory. Use it deliberately.',
      "You moved data without losing it. That's the register's purpose.",
      'CORP data extracted. Registers kept it clean.',
    ],
    fast: ['No buffer fumbling. The register was ready.'],
    perfect_ks: ['"ayy "ap. Two commands. Zero waste.'],
  },
  case: {
    success: [
      'gU, gu, ~. Case is just another dimension of the text.',
      'The cipher required uppercase. You delivered uppercase.',
      'You changed the case without changing the word. Precise.',
      'CORP encodes in caps. You decode with motion.',
    ],
    fast: ["That's fast. gU doesn't require much — but it requires precision."],
  },
  'visual-block': {
    success: [
      'V then d. Select the noise. Remove the noise.',
      'Visual mode is surgical. You used it that way.',
      'Three null lines. Three keystrokes. Clean ratio.',
      'The selection was exact. The deletion was exact.',
    ],
    fast: ['You knew what to select before you selected it. Good.'],
    perfect_ks: ['Select once. Delete once. Done.'],
  },
  'marks-macros': {
    success: [
      'Record once. Replay twelve times. That\'s the leverage.',
      'A macro is a commitment. You committed correctly.',
      "Marks and macros. The operative's memory.",
      'You decoded a CORP internal document. Let that settle.',
    ],
    fast: ['The macro ran clean. No hesitation in the recording.'],
    wrong_answer: [
      'Not yet. Look at where it diverges.',
      "Close. The pattern is consistent — check your macro.",
      'One line off. Find it.',
      "The diff doesn't lie. Trust the diff.",
    ],
  },
  'pane-nav': {
    success: [
      'Ctrl+W. The window moves, not the text.',
      'You navigated the workspace without touching the mouse.',
      'Split. Navigate. Close. All from the home row.',
    ],
    fast: ['The pane switch was instant. That means it was already muscle memory.'],
  },
  'ex-commands': {
    success: [
      ':g/pattern/d — one command, every matching line gone.',
      'Global commands are leverage. You used leverage.',
      'The file has no hiding place from :g.',
      'Ex mode is the command line inside the editor. Use both.',
    ],
    fast: ['You typed the command once. The file obeyed every line.'],
  },
  regex: {
    success: [
      'The pattern matched. That means you understood the structure.',
      "\\v for very magic. Less escaping, more thinking.",
      'A regex that works is a small proof of understanding.',
      'CORP data is patterned. Patterns are tractable.',
      'Every substitution is a claim about structure. Yours was correct.',
      "The document doesn't know you're watching. That's the advantage.",
      'Pattern recognition is the skill under the skill.',
    ],
    fast: [
      "You wrote it right the first time. That's the hard part of regex.",
      'No iteration. The pattern was clear in your head before you typed it.',
      'Speed here means you saw the shape of the data. Not the characters.',
    ],
    perfect_ks: [
      'One pass. The entire file. That is what regex is for.',
      'Minimum expression, maximum reach.',
    ],
    wrong_answer: [
      'The pattern missed something. Check your anchors.',
      'Close. One character class is wrong.',
      'The regex is right. The range might not be.',
      "The diff tells you exactly where it failed. Trust the diff.",
      'A regex that almost works is a hypothesis. Test it again.',
    ],
    drill: [
      'Run it again. The command should be automatic.',
      'The pattern you know is the pattern you reach for under pressure.',
    ],
  },
  universal: {
    success: [
      'Transmission restored.',
      'Signal clean.',
      'NEXUS confirms receipt.',
      'The file is what it should be.',
    ],
    streak: [
      'Consecutive sessions. The muscle remembers.',
      'Back again. Good.',
      'Consistency is the skill underneath the skill.',
    ],
    drill: [
      'Again.',
      'Repetition is the only teacher.',
      'The goal is to stop thinking about it.',
      "When it becomes reflex, you'll know.",
    ],
    level_up: [
      'New clearance. New files. The work gets harder from here.',
      'NEXUS has updated your designation.',
      "You've earned the next tier. Don't mistake that for safety.",
    ],
    wrong_answer: [
      'Not yet. Look at where it diverges.',
      "The diff doesn't lie. Trust the diff.",
      'One character. Find it.',
    ],
    guide_why: ['Master the tool. The story needs operatives who can.'],
  },
};

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getCipherQuote(
  category: string,
  event: QuoteEvent,
  drillMode = false
): string {
  if (drillMode && event === 'success') {
    const drills = QUOTES.universal?.drill;
    if (drills) return pick(drills);
  }
  const catQuotes = QUOTES[category]?.[event] ?? QUOTES.universal?.[event];
  if (catQuotes && catQuotes.length > 0) return pick(catQuotes);
  const fallback = QUOTES.universal?.success;
  return fallback ? pick(fallback) : 'Signal clean.';
}

/**
 * Deterministic per-category "why this skill matters" line — the fallback used by
 * GuidanceEngine when a mission has no authored `why:`. Index 0 (not random) so guidance
 * derivation stays pure/testable.
 */
export function guideWhyFor(category: string | null): string {
  const cat = category ?? 'universal';
  return (
    QUOTES[cat]?.guide_why?.[0] ??
    QUOTES.universal.guide_why?.[0] ??
    'Master the tool. The story needs operatives who can.'
  );
}
