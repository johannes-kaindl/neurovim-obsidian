/**
 * Frontmatter coercion helpers.
 *
 * Generated manifest entries carry `frontmatter: Record<string, unknown>` — YAML can put
 * anything in there, including maps and lists. `String(v)` on those yields the useless
 * '[object Object]' and silently ships it into the UI, so coerce only the primitives YAML
 * can legitimately produce for a scalar field and fall back otherwise.
 */

/** Coerce a frontmatter value to a string; non-scalars (and null/undefined) use `fallback`. */
export function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}
