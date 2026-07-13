/**
 * Remove the trailing "→ [[…TRANSMISSION…]] — open to begin" CTA line from a briefing body.
 * The BriefingModal's "Mission beginnen" button replaces it, so the wikilink would be a dead
 * link. Highly specific (an arrow marker AND a wikilink); story prose won't match.
 */
export function stripTransmissionLink(md: string): string {
  const lines = md.split('\n');
  const kept = lines.filter((line) => !(/→/.test(line) && /\[\[.+\]\]/.test(line)));
  // Trim trailing blank / callout-empty (">", "> ") lines left behind.
  while (kept.length && /^\s*>?\s*$/.test(kept[kept.length - 1])) kept.pop();
  return kept.join('\n');
}
