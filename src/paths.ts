/** Filesystem-/vault-safe slug: "M-01" + "The Three Modes" → "M-01-The-Three-Modes". */
export function missionNoteSlug(id: string, title: string): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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
