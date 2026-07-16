/**
 * Pure logic of the endpoint row editor — Obsidian-/DOM-free and node-testable, so the
 * render layer in SettingsTab stays thin. Third instance of the ecosystem's endpoint-list
 * editor pattern (vault-rag, vault-crews) — kept close to vault-crews' model on purpose.
 */
import type { EndpointStatusKind } from '../vendor/kit/endpoint_diagnostics';

/** Applies one row edit to the endpoint list.
 *  - trims the value;
 *  - `isAdder` (the trailing blank row) appends a non-empty value; an empty one is a no-op;
 *  - an existing row cleared out is removed, otherwise replaced in place;
 *  - blanks are filtered at the end — a blank entry is never persisted. */
export function applyEndpointEdit(list: string[], index: number, value: string, isAdder: boolean): string[] {
  const v = value.trim();
  let next: string[];
  if (isAdder) {
    next = v ? [...list, v] : [...list];
  } else {
    next = [...list];
    if (v) next[index] = v;
    else next.splice(index, 1);
  }
  return next.filter((e) => e.trim().length > 0);
}

/** Index of the first row with status `ok` (= the active endpoint, exactly
 *  resolveActiveEndpoint's semantics: first reachable wins), else -1.
 *  `null` = not probed yet. */
export function activeIndexFromStatuses(statuses: (EndpointStatusKind | null)[]): number {
  return statuses.findIndex((s) => s === 'ok');
}
