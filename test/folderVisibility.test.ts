import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { applyFolderVisibility, removeFolderVisibility } from '../src/obsidian/folder-visibility';

/** Minimal stand-ins for the two DOM primitives the module needs — vitest runs in the
 *  `node` environment, where neither Document nor CSSStyleSheet exists globally. */
class FakeCSSStyleSheet {
  cssText = '';
  replaceSync(css: string): void { this.cssText = css; }
}

function makeFakeDoc(): Document {
  return { adoptedStyleSheets: [] as unknown[] } as unknown as Document;
}

describe('applyFolderVisibility', () => {
  const originalCSSStyleSheet = globalThis.CSSStyleSheet;
  const originalCssEscape = globalThis.CSS;

  beforeEach(() => {
    (globalThis as { CSSStyleSheet?: unknown }).CSSStyleSheet = FakeCSSStyleSheet;
    (globalThis as { CSS?: unknown }).CSS = { escape: (s: string) => s.replace(/"/g, '\\"') };
  });

  afterEach(() => {
    removeFolderVisibility();
    (globalThis as { CSSStyleSheet?: unknown }).CSSStyleSheet = originalCSSStyleSheet;
    (globalThis as { CSS?: unknown }).CSS = originalCssEscape;
  });

  it('adopts a stylesheet hiding the given folder when hidden=true', () => {
    const doc = makeFakeDoc();
    applyFolderVisibility(doc, '_neurovim', true);
    expect(doc.adoptedStyleSheets).toHaveLength(1);
    const sheet = doc.adoptedStyleSheets[0] as FakeCSSStyleSheet;
    expect(sheet.cssText).toBe('.nav-folder-title[data-path="_neurovim"] { display: none; }');
  });

  it('does nothing when hidden=false', () => {
    const doc = makeFakeDoc();
    applyFolderVisibility(doc, '_neurovim', false);
    expect(doc.adoptedStyleSheets).toHaveLength(0);
  });

  it('does nothing for an empty folder path', () => {
    const doc = makeFakeDoc();
    applyFolderVisibility(doc, '', true);
    expect(doc.adoptedStyleSheets).toHaveLength(0);
  });

  it('replaces a previously adopted sheet instead of stacking them', () => {
    const doc = makeFakeDoc();
    applyFolderVisibility(doc, '_neurovim', true);
    applyFolderVisibility(doc, '_other', true);
    expect(doc.adoptedStyleSheets).toHaveLength(1);
    const sheet = doc.adoptedStyleSheets[0] as FakeCSSStyleSheet;
    expect(sheet.cssText).toContain('_other');
  });

  it('falls back cosmetically when CSSStyleSheet is unsupported (no crash)', () => {
    (globalThis as { CSSStyleSheet?: unknown }).CSSStyleSheet = undefined;
    const doc = makeFakeDoc();
    expect(() => applyFolderVisibility(doc, '_neurovim', true)).not.toThrow();
    expect(doc.adoptedStyleSheets).toHaveLength(0);
  });

  it('removeFolderVisibility clears the adopted sheet', () => {
    const doc = makeFakeDoc();
    applyFolderVisibility(doc, '_neurovim', true);
    removeFolderVisibility();
    expect(doc.adoptedStyleSheets).toHaveLength(0);
  });
});
