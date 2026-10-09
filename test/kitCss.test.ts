import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { findVendoredCss, missingKitCss } from './vendor/kit/kit-css';

// Kit contract: the `*_CSS` constants of the vendored building blocks belong in styles.css word
// for word — only the behaviour is vendored, the look is a copy.
describe('vendored kit CSS', () => {
  it('finds the constants, and styles.css carries every one of them unchanged', () => {
    const vendorDir = 'src/vendor/kit-obsidian';
    expect(findVendoredCss(vendorDir).length).toBeGreaterThan(0);
    expect(missingKitCss(vendorDir, readFileSync('styles.css', 'utf8'))).toEqual([]);
  });
});
