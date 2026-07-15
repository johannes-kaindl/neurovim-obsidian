import { describe, it, expect } from 'vitest';
import { parseWelcomeBlocks } from '../src/welcomeBlocks';
import { getWelcome } from '@neurovim/content';

describe('parseWelcomeBlocks', () => {
  it('drops headings, groups quote lines, keeps paragraphs', () => {
    const md = '# TITLE\n\n> [!quote] CIPHER\n> Line one.\n> **Bold line.**\n\nPara text\nover two lines.';
    expect(parseWelcomeBlocks(md)).toEqual([
      { kind: 'quote', lines: ['Line one.', 'Bold line.'] },
      { kind: 'para', text: 'Para text over two lines.' },
    ]);
  });
  it('parses the real bundled welcome into a quote and at least one paragraph', () => {
    const blocks = parseWelcomeBlocks(getWelcome());
    expect(blocks[0].kind).toBe('quote');
    expect(blocks.some((b) => b.kind === 'para')).toBe(true);
  });
});
