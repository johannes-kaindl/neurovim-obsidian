import { slugify } from './vendor/kit/slug';

/** Filesystem-/vault-safe slug: "M-01" + "The Three Modes" → "M-01-The-Three-Modes".
 *  `transliterate: false` keeps the throwaway note names exactly as before ("Größe" → "Gr-e"). */
export function missionNoteSlug(id: string, title: string): string {
  const clean = (s: string) => slugify(s, { keepCase: true, transliterate: false });
  const base = clean(id);
  const t = clean(title);
  return t ? `${base}-${t}` : base;
}

/** Full vault-relative note path for a mission's throwaway working copy. */
export function missionNotePath(folder: string, id: string, title: string): string {
  const dir = folder.replace(/\/+$/, '');
  const slug = missionNoteSlug(id, title);
  return `${dir}/${slug}.md`.replace(/\/+/g, '/').replace(/^\//, '');
}
