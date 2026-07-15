import { describe, it, expect } from 'vitest';
import { filterCheatsheet } from '../src/filterCheatsheet';
import type { CheatsheetCategory } from '@neurovim/core';

const CATS: CheatsheetCategory[] = [
  {
    id: 'fundamentals', label: 'FUNDAMENTALS',
    groups: [
      { label: 'MODES', keys: [{ key: 'i', description: 'insert before cursor' }, { key: 'ESC', description: 'back to normal' }] },
    ],
  },
  {
    id: 'navigation', label: 'NAVIGATION',
    groups: [{ label: 'MOTIONS', keys: [{ key: 'w', description: 'next word' }] }],
  },
];

describe('filterCheatsheet', () => {
  it('returns everything for an empty/whitespace query', () => {
    expect(filterCheatsheet(CATS, '')).toEqual(CATS);
    expect(filterCheatsheet(CATS, '   ')).toEqual(CATS);
  });
  it('matches on key and description, case-insensitively', () => {
    const byKey = filterCheatsheet(CATS, 'ESC');
    expect(byKey[0].groups[0].keys).toEqual([{ key: 'ESC', description: 'back to normal' }]);
    const byDesc = filterCheatsheet(CATS, 'WORD');
    expect(byDesc).toHaveLength(1);
    expect(byDesc[0].id).toBe('navigation');
  });
  it('drops empty groups and categories', () => {
    const r = filterCheatsheet(CATS, 'insert');
    expect(r).toHaveLength(1);
    expect(r[0].groups).toHaveLength(1);
    expect(r[0].groups[0].keys).toHaveLength(1);
  });
});
