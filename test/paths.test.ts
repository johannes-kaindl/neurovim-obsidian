import { describe, it, expect } from 'vitest';
import { missionNoteSlug, missionNotePath } from '../src/paths';

describe('paths', () => {
  it('builds a filesystem-safe slug from id + title', () => {
    expect(missionNoteSlug('M-01', 'The Three Modes')).toBe('M-01-The-Three-Modes');
  });
  it('strips unsafe characters', () => {
    expect(missionNoteSlug('R-24', 'Project: Mirror/Shift')).toBe('R-24-Project-Mirror-Shift');
  });
  it('joins folder + slug + .md, normalizing slashes', () => {
    expect(missionNotePath('NeuroVim/', 'M-01', 'The Three Modes')).toBe('NeuroVim/M-01-The-Three-Modes.md');
  });
});
