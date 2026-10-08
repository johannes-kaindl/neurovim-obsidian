import { describe, it, expect } from 'vitest';
import { getDiff } from '@neurovim/core';
import { countMatchingLines, markLineDelta, shouldShowPausedBanner } from '../src/missionProgress';

describe('countMatchingLines', () => {
  it('counts every line when the note equals the solution', () => {
    expect(countMatchingLines('a\nb\nc', 'a\nb\nc')).toEqual({ matched: 3, total: 3 });
  });

  it('counts only positionally matching lines', () => {
    expect(countMatchingLines('a\nX\nc', 'a\nb\nc')).toEqual({ matched: 2, total: 3 });
  });

  it('measures against the solution length when lines are missing', () => {
    expect(countMatchingLines('a\nb', 'a\nb\nc\nd')).toEqual({ matched: 2, total: 4 });
  });

  it('ignores surplus lines beyond the solution', () => {
    expect(countMatchingLines('a\nb\nc\nd', 'a\nb')).toEqual({ matched: 2, total: 2 });
  });

  it('trims like getDiff so counter and submit never disagree', () => {
    expect(countMatchingLines('\n\na\nb\n\n', 'a\nb')).toEqual({ matched: 2, total: 2 });
  });

  it('ignores frontmatter a vault plugin added above the text', () => {
    const note = '---\ntitle: M-01\ncreated: 2026-10-08\nupdated: 2026-10-08\n---\n\na\nb\nc';
    expect(countMatchingLines(note, 'a\nb\nc')).toEqual({ matched: 3, total: 3 });
  });

  it('ignores trailing whitespace on either side', () => {
    expect(countMatchingLines('a\nb\nc', 'a  \nb\t\nc ')).toEqual({ matched: 3, total: 3 });
    expect(countMatchingLines('a \nb  \nc', 'a\nb\nc')).toEqual({ matched: 3, total: 3 });
  });

  it('agrees with the core check on a Linter-touched note', () => {
    const note = '---\ntitle: x\n---\nalpha\nbeta  \ngamma\n';
    const solution = 'alpha \nbeta\ngamma';
    expect(countMatchingLines(note, solution)).toEqual({ matched: 3, total: 3 });
    expect(getDiff(note, solution).matches).toBe(true);
  });

  it('keeps a lone leading rule as scored content', () => {
    expect(countMatchingLines('---\na', 'a')).toEqual({ matched: 0, total: 1 });
  });
});

describe('markLineDelta', () => {
  it('marks a substitution in the middle', () => {
    const r = markLineDelta('Emergency exit: Roof access point Charlie',
                            'Emergency exfil: Roof access point Charlie');
    expect(r.has).toBe('Emergency ex»it«: Roof access point Charlie');
    expect(r.want).toBe('Emergency ex»fil«: Roof access point Charlie');
  });

  it('marks a difference at the start', () => {
    const r = markLineDelta('Xbc', 'abc');
    expect(r.has).toBe('»X«bc');
    expect(r.want).toBe('»a«bc');
  });

  it('marks a difference at the end', () => {
    const r = markLineDelta('abX', 'abc');
    expect(r.has).toBe('ab»X«');
    expect(r.want).toBe('ab»c«');
  });

  it('shows where a pure insertion belongs with an empty pair', () => {
    const r = markLineDelta('abc', 'abXc');
    expect(r.has).toBe('ab»«c');
    expect(r.want).toBe('ab»X«c');
  });

  it('shows where a pure deletion happened', () => {
    const r = markLineDelta('abXc', 'abc');
    expect(r.has).toBe('ab»X«c');
    expect(r.want).toBe('ab»«c');
  });

  it('returns identical lines untouched', () => {
    const r = markLineDelta('abc', 'abc');
    expect(r).toEqual({ has: 'abc', want: 'abc' });
  });

  it('handles an empty current line', () => {
    const r = markLineDelta('', 'abc');
    expect(r.has).toBe('»«');
    expect(r.want).toBe('»abc«');
  });
});

describe('shouldShowPausedBanner', () => {
  it('stays hidden below the threshold', () => {
    expect(shouldShowPausedBanner(4 * 60_000, 5)).toBe(false);
  });

  it('shows at and above the threshold', () => {
    expect(shouldShowPausedBanner(5 * 60_000, 5)).toBe(true);
    expect(shouldShowPausedBanner(9 * 60_000, 5)).toBe(true);
  });

  it('is disabled by a threshold of zero or less', () => {
    expect(shouldShowPausedBanner(60 * 60_000, 0)).toBe(false);
    expect(shouldShowPausedBanner(60 * 60_000, -1)).toBe(false);
  });
});
