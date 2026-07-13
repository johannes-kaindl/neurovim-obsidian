import { describe, it, expect } from 'vitest';
import { stripTransmissionLink } from '../src/briefing/briefingText';

describe('stripTransmissionLink', () => {
  it('removes the trailing transmission CTA line and dangling callout markers', () => {
    const md = [
      '> [!abstract] DIRECTIVE',
      '> Restore the document.',
      '>',
      '> → **[[M-01-TRANSMISSION|The Three Modes]]** — open to begin. Timer starts on file open.',
    ].join('\n');
    expect(stripTransmissionLink(md)).toBe(
      ['> [!abstract] DIRECTIVE', '> Restore the document.'].join('\n'),
    );
  });

  it('leaves briefings without a CTA line unchanged', () => {
    const md = '> [!quote] CIPHER\n> Use Vim.';
    expect(stripTransmissionLink(md)).toBe(md);
  });

  it('keeps story prose that uses an arrow but no wikilink', () => {
    const md = 'Normal → Insert → Escape. That is the loop.';
    expect(stripTransmissionLink(md)).toBe(md);
  });
});
