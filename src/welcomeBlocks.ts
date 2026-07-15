/** Minimal, dependency-free parsing of the bundled welcome markdown into render
 *  blocks. Deliberately NOT MarkdownRenderer: the pane's CRT scheme wants full
 *  color control, and the welcome only uses headings, one quote callout, and
 *  paragraphs. Headings drop (the pane has its own title), `> [!…]`-type lines
 *  drop, `**` bold markers are stripped. */
export type WelcomeBlock = { kind: 'quote'; lines: string[] } | { kind: 'para'; text: string };

export function parseWelcomeBlocks(md: string): WelcomeBlock[] {
  const blocks: WelcomeBlock[] = [];
  for (const chunk of md.split(/\n\s*\n/)) {
    const trimmed = chunk.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('>')) {
      const lines = trimmed
        .split('\n')
        .map((l) => l.replace(/^>\s?/, '').trim())
        .filter((l) => l !== '' && !l.startsWith('[!'))
        .map((l) => l.replace(/\*\*/g, ''));
      if (lines.length) blocks.push({ kind: 'quote', lines });
    } else {
      blocks.push({ kind: 'para', text: trimmed.split('\n').map((l) => l.trim()).join(' ').replace(/\*\*/g, '') });
    }
  }
  return blocks;
}
