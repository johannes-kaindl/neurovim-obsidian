/** One run of an objective step: plain text, or an exact string the player must type or find. */
export interface ObjectiveSegment {
  code: boolean;
  text: string;
}

/**
 * Split an objective step on backtick spans. Exact target strings are written in backticks
 * so the HUD can set them apart from the prose — the part the player must match character
 * for character. Pure and markup-free, so every host renders it its own way (Preact in the
 * web app, DOM helpers in Obsidian) without an HTML parser. An unmatched backtick stays text.
 */
export function splitInlineCode(step: string): ObjectiveSegment[] {
  const out: ObjectiveSegment[] = [];
  const re = /`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(step)) !== null) {
    if (m.index > last) out.push({ code: false, text: step.slice(last, m.index) });
    out.push({ code: true, text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < step.length) out.push({ code: false, text: step.slice(last) });
  return out;
}
