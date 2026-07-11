import { GlitchDefinition, AppliedGlitch, AppliedGlitches } from '../types';

export class GlitchEngine {
  static selectGlitches(pool: GlitchDefinition[], count: number): GlitchDefinition[] {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  static applyGlitches(originalText: string, glitches: GlitchDefinition[]): AppliedGlitches {
    const lines = originalText.split('\n');

    // Find each glitch's target line index in the original
    const withIdx = glitches
      .map(g => ({ g, idx: lines.findIndex(l => l.includes(g.target_line_pattern)) }))
      .filter(x => x.idx >= 0);

    // Apply bottom-up to avoid position drift from insertions
    withIdx.sort((a, b) => b.idx - a.idx);

    const result = [...lines];
    const applied: AppliedGlitch[] = [];

    for (const { g, idx } of withIdx) {
      switch (g.type) {
        case 'insert_corp_line': {
          const at = g.insert_after ? idx + 1 : idx;
          result.splice(at, 0, g.injected_text!);
          // Shift all previously recorded line_numbers above the insertion point
          for (const prev of applied) {
            if (prev.line_number > at) prev.line_number++;
          }
          applied.push({ definition: g, line_number: at + 1 });
          break;
        }
        case 'caps_word':
        case 'corp_word_replace': {
          result[idx] = result[idx].replace(g.target_word!, g.replacement!);
          applied.push({ definition: g, line_number: idx + 1 });
          break;
        }
        case 'tag_append': {
          result[idx] = result[idx].replace(g.target_word!, g.target_word! + g.tag!);
          applied.push({ definition: g, line_number: idx + 1 });
          break;
        }
        case 'join_lines': {
          if (idx + 1 < result.length) {
            result.splice(idx, 2, result[idx] + result[idx + 1]);
            // Shift all previously recorded line_numbers above the removed line
            for (const prev of applied) {
              if (prev.line_number > idx + 1) prev.line_number--;
            }
            applied.push({ definition: g, line_number: idx + 1 });
          }
          break;
        }
      }
    }

    return { text: result.join('\n'), glitches: applied };
  }

  static diffCount(current: string, original: string): number {
    const a = current.trim().split('\n');
    const b = original.trim().split('\n');
    const max = Math.max(a.length, b.length);
    let diff = 0;
    for (let i = 0; i < max; i++) {
      if (a[i] !== b[i]) diff++;
    }
    return diff;
  }

  static countForDifficulty(difficulty: 'easy' | 'normal' | 'hard'): number {
    return { easy: 3, normal: 7, hard: 15 }[difficulty];
  }
}
