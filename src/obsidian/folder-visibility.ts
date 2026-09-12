// uebernommen aus paperless-storage/src/obsidian/hide-folder.ts, 2026-09-12
// Blendet einen Vault-Ordner im Datei-Explorer per Constructable Stylesheet aus. Der
// Ordner bleibt ein normaler (nicht Punkt-praefigierter) Vault-Ordner — nur die ANZEIGE
// wird unterdrueckt, nicht der Ordner selbst.
//
// Kein document.createElement("style")/createEl("style") — beide sind von der
// obsidianmd-Regel no-forbidden-elements gesperrt, und zwar an der Operation selbst
// ("For loading CSS, use a 'styles.css' file instead"), nicht nur am Bezeichnernamen
// "document". new CSSStyleSheet() + replaceSync() + adoptedStyleSheets erzeugt gar kein
// <style>-Element und faellt nicht unter die Regel. Braucht iOS/Safari 16.4+ —
// Feature-Detection + try/catch, sonst kein Crash, nur der kosmetische Rueckfall (Ordner
// bleibt sichtbar).
//
// PROF-OBS-13: CSS.escape() gegen Ordnernamen mit Anfuehrungszeichen o.ae., Cleanup-Pflicht
// fuer jedes adoptierte Stylesheet.
//
// Das Ziel-Dokument wird als Parameter uebergeben statt ueber activeDocument geraten: seit
// Obsidian 1.13 ist das Einstellungsfenster ein EIGENES Fenster mit eigenem document —
// aendert der Nutzer den Toggle dort, ist activeDocument das Einstellungsfenster, nicht das
// Hauptfenster mit dem Datei-Explorer. Der Aufrufer (main.ts) uebergibt gezielt
// app.workspace.containerEl.ownerDocument.

let sheet: CSSStyleSheet | null = null;
let sheetDoc: Document | null = null;

function supportsConstructableStylesheets(): boolean {
  return typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype;
}

/** `folder` ist der Ordnerpfad, wie er als `data-path` im Datei-Explorer steht — OHNE
 *  trailing slash (Obsidians `nav-folder-title` traegt den Pfad ohne Endstrich). */
export function applyFolderVisibility(doc: Document, folder: string, hidden: boolean): void {
  removeFolderVisibility();
  if (!hidden || folder === '' || !supportsConstructableStylesheets()) return;
  try {
    const css = `.nav-folder-title[data-path="${CSS.escape(folder)}"] { display: none; }`;
    const newSheet = new CSSStyleSheet();
    newSheet.replaceSync(css);
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, newSheet];
    sheet = newSheet;
    sheetDoc = doc;
  } catch {
    // Kosmetischer Rueckfall: Ordner bleibt sichtbar, kein Crash.
  }
}

/** Fuer die Registrierung als Cleanup-Funktion (this.register(...) in main.ts). */
export function removeFolderVisibility(): void {
  if (sheet && sheetDoc) {
    sheetDoc.adoptedStyleSheets = sheetDoc.adoptedStyleSheets.filter((s) => s !== sheet);
  }
  sheet = null;
  sheetDoc = null;
}
