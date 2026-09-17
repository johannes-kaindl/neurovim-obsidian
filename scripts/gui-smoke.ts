/**
 * GUI-Smoke-Treiber — fährt die Prüfpunkte aus `docs/SMOKE.md` gegen ein **laufendes**
 * Obsidian statt von Hand.
 *
 * Warum getrackt (CORE-TEST-02 b): Die fünf Befunde vom 2026-08-15 (Tab-Leiste läuft aus
 * dem Panel, Reader ohne CRT-Palette, ASCII-Rahmen brechen, Karten uneinheitlich
 * ausgerichtet) fand **kein** Unit-Test — 208 grüne Tests sahen keinen davon, weil sie
 * alle in der Naht zum Host sitzen: echtes Theme-CSS, echte Obsidian-Button-Defaults,
 * echte Panel-Breite. Genau diese Schicht misst dieser Treiber.
 *
 * ## Voraussetzung
 *
 * ⚠️ **Zuerst prüfen, wer sonst an Obsidian hängt.** Obsidian ist Single-Instance — ein
 * `quit` trifft die Instanz, an der möglicherweise eine andere Session arbeitet, und zerstört
 * deren Zustand. Der eigene Lauf ist danach sauber grün; der Schaden entsteht woanders und
 * fällt nicht auf.
 *
 * ```bash
 * lsof -nP -iTCP:9222 -sTCP:LISTEN >/dev/null && echo "läuft bereits — NICHT beenden"
 * ```
 *
 * Hört der Port schon, dann **mitnutzen statt neu starten**: ein eigenes Fenster per
 * `vault-open` über IPC öffnen, dann `attachTo("workspace", port, vault)` — der Vault-Name
 * wählt, nicht die Reihenfolge. ⚠️ Die Port-Prüfung ersetzt die Frage nicht: sie zeigt aktive
 * CDP-Treiber, aber nicht, wer ein Fenster offen hält oder auf den Port wartet.
 *
 * Erst wenn nichts läuft — oder nach Absprache mit dem, der es benutzt — gilt das Rezept unten.
 *
 * Obsidian muss mit offenem Debug-Port laufen (der einzige Handgriff, der Handarbeit
 * bleibt — die App muss dafür neu gestartet werden):
 *
 * ```bash
 * osascript -e 'quit app "Obsidian"'
 * open -a Obsidian --args --remote-debugging-port=9222
 * ```
 *
 * Dann, mit deployter Plugin-Version (`npm run deploy`):
 *
 * ```bash
 * npm run smoke:gui -- --vault 10_Pallas
 * npm run smoke:gui -- --vault 10_Pallas --port 9222
 * ```
 *
 * Abschnitt R4 (Wertungs-Anzeige) läuft nur im Staging-Vault, weil er einen geseedeten
 * Bestwert auf einer Par-Mission braucht — gegen 10_Pallas wird er übersprungen:
 *
 * ```bash
 * npm run build && npm run smoke:gui -- --setup   # baut + öffnet $STAGING_VAULTS_DIR/neurovim-obsidian
 * npm run smoke:gui -- --vault neurovim-obsidian --reload
 * ```
 *
 * ⚠️ Chromium drosselt nicht-fokussierte Fenster: ohne Fokus bleibt die View leer und man
 * debuggt ein Phantom. `main()` holt das Fenster deshalb aktiv nach vorn.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Cdp, attachTo, closeExtraLeaves, pollUntil, setAppConfig, setPluginSetting } from "../../tools/obsidian-cdp/cdp.js";
import { buildHerkunft, buildVault, requireEigenerBuild, stagingVaultDir } from "../../tools/obsidian-cdp/vault.js";

const PLUGIN_ID = "neurovim";
/** src/HubView.tsx: VIEW_TYPE_NEUROVIM */
const HUB_VIEW = "neurovim-hub";
/** CRT-Akzent aus styles.css (.nv-crt --nv-accent). Der Reader muss ihn tragen. */
const CRT_ACCENT = "rgb(69, 255, 138)";

// --- Prüfpunkte -------------------------------------------------------------

interface Check {
  name: string;
  /** Drei Zustände, nicht zwei: ein übersprungener Prüfpunkt hat NICHTS gemessen und
   *  darf deshalb weder als grüner noch als roter gezählt werden. Vorher trug er
   *  `passed: true` — dann meldet der Lauf "N/N grün", während der Punkt, wegen dessen
   *  er gefahren wurde, stillschweigend ausfiel. */
  status: "gruen" | "rot" | "uebersprungen";
  detail: string;
}

const checks: Check[] = [];

function record(name: string, passed: boolean, detail: string): void {
  checks.push({ name, status: passed ? "gruen" : "rot", detail });
  console.log(`${passed ? "✅" : "❌"} ${name} — ${detail}`);
}

function skipped(name: string, reason: string): void {
  checks.push({ name, status: "uebersprungen", detail: `übersprungen: ${reason}` });
  console.log(`⏭️  ${name} — übersprungen: ${reason}`);
}

/**
 * Bricht den Lauf ab, statt rote Prüfpunkte zu melden.
 *
 * Der Unterschied ist der ganze Zweck: eine verletzte **Umgebungsbedingung** (Plugin aus,
 * falscher Vault, Hub nicht zu öffnen) ist kein Befund am geprüften Code. Meldet das
 * Werkzeug sie als roten Punkt, beginnt die Fehlersuche an der falschen Stelle — die
 * Lehre aus paperless-storage (LESSONS.md, 2026-08-14).
 */
class PreconditionError extends Error {}

async function requireEnvironment(cdp: Cdp, vault: string | undefined): Promise<void> {
  const name = await cdp.evaluate<string>("return app.vault.getName() || '';");
  if (vault && name !== vault) {
    throw new PreconditionError(
      `Verbunden mit Vault "${name}", erwartet "${vault}". Mehrere Vault-Fenster offen?`,
    );
  }
  const active = await cdp.evaluate<boolean>(
    `return Boolean(app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]);`,
  );
  if (!active) {
    throw new PreconditionError(
      `Plugin "${PLUGIN_ID}" ist in "${name}" nicht aktiv. Deployt (npm run deploy) und eingeschaltet?`,
    );
  }
  const version = await cdp.evaluate<string>(
    `return app.plugins.manifests[${JSON.stringify(PLUGIN_ID)}]?.version ?? '?';`,
  );
  console.log(`   Vault "${name}", Plugin ${PLUGIN_ID} ${version}`);

  // Läuft dieser Lauf gegen den eigenen Stand? Die Versionszeile darüber ist dafür
  // strukturell blind: Store-Build und Repo-Build tragen dieselbe Nummer, und dieses Plugin
  // läuft im Vault unter der ID `neurovim`, was die Zuordnung zusätzlich verdeckt. Am
  // 2026-08-30 standen dachweit 69 von 150 grünen Prüfpunkten auf einem Build, der nicht
  // belegt der Repo-Stand war. Der Pfad kommt aus der LAUFENDEN Instanz, nicht aus
  // `stagingVaultDir(...)`: `--vault` dockt an ein beliebiges Fenster an, geprüft wird,
  // was gemessen wird. Der main.js-Guard ist zentral und wird importiert; das
  // styles.css-Gegenstück darunter ist
  // uebernommen aus local-image-generator/scripts/gui-smoke.ts (e6fbb53), 2026-09-03 (via json_viewer).
  const vaultInfo = await cdp.evaluate<{ basePath: string; configDir: string }>(
    "return { basePath: app.vault.adapter.basePath, configDir: app.vault.configDir };",
  );
  const pluginDir = join(vaultInfo.basePath, vaultInfo.configDir, "plugins", PLUGIN_ID);
  requireEigenerBuild(join(pluginDir, "main.js"), join(process.cwd(), "main.js"));
  // Dieselbe Frage für `styles.css` — der zentrale Guard kennt nur `main.js`, R2-1/R2-3
  // messen aber gerendertes CSS (Tab-Geometrie, gemalte Reader-Farbe). Ein altes
  // Stylesheet neben frischer main.js erschiene dort als Plugin-Befund statt als
  // Deploy-Fehler.
  const css = buildHerkunft(join(pluginDir, "styles.css"), join(process.cwd(), "styles.css"));
  if (css.art === "fehlt") {
    throw new PreconditionError(`Im Vault liegt kein styles.css: ${css.pfad}\nZuerst deployen.`);
  }
  if (css.art === "fremd") {
    const z = (n: number) => n.toLocaleString("de-DE");
    throw new PreconditionError(
      `Das styles.css im Vault ist nicht der gebaute Repo-Stand: ${css.pfad}\n`
      + `  im Vault: ${z(css.bytes)} Bytes · gebaut: ${z(css.erwarteteBytes)} Bytes\n`
      + "R2-1/R2-3 messen gerendertes CSS. Zuerst deployen, dann erneut laufen.",
    );
  }
  console.log("   Build im Vault = Repo-Stand (main.js + styles.css sha1-gleich)");
}

/** Öffnet den Hub in der rechten Sidebar und wartet, bis er gezeichnet ist. */
async function openHub(cdp: Cdp): Promise<void> {
  // Warten, bis der View-Typ registriert IST, bevor setViewState läuft. Direkt nach
  // enablePlugin (Gegenprobe, --reload) ist onload noch nicht durch; setViewState auf
  // einen unbekannten Typ scheitert dann still und der Lauf bricht mit "Hub öffnete
  // sich nicht" ab — ein Treiber-Mangel, der wie ein Plugin-Fehler aussieht.
  // (Aufgedeckt von der Gegenprobe am 2026-08-16.)
  const registered = await pollUntil<boolean>(
    cdp,
    `return Boolean(app.viewRegistry.getViewCreatorByType(${JSON.stringify(HUB_VIEW)}));`,
    15_000,
    500,
  );
  if (!registered) {
    throw new PreconditionError(
      `View-Typ "${HUB_VIEW}" ist nicht registriert — Plugin geladen, aber onload nicht durch?`,
    );
  }
  // Erst abräumen, dann EIN neues Blatt. Zwei Gründe, beide 2026-08-16 gemessen:
  // (a) nach disablePlugin bleiben die Blatt-Hüllen zurück, sind aber vom Workspace
  //     abgetrennt — getRightLeaf(false) greift eine davon, setViewState läuft ohne
  //     Fehler durch und rendert ins Nichts (dieselbe Falle wie bei openFile, siehe
  //     tools/obsidian-cdp/cdp.ts § openExisting);
  // (b) setViewState IN einer Poll-Schleife erzeugt pro Runde ein weiteres Blatt —
  //     der Lauf hinterließ so 16 verwaiste Hub-Blätter.
  await cdp.evaluate(`
    app.workspace.detachLeavesOfType(${JSON.stringify(HUB_VIEW)});
    await new Promise((r) => setTimeout(r, 300));
    const leaf = app.workspace.getRightLeaf(true);
    await leaf.setViewState({ type: ${JSON.stringify(HUB_VIEW)}, active: true });
    app.workspace.revealLeaf(leaf);
    return true;
  `);
  const ready = await pollUntil<boolean>(
    cdp,
    "return Boolean(document.querySelector('.nv-tabs'));",
    20_000,
    500,
  );
  if (!ready) throw new PreconditionError("Hub-Pane öffnete sich nicht (.nv-tabs nie erschienen).");
}

/** Wechselt auf einen Hub-Tab, indem der Knopf mit dem Label geklickt wird. */
async function selectTab(cdp: Cdp, label: string): Promise<boolean> {
  return cdp.evaluate<boolean>(`
    const btn = [...document.querySelectorAll('.nv-tabs .nv-tab')]
      .find((b) => b.textContent.trim() === ${JSON.stringify(label)});
    if (!btn) return false;
    btn.click();
    await new Promise((r) => setTimeout(r, 700));
    return true;
  `);
}

// --- R2-1: Tab-Leiste läuft nicht aus dem Panel ------------------------------

/**
 * Misst den **Effekt** (kein Tab ragt über die Panel-Kante), nicht die Ursache
 * (`flex-wrap`-Wert). Der Defekt bestand darin, dass UPLINK unerreichbar war — genau das
 * wird geprüft, und zwar bei künstlich verschmälertem Panel, weil er nur dort auftrat.
 */
async function checkTabWrap(cdp: Cdp): Promise<void> {
  const result = await cdp.evaluate<
    { ok: boolean; overflow: number; clipped: string[]; rows: number; width: number; n: number } | null
  >(`
    const tabs = document.querySelector('.nv-tabs');
    if (!tabs) return null;
    if (tabs.querySelectorAll('.nv-tab').length === 0) return null;
    // Die Sidebar ueber Obsidians eigene API verschmaelern, nicht ueber style.width:
    // das Blatt bekommt seine Breite vom Split, ein Inline-Stil darauf verpufft
    // (gemessen 2026-08-16 — der Pruefpunkt war deshalb blind).
    const split = app.workspace.rightSplit;
    const sizeBefore = split.getSize ? split.getSize() : null;
    if (split.setSize) split.setSize(240);
    await new Promise((r) => setTimeout(r, 500));

    const t = document.querySelector('.nv-tabs');
    const buttons = [...t.querySelectorAll('.nv-tab')];
    const box = t.getBoundingClientRect();
    let overflow = 0;
    const clipped = [];
    const tops = new Set();
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      tops.add(Math.round(r.top));
      if (r.right > box.right + 1) overflow += 1;
      // Zweite Defektform: mit min-width:0 laufen die Tabs nicht ueber, sie SCHRUMPFEN
      // und schneiden ihr Label ab. Fuer den Spieler ist beides derselbe Schaden —
      // der Tab ist nicht lesbar. Also beides messen.
      // Gemessen wird das Element, das TATSAECHLICH clippt: seit der Umbruch-Norm haengt
      // overflow:hidden am Label-Span, nicht am Button. Am Button gemessen waeren
      // scrollWidth und clientWidth danach immer gleich — der Pruefpunkt waere blind
      // fuer genau den Defekt, den die Ellipse erzeugt. Fallback auf den Button, damit
      // die Messung auch ohne Span (aeltere Fassung) noch etwas misst.
      const m = b.querySelector('.nv-tab-label') || b;
      if (m.scrollWidth > m.clientWidth + 1) clipped.push(b.textContent.trim());
    }
    if (split.setSize && sizeBefore) split.setSize(sizeBefore);
    await new Promise((r) => setTimeout(r, 300));
    return {
      ok: overflow === 0 && clipped.length === 0,
      overflow, clipped, rows: tops.size, width: Math.round(box.width), n: buttons.length,
    };
  `);
  if (!result) {
    record("R2-1 alle Tabs lesbar bei schmaler Sidebar", false, "Tab-Leiste nicht gefunden — Hub nicht offen?");
    return;
  }
  const problems = [
    result.overflow > 0 ? `${result.overflow} über der Kante` : "",
    result.clipped.length > 0 ? `abgeschnitten: ${result.clipped.join(", ")}` : "",
  ].filter(Boolean).join("; ");
  record(
    "R2-1 alle Tabs lesbar bei schmaler Sidebar",
    result.ok,
    result.ok
      ? `${result.n} Tabs bei 240px vollständig sichtbar, Leiste nutzt ${result.rows} Zeile(n)`
      : `${problems} (Leistenbreite ${result.width}px, ${result.rows} Zeile(n))`,
  );
}

// --- R2-2: Gruppen klappen, Zähler bleibt ------------------------------------

async function checkCollapse(cdp: Cdp): Promise<void> {
  const before = await cdp.evaluate<{ cards: number; label: string; count: string } | null>(`
    const group = document.querySelector('.nv-archive-group');
    if (!group) return null;
    return {
      cards: group.querySelectorAll('.nv-card').length,
      label: (group.querySelector('.nv-archive-label-text') || {}).textContent || '',
      count: (group.querySelector('.nv-archive-count') || {}).textContent || '',
    };
  `);
  if (!before || before.cards === 0) {
    record("R2-2 Gruppen klappen", false, "keine Archiv-Gruppe mit Karten gefunden");
    return;
  }
  const after = await cdp.evaluate<{ cards: number; count: string; expanded: string } | null>(`
    const group = document.querySelector('.nv-archive-group');
    group.querySelector('.nv-archive-label').click();
    await new Promise((r) => setTimeout(r, 700));
    const g2 = document.querySelector('.nv-archive-group');
    return {
      cards: g2.querySelectorAll('.nv-card').length,
      count: (g2.querySelector('.nv-archive-count') || {}).textContent || '',
      expanded: g2.querySelector('.nv-archive-label').getAttribute('aria-expanded') || '',
    };
  `);
  const collapsed = after !== null && after.cards === 0;
  const countKept = after !== null && after.count.trim() === before.count.trim() && after.count.trim() !== "";
  record(
    "R2-2 Gruppe klappt zu",
    collapsed,
    collapsed
      ? `"${before.label.trim()}": ${before.cards} Karten → 0, aria-expanded=${after?.expanded}`
      : `Karten blieben sichtbar (${after?.cards ?? "?"})`,
  );
  record(
    "R2-2 Zähler bleibt eingeklappt sichtbar",
    countKept,
    countKept
      ? `Zähler "${after?.count.trim()}" steht weiterhin im Kopf`
      : `Zähler verschwand oder änderte sich: "${before.count.trim()}" → "${after?.count.trim() ?? "?"}"`,
  );
  // Persistenz: der Zustand muss in den Settings stehen, nicht nur im DOM.
  const persisted = await cdp.evaluate<boolean>(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    return Object.entries(p.settings.uiCollapsed || {}).some(([k, v]) => k.startsWith('archive:') && v === true);
  `);
  record(
    "R2-2 Klappzustand ist persistiert",
    persisted,
    persisted
      ? "settings.uiCollapsed trägt einen archive:*-Eintrag"
      : "settings.uiCollapsed hat keinen archive:*-Eintrag — Zustand überlebt den Neustart nicht",
  );
  // Wieder aufklappen, damit die folgenden Punkte Karten vorfinden.
  await cdp.evaluate(`
    const g = document.querySelector('.nv-archive-group');
    if (g.querySelectorAll('.nv-card').length === 0) g.querySelector('.nv-archive-label').click();
    await new Promise((r) => setTimeout(r, 600));
    return true;
  `);
}

// --- R2-5: Karten richten sich einheitlich aus -------------------------------

/**
 * Der Defekt: offene Karten sind `<button>`, gesperrte `<div>`; Obsidian zentriert die
 * Flex-Items seiner Buttons, also saß das LVL-Abzeichen der einen Sorte mittig und das
 * der anderen links. Gemessen wird die **Position** des Abzeichens relativ zur Karte —
 * ein Vergleich der CSS-Regel würde den Defekt gerade nicht sehen.
 */
async function checkCardAlignment(cdp: Cdp): Promise<void> {
  const result = await cdp.evaluate<{ open: number; locked: number; kinds: string } | null>(`
    const cards = [...document.querySelectorAll('.nv-card')];
    const offsetOf = (card) => {
      const badge = card.querySelector('.nv-card-badge') || card.querySelector('.nv-card-title');
      if (!badge) return null;
      return Math.round(badge.getBoundingClientRect().left - card.getBoundingClientRect().left);
    };
    const open = cards.find((c) => !c.classList.contains('is-locked'));
    const locked = cards.find((c) => c.classList.contains('is-locked'));
    if (!open || !locked) return null;
    return {
      open: offsetOf(open),
      locked: offsetOf(locked),
      kinds: open.tagName + '/' + locked.tagName,
    };
  `);
  if (!result || result.open === null || result.locked === null) {
    skipped("R2-5 Karten-Ausrichtung", "keine offene UND gesperrte Karte gleichzeitig sichtbar");
    return;
  }
  const equal = Math.abs(result.open - result.locked) <= 1;
  record(
    "R2-5 Karten richten sich einheitlich aus",
    equal,
    equal
      ? `Abzeichen beider Sorten (${result.kinds}) beginnt bei ${result.open}px`
      : `Abzeichen versetzt: offen ${result.open}px vs. gesperrt ${result.locked}px (${result.kinds})`,
  );
}

// --- R2-3 / R2-4: der Reader -------------------------------------------------

async function checkReader(cdp: Cdp): Promise<void> {
  const opened = await cdp.evaluate<boolean>(`
    const card = [...document.querySelectorAll('.nv-card')].find((c) => !c.classList.contains('is-locked'));
    if (!card) return false;
    card.click();
    await new Promise((r) => setTimeout(r, 900));
    return Boolean(document.querySelector('.nv-lore-modal'));
  `);
  if (!opened) {
    record("R2-3 Reader trägt das CRT-Schema", false, "Reader ließ sich nicht öffnen");
    skipped("R2-4 ASCII-Rahmen scrollen", "Reader nicht offen");
    return;
  }

  // R2-3: Effekt messen — die tatsächlich gemalte Farbe, nicht die gesetzte Klasse.
  // Die Klasse war im Defektfall längst da; was fehlte, war die Regel dahinter.
  // Gemessen wird der **Rahmen** des Modals und die Farbe des gerenderten Markdown —
  // NICHT die Titelfarbe. Der Titel bezieht sein Grün aus `.nv-lore-title`, einer Regel,
  // die es schon vor dem Fix gab: der Prüfpunkt war damit im Defektfall grün (Gegenprobe
  // 2026-08-16). Kaputt war, dass Rahmen und Fließtext dem Theme folgten.
  const colors = await cdp.evaluate<
    { scheme: string; modalBg: string; paraColor: string | null; paneBg: string } | null
  >(`
    const modal = document.querySelector('.nv-lore-modal');
    if (!modal) return null;
    const body = modal.querySelector('.nv-lore-body');
    if (!body) return null;
    const para = body.querySelector('p, li, h1, h2');
    // Referenzwert aus dem Hub daneben: dieselbe Palette, unabhaengig gemessen.
    const pane = document.querySelector('.nv-root');
    return {
      scheme: modal.classList.contains('nv-crt') ? 'crt' : 'native',
      modalBg: getComputedStyle(modal).backgroundColor,
      paraColor: para ? getComputedStyle(para).color : null,
      paneBg: pane ? getComputedStyle(pane).backgroundColor : '',
    };
  `);
  if (!colors) {
    record("R2-3 Reader trägt das CRT-Schema", false, "Reader-Körper nicht gefunden");
  } else if (colors.scheme !== "crt") {
    skipped("R2-3 Reader trägt das CRT-Schema", `natives Schema aktiv (${colors.scheme}) — Punkt gilt nur für CRT`);
  } else {
    // Der Reader muss denselben Grund tragen wie der Hub dahinter — genau dieser
    // Unterschied war auf dem Smoke-Screenshot vom 2026-08-15 zu sehen.
    const ok = colors.modalBg === colors.paneBg;
    record(
      "R2-3 Reader trägt denselben Grund wie der Hub",
      ok,
      ok
        ? `Modal und Pane beide ${colors.modalBg}, Fließtext ${colors.paraColor ?? "—"}`
        : `Modal ${colors.modalBg}, Hub-Pane ${colors.paneBg} — der Reader folgt dem Theme statt dem Schema`,
    );
  }

  // R2-4: Der ASCII-Rahmen darf nicht umbrechen. Gemessen wird, dass der Block
  // horizontal scrollen KANN und dass sein Umbruchverhalten `pre` ist — beides
  // zusammen, weil ein schmaler Block ohne Überlauf sonst falsch grün würde.
  // Gemessen wird der Bruch selbst: wie viele Zeilen der Block **textlich** hat gegen
  // die, die er **gerendert** belegt. Ein umgebrochener ASCII-Rahmen braucht mehr Zeilen
  // als er Zeilenumbrüche enthält — das ist der Schaden, den Johannes gesehen hat.
  // `white-space` allein taugt nicht: der Wert stand auch im Defektfall auf `pre`
  // (Gegenprobe 2026-08-16), gebrochen hat es am `code` darin.
  const ascii = await cdp.evaluate<
    { found: boolean; textLines: number; renderedLines: number; copyHidden: boolean } | null
  >(`
    const modal = document.querySelector('.nv-lore-modal');
    const pre = modal && modal.querySelector('.nv-lore-body pre');
    if (!pre) return { found: false, textLines: 0, renderedLines: 0, copyHidden: false };
    const copy = modal.querySelector('.copy-code-button');
    // Gerenderte Zeilen = Zeilenboxen des Textes (Range-Rects nach Oberkante gruppiert),
    // NICHT scrollHeight/lineHeight: die Scrollhöhe enthält die horizontale Scrollleiste —
    // also genau den Beweis, dass der Block scrollt statt umzubrechen — und meldete im
    // Staging-Vault 13 Zeilen für 11 (gemessen 2026-09-03: 11 Zeilenboxen, 248 px bei
    // 19,5 px Zeilenhöhe, Scrollleiste ~33 px). Ein umgebrochener Rahmen hat dagegen
    // wirklich mehr Zeilenboxen als Zeilenumbrüche.
    const text = pre.textContent.replace(/\\n$/, '');
    const range = document.createRange();
    range.selectNodeContents(pre.querySelector('code') || pre);
    const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
    return {
      found: true,
      textLines: text.split('\\n').length,
      renderedLines: tops.size,
      copyHidden: !copy || getComputedStyle(copy).display === 'none',
    };
  `);
  if (!ascii || !ascii.found) {
    skipped("R2-4 ASCII-Rahmen brechen nicht um", "dieses Artefakt enthält keinen Code-Block");
  } else {
    const ok = ascii.renderedLines === ascii.textLines;
    record(
      "R2-4 ASCII-Rahmen brechen nicht um",
      ok,
      ok
        ? `${ascii.textLines} Textzeilen belegen ${ascii.renderedLines} gerenderte Zeilen`
        : `${ascii.textLines} Textzeilen belegen ${ascii.renderedLines} Zeilen — der Rahmen bricht auseinander`,
    );
    record(
      "R2-4 Kopier-Knopf ist ausgeblendet",
      ascii.copyHidden,
      ascii.copyHidden ? "kein sichtbarer copy-code-button im Reader" : "Kopier-Knopf liegt über dem Rahmen",
    );
  }

  await cdp.evaluate(`
    const m = document.querySelector('.nv-lore-modal');
    if (m) { const c = m.querySelector('.modal-close-button'); if (c) c.click(); }
    await new Promise((r) => setTimeout(r, 400));
    return true;
  `);
}


// --- R4: Wertungs-Anzeige (ParTier) — nur im Staging-Vault ------------------------

const STAGING_VAULT = "neurovim-obsidian";
/** Mission mit autorisiertem Par (22) und gespieltem Bestwert (20 → Gold) im Fixture. */
const PAR_MISSION = "KATA-12";
/** Mission ohne autorisiertes Par — darf NIE einen Chip tragen, egal was gespielt wurde. */
const NO_PAR_MISSION = "M-01";

/**
 * `--setup`: Staging-Vault aus dem getrackten Fixture bauen und den Spielstand seeden.
 * `buildVault` entfernt `data.json` absichtlich (Auslieferungszustand); der Seed kommt
 * danach aus `scripts/smoke-fixture/plugin-data.json`, damit der Vault einen Bestwert auf einer
 * Par-Mission trägt — im Arbeits-Vault gibt es den nicht, und dessen `data.json` ist der
 * echte Spielstand, an dem nichts präpariert wird.
 */
function setupStagingVault(): void {
  const vaultDir = stagingVaultDir(STAGING_VAULT);
  const log = buildVault({
    repoRoot: process.cwd(),
    vaultDir,
    fixtureDir: join(process.cwd(), "docs/images/fixture"),
    pluginId: PLUGIN_ID,
  });
  log.forEach((l) => console.log(`   ${l}`));
  const seed = join(process.cwd(), "scripts/smoke-fixture/plugin-data.json");
  writeFileSync(join(vaultDir, ".obsidian", "plugins", PLUGIN_ID, "data.json"), readFileSync(seed));
  console.log(`   Spielstand geseedet aus scripts/smoke-fixture/plugin-data.json (${PAR_MISSION} gespielt)`);
  // Ein frisch gebauter Vault ist Obsidian unbekannt; der Pfad-URI öffnet ihn als weiteres
  // Fenster der laufenden Instanz und registriert ihn dabei (Dach-AGENTS, 2026-09-01).
  const uri = `obsidian://open?path=${encodeURIComponent(join(vaultDir, "Welcome.md"))}`;
  execFileSync("open", [uri]);
  console.log(`\n✅ Vault gebaut und geöffnet: ${vaultDir}\n   Dann: npm run smoke:gui -- --vault ${STAGING_VAULT}`);
}

/**
 * Die Tier-Anzeige aus `073f4db` ist durch Unit-Tests gedeckt, aber keiner sieht, wie sie
 * SITZT. Zwei Risiken, beide nur am Code belegt: die Missionszeile ist ein Grid mit drei
 * Spalten, der Chip hängt in der dritten Zelle — ob er dort bleibt oder eine Zeile
 * aufmacht, entscheidet das Rendering; und das Result-Modal zeigt das Badge nur nach einem
 * echten Lauf mit Tastenanschlägen (0 Anschläge → UNVERIFIED → kein Urteil).
 *
 * Läuft nur im Staging-Vault: dort liegt der geseedete Bestwert. Im Arbeits-Vault wäre
 * „kein Chip" korrekt und der Punkt bestätigte sich selbst.
 */
async function checkMasteryTier(cdp: Cdp, vault: string | undefined): Promise<void> {
  if (vault !== STAGING_VAULT) {
    skipped("R4 Wertungs-Anzeige", `läuft nur im Staging-Vault "${STAGING_VAULT}" (--setup, dann --vault ${STAGING_VAULT})`);
    return;
  }
  if (!(await selectTab(cdp, "MISSIONS"))) {
    record("R4 Wertungs-Anzeige", false, "MISSIONS-Tab nicht gefunden");
    return;
  }

  // --- R4-1: Chip nur dort, wo jemand ein Par autorisiert hat ---------------------
  const rows = await cdp.evaluate<{
    par: { found: boolean; chip: string | null; height: number; chipTop: number; xpTop: number; metaRight: number; chipRight: number } | null;
    noPar: { found: boolean; chip: string | null; height: number } | null;
  }>(`
    const row = (id) => [...document.querySelectorAll('.nv-mission')]
      .find((r) => r.querySelector('.nv-mission-id')?.textContent.trim() === id);
    const measure = (r) => {
      if (!r) return null;
      const chip = r.querySelector('.nv-mission-tier');
      const xp = r.querySelector('.nv-mission-xp');
      const meta = r.querySelector('.nv-mission-meta');
      const b = (e) => e ? e.getBoundingClientRect() : { top: 0, right: 0, height: 0 };
      return {
        found: true,
        chip: chip ? chip.className : null,
        height: r.getBoundingClientRect().height,
        chipTop: b(chip).top, xpTop: b(xp).top, metaRight: b(meta).right, chipRight: b(chip).right,
      };
    };
    return { par: measure(row(${JSON.stringify(PAR_MISSION)})), noPar: measure(row(${JSON.stringify(NO_PAR_MISSION)})) };
  `);
  if (!rows.par || !rows.noPar) {
    record("R4-1 Chip nur bei autorisiertem Par", false,
      `Missionszeilen nicht gefunden (${PAR_MISSION}: ${Boolean(rows.par)}, ${NO_PAR_MISSION}: ${Boolean(rows.noPar)})`);
    return;
  }
  const chipOk = rows.par.chip !== null && rows.par.chip.includes("nv-tier-gold") && rows.noPar.chip === null;
  record(
    "R4-1 Chip nur bei autorisiertem Par",
    chipOk,
    chipOk
      ? `${PAR_MISSION} trägt nv-tier-gold, ${NO_PAR_MISSION} trägt keinen Chip`
      : `${PAR_MISSION}: ${rows.par.chip ?? "kein Chip"} · ${NO_PAR_MISSION}: ${rows.noPar.chip ?? "kein Chip"}`,
  );

  // --- R4-2: der Chip bleibt in seiner Zelle — gemessen an Höhe und Zeile ----------
  // Ein umgebrochenes Grid-Kind stünde eine Zeile tiefer als das XP-Feld und machte die
  // Zeile höher als eine ohne Chip. Beides wird gemessen, nicht die Klasse.
  const sameLine = Math.abs(rows.par.chipTop - rows.par.xpTop) < 2;
  const notTaller = rows.par.height <= rows.noPar.height + 1;
  const inCell = rows.par.chipRight <= rows.par.metaRight + 1;
  const gridOk = rows.par.chip !== null && sameLine && notTaller && inCell;
  record(
    "R4-2 Chip bricht die Missionszeile nicht um",
    gridOk,
    `Zeile mit Chip ${Math.round(rows.par.height)}px, ohne ${Math.round(rows.noPar.height)}px; `
      + `Chip/XP-Oberkante Δ${Math.round(Math.abs(rows.par.chipTop - rows.par.xpTop))}px`
      + (inCell ? "" : "; Chip ragt aus der Meta-Zelle"),
  );

  // --- R4-4: die Tier-Farben sind in beiden Schemata und beiden Themes lesbar ------
  // Gold/Silber/Bronze sind feste Hex-Werte (kein Theme-Token heißt Gold). Ob Silber auf
  // hellem Grund noch lesbar ist, hatte niemand gesehen — hier wird es gerechnet: WCAG-
  // Kontrast der drei Variablen gegen den tatsächlich gemalten Hintergrund der
  // Missionszeile, in allen vier Kombinationen aus Farbschema (crt/native) und Obsidian-
  // Theme (dunkel/hell). Schwelle 3:1 (grafische UI-Elemente). Gemessen wird der
  // gerenderte Wert, nicht das Stylesheet; Theme und Schema werden danach zurückgestellt.
  // Vorwert zusaetzlich als window-Global sichern (nicht nur hier im Node-Closure): ein
  // SIGINT mitten in der Theme/Schema-Schleife trifft main()s Signal-Handler, der diese
  // lokale `before`-Variable nicht sieht — ohne das Global bliebe ein abgebrochener Lauf im
  // FALSCHEN Theme/Schema stehen, sichtbar fuer die ganze Obsidian-Instanz.
  const before = await cdp.evaluate<{ theme: string; scheme: string }>(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    const b = { theme: app.vault.getConfig('theme') || 'obsidian', scheme: p.settings.colorScheme };
    window.__nvSmokeThemeBefore = b;
    return b;
  `);
  const combos: string[] = [];
  let worst = Infinity;
  try {
    for (const theme of ["obsidian", "moonstone"] as const) {
      await setAppConfig(cdp, "theme", theme);
      for (const scheme of ["crt", "native"] as const) {
        await setPluginSetting(cdp, PLUGIN_ID, "colorScheme", scheme);
        // Der Hub rendert im 500-ms-Takt, der Renderer drosselt Timer auf 1 Hz.
        const ok = await pollUntil<boolean>(
          cdp,
          `return Boolean(document.querySelector('.nv-root.nv-${scheme} .nv-mission'));`,
          5_000,
          250,
        );
        if (!ok) { combos.push(`${theme}/${scheme}: Hub nicht im Schema gerendert`); worst = 0; continue; }
        const r = await cdp.evaluate<Record<string, number>>(`
          const row = document.querySelector('.nv-root .nv-mission');
          const toRgb = (c) => { const m = c.match(/[\\d.]+/g) || []; return m.slice(0, 3).map(Number); };
          const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
          const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
          // gemalter Hintergrund: erster Vorfahr mit deckender Farbe, sonst body
          let el = row, bg = null;
          while (el && !bg) { const c = getComputedStyle(el).backgroundColor; if (c && !/rgba\\(.*, 0\\)$/.test(c) && c !== 'transparent') bg = toRgb(c); el = el.parentElement; }
          if (!bg) bg = toRgb(getComputedStyle(document.body).backgroundColor);
          const cs = getComputedStyle(row);
          const out = {};
          for (const t of ['gold', 'silver', 'bronze']) {
            const probe = document.createElement('span'); probe.style.color = cs.getPropertyValue('--nv-tier-' + t).trim();
            row.appendChild(probe); out[t] = Math.round(contrast(toRgb(getComputedStyle(probe).color), bg) * 10) / 10; probe.remove();
          }
          return out;
        `);
        const minHere = Math.min(r.gold, r.silver, r.bronze);
        worst = Math.min(worst, minHere);
        combos.push(`${theme === "moonstone" ? "hell" : "dunkel"}/${scheme}: Au ${r.gold} · Ag ${r.silver} · Cu ${r.bronze}`);
      }
    }
  } finally {
    await setPluginSetting(cdp, PLUGIN_ID, "colorScheme", before.scheme).catch(() => undefined);
    await setAppConfig(cdp, "theme", before.theme).catch(() => undefined);
    await cdp.evaluate(`delete window.__nvSmokeThemeBefore; return true;`).catch(() => undefined);
  }
  record(
    "R4-4 Tier-Farben lesbar in allen vier Schema/Theme-Kombinationen",
    worst >= 3,
    `${combos.join(" | ")} — schwächster Kontrast ${worst}:1${worst >= 3 ? "" : " (unter 3:1)"}`,
  );

  // --- R4-3: das Result-Modal trägt Badge und Par nach einem echten Lauf ------------
  // Ein echter Lauf, weil das Badge an `unverified` hängt: die Tastenanschläge kommen als
  // Keydown im Capture-Pfad an (so zählt das Plugin), der Text als Datei-Schreibvorgang,
  // denn `submit()` liest die Notiz aus dem Vault, nicht aus dem Editor.
  const KEYS = 18; // < par 22 → Gold
  try {
    // Kein Result-Modal darf vor dem Lauf offen sein — sonst misst der Prüfpunkt ein
    // liegen gebliebenes Modal (mit Badge) statt des neuen. Gemessen 2026-09-03: die
    // Gegenprobe (Par entfernt) blieb GRÜN, weil das Modal des vorigen Laufs noch stand.
    const stale = await cdp.evaluate<number>(`
      // Das Result-Modal hat keinen Obsidian-Schließknopf; sein Ausgang ist der eigene
      // Knopf „ZURÜCK ZUM NEXUS" (.nv-btn-nexus). Ein Klick schließt EIN Modal — daher die
      // Schleife, gemessen 2026-09-03 an drei liegen gebliebenen Modalen.
      for (let i = 0; i < 10 && document.querySelector('.nv-result-modal'); i++) {
        const b = document.querySelector('.nv-result-modal .nv-btn-nexus');
        if (b) b.click(); else document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
        await new Promise((r) => setTimeout(r, 250));
      }
      return document.querySelectorAll('.nv-result-modal').length;
    `);
    if (stale > 0) {
      record("R4-3 Result-Modal trägt Badge und Par", false, `${stale} Result-Modal(e) ließen sich vor dem Lauf nicht schließen`);
      return;
    }
    const started = await cdp.evaluate<boolean>(`
      const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
      await p.beginMission(${JSON.stringify(PAR_MISSION)});
      await new Promise((r) => setTimeout(r, 800));
      return p.session.state === 'active' && Boolean(p.missionEditorView());
    `);
    if (!started) {
      record("R4-3 Result-Modal trägt Badge und Par", false, "Mission startete nicht (kein aktiver Editor)");
      return;
    }
    const typed = await cdp.evaluate<number>(`
      const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
      const cm = p.missionEditorView();
      for (let i = 0; i < ${KEYS}; i++) {
        cm.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
      }
      return p.session.metrics.getResult(0).keystrokes;
    `);
    await cdp.evaluate(`
      const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
      const doc = await p.content.getMission(${JSON.stringify(PAR_MISSION)});
      const f = app.vault.getAbstractFileByPath(p.session.notePath);
      await app.vault.modify(f, doc.solution);
      await new Promise((r) => setTimeout(r, 300));
      await p.handleSubmit();
      return true;
    `);
    const modal = await pollUntil<{ tier: string | null; text: string } | null>(
      cdp,
      `const m = document.querySelector('.nv-result-modal'); if (!m) return null;
       const t = m.querySelector('.nv-result-tier');
       return { tier: t ? t.className : null, text: t ? t.textContent.trim() : '' };`,
      8_000,
      200,
    );
    const modalOk = Boolean(modal) && modal!.tier !== null && modal!.tier.includes("nv-tier-gold") && modal!.text.includes("PAR 22");
    record(
      "R4-3 Result-Modal trägt Badge und Par",
      modalOk,
      !modal ? `kein Result-Modal (gezählte Anschläge: ${typed})`
        : modalOk ? `"${modal.text}" nach ${typed} gezählten Anschlägen`
        : `Badge ${modal.tier ?? "fehlt"}, Text "${modal.text}", Anschläge ${typed}`,
    );

    // --- R4-5: Aktionsleiste bleibt bei langem Debrief-Text erreichbar ---------------
    // Wirt-Eigenschaft aus der UI-Adoption-Task "stream-area" (kein Kit-Modul liefert sie):
    // der Debrief-Bereich streamt unbegrenzt langen Text VOR der Aktionsleiste im DOM
    // (ResultApp in ResultModal.tsx) — ohne eigenen Scroll-Container würde der
    // „ZURÜCK ZUM NEXUS"-Knopf aus dem sichtbaren Modal-Bereich geschoben. Echtes
    // CIPHER-Streaming braucht Netzwerk/LLM (dafür gibt es scripts/debrief-lab.mjs) — hier
    // wird nur die Geometrie geprüft: Text synthetisch einsetzen, Knopf-Bounding-Rect gegen
    // die sichtbare Modal-Fläche vergleichen.
    if (modal) {
      // Gegenprobe gefahren (2026-09-12), zwei Fehlschläge vor dieser Fassung:
      // (1) Ein Vergleich gegen `.nv-result-body` selbst bleibt IMMER grün — der
      //     Flex-Container wächst mit dem Text mit, der Knopf sitzt also immer an dessen
      //     eigenem unteren Rand, ob sichtbar oder nicht.
      // (2) `getBoundingClientRect()` OHNE zu scrollen bleibt bei überlaufendem Inhalt IMMER
      //     rot, selbst mit korrektem `overflow-y: auto` — das Rect misst die Layout-Position
      //     in der (ungescrollten) Flow-Reihenfolge, nicht die durch Clipping sichtbare.
      // Die tragende Messung: den Scroll-Container tatsächlich ans Ende scrollen, DANACH
      // messen, ob der Knopf innerhalb von dessen eigener (geclippter) Fläche liegt — das
      // ist exakt das, was ein Mensch mit einem Scrollbalken auch täte.
      const geo = await cdp.evaluate<{ btnBottom: number; boxBottom: number; scrollable: boolean } | null>(`
        const btn = document.querySelector('.nv-result-modal .nv-btn-nexus');
        const body = document.querySelector('.nv-result-modal .nv-result-body');
        if (!btn || !body) return null;
        // Synthetischer Debrief-Text statt eines echten Streams (der braucht Netzwerk/LLM,
        // dafür gibt es scripts/debrief-lab.mjs) — mit Leerzeichen, sonst bricht 'pre-wrap'
        // nicht um (Gegenprobe 2026-09-12: ein zusammenhaengender String ohne Spatien blaeht
        // die Hoehe kaum auf, weil nichts umbricht).
        let stream = document.querySelector('.nv-result-modal .nv-debrief-stream');
        if (!stream) {
          stream = document.createElement('div');
          stream.className = 'nv-debrief-stream';
          body.insertBefore(stream, body.querySelector('.nv-result-actions'));
        }
        stream.textContent = 'lorem ipsum '.repeat(400);
        await new Promise((r) => setTimeout(r, 50));
        const scrollable = body.scrollHeight > body.clientHeight;
        body.scrollTop = body.scrollHeight;
        await new Promise((r) => setTimeout(r, 50));
        const boxRect = body.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        return { btnBottom: btnRect.bottom, boxBottom: boxRect.bottom, scrollable };
      `);
      record(
        "R4-5 Aktionsleiste bleibt bei langem Debrief-Text erreichbar",
        Boolean(geo) && geo!.scrollable && geo!.btnBottom <= geo!.boxBottom + 1,
        !geo ? "Result-Modal-Struktur nicht gefunden"
          : !geo.scrollable ? "kein Scroll-Container — Textmenge hat den Body nicht überlaufen lassen"
          : `nach Scroll ans Ende: Knopf-Unterkante ${geo.btnBottom.toFixed(0)} vs. Box-Unterkante ${geo.boxBottom.toFixed(0)}`,
      );
    } else {
      skipped("R4-5 Aktionsleiste bleibt bei langem Debrief-Text erreichbar", "kein Result-Modal aus R4-3");
    }
  } finally {
    // Modal schließen, einen hängen gebliebenen Lauf beenden, Missionsnotiz zumachen.
    await cdp.evaluate(`
      const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
      // Das Result-Modal hat keinen Obsidian-Schließknopf; sein Ausgang ist der eigene
      // Knopf „ZURÜCK ZUM NEXUS" (.nv-btn-nexus). Ein Klick schließt EIN Modal — daher die
      // Schleife, gemessen 2026-09-03 an drei liegen gebliebenen Modalen.
      for (let i = 0; i < 10 && document.querySelector('.nv-result-modal'); i++) {
        const b = document.querySelector('.nv-result-modal .nv-btn-nexus');
        if (b) b.click(); else document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
        await new Promise((r) => setTimeout(r, 250));
      }
      if (p.session.activeMissionId) { p.session.end(); p.restoreVim(); p.repaint(); }
      for (const leaf of app.workspace.getLeavesOfType('markdown')) {
        if (leaf.view?.file?.path?.startsWith(p.settings.missionFolder)) leaf.detach();
      }
      return true;
    `).catch(() => undefined);
  }
}


// --- R3: CIPHER-Uplink — die Naht, die `main.ts` selbst nicht bewacht ---------

/**
 * Warum dieser Abschnitt existiert: Seit Slice A (2026-08-18) kommen Prompt-Bau,
 * Chat-Session und Turn-Choreografie aus `@neurovim/core`; hier unten bleibt die
 * **Verdrahtung** — `uplink()` baut `CorePortAdapter` aus `isLlmConfigured(settings)`
 * und `effectiveModel(ep, settings.llmModel)`. Wäre sie falsch, blieben alle Kern- und
 * Adapter-Tests trotzdem grün: die bekommen ihre Settings vom Test, nicht vom Plugin.
 * `main.ts` hat keine Test-Naht — genau diese Lücke blieb nach der Trace-Rückportierung
 * schon einmal offen.
 *
 * **Der Transport wird gestubbt, nicht das Modell befragt.** Geprüft wird die
 * Verdrahtung, nicht die Antwortqualität — dafür gibt es `scripts/debrief-lab.mjs`.
 * Ein Stub macht den Lauf reproduzierbar und unabhängig davon, ob gerade ein lokaler
 * Endpunkt läuft. Gepatcht wird nur im Speicher; `saveSettings` läuft hier nie, also
 * bleibt `data.json` unberührt.
 */
async function checkCipherUplink(cdp: Cdp): Promise<void> {
  // Erst stubben, DANN den Tab wählen: UPLINK gibt es nur bei konfiguriertem LLM, und der
  // Stub konfiguriert eines. So läuft der Abschnitt auch im Staging-Vault, der keinen
  // Endpunkt kennt (bis 2026-09-03 wurde er dort übersprungen).
  // Transport + Endpunkt-Auflösung durch einen kontrollierten Stub ersetzen. Der Stub
  // streamt ein Stück, wartet, und richtet sich dann danach, ob abgebrochen wurde —
  // damit ist CUT überhaupt erst beobachtbar (ein sofort fertiger Stream wäre vorbei,
  // bevor der Knopf existiert).
  const patched = await cdp.evaluate<boolean>(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    if (!p || !p.cipherClient || !p.endpointResolver) return false;
    window.__nvSmokeRestore = {
      stream: p.cipherClient.stream.bind(p.cipherClient),
      resolve: p.endpointResolver.resolve.bind(p.endpointResolver),
      invalidate: p.endpointResolver.invalidate.bind(p.endpointResolver),
      endpoints: p.settings.llmEndpoints,
      model: p.settings.llmModel,
    };
    // Konfiguriert-Gate erfüllen, ohne die echten Werte zu speichern.
    p.settings.llmEndpoints = [{ url: 'http://nv-smoke.invalid:1234', apiKey: '', model: 'stub' }];
    p.settings.llmModel = 'stub';
    p.endpointResolver.resolve = async () => ({ url: 'http://nv-smoke.invalid:1234', apiKey: '', model: 'stub' });
    p.endpointResolver.invalidate = () => {};
    // Der Stub haelt den Stream offen, bis der Treiber ihn freigibt (R3-3) oder die
    // Oberflaeche ihn abbricht (R3-1). KEINE Timer-Schleife: Obsidians Renderer drosselt
    // setTimeout auf 1 Hz (gemessen 2026-09-03, 7 Ticks in 6 s bei 100 ms Soll, mit und
    // ohne Fokus) — 40 × 100 ms wurden so zu 40 s, und R3-3 lief rot, obwohl die Antwort
    // spaeter korrekt landete. Ein Treiber-Befund, kein Plugin-Befund.
    p.cipherClient.stream = (cfg, messages, onToken, signal) => new Promise((resolve) => {
      window.__nvSmokeSawModel = cfg && cfg.model;
      onToken('Use d');
      const finish = () => {
        onToken('w.');
        resolve({ ok: true, content: 'Use dw.' });
      };
      window.__nvSmokeRelease = finish;
      if (signal.aborted) {
        resolve({ ok: false, kind: 'aborted', detail: 'stream aborted', partial: 'Use d' });
        return;
      }
      signal.addEventListener('abort', () => {
        window.__nvSmokeRelease = null;
        resolve({ ok: false, kind: 'aborted', detail: 'stream aborted', partial: 'Use d' });
      }, { once: true });
    });
    // Einen etwaigen zuvor gebauten Uplink verwerfen, damit er den Stub sieht.
    p.cipherUplink = null;
    return true;
  `);

  if (!patched) {
    // KEIN skipped(): dass cipherClient/endpointResolver nicht am Plugin hängen, ist
    // genau die Verdrahtungsänderung in main.ts, für die dieser Abschnitt existiert.
    // Als Skip gemeldet würde R3 sich in seinem eigenen Fehlerfall selbst bestätigen.
    record("R3 CIPHER-Uplink", false, "cipherClient/endpointResolver nicht am Plugin gefunden");
    return;
  }
  // Der Hub rendert im 500-ms-Takt; der Tab braucht einen Tick, um aufzutauchen.
  const tabShown = await pollUntil<boolean>(
    cdp,
    "return [...document.querySelectorAll('.nv-tabs .nv-tab')].some((b) => b.textContent.trim() === 'UPLINK');",
    5_000,
    250,
  );
  if (!tabShown || !(await selectTab(cdp, "UPLINK"))) {
    record("R3 CIPHER-Uplink", false, "UPLINK-Tab erschien trotz gestubbter Konfiguration nicht");
    return;
  }

  try {
    // --- R3-1: CUT behält das Teilergebnis und gibt die Eingabe frei ---------
    await cdp.evaluate(`
      const input = document.querySelector('.nv-uplink-input');
      input.value = 'wie loesche ich ein Wort?';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return true;
    `);

    const streaming = await pollUntil<boolean>(
      cdp,
      "return Boolean(document.querySelector('.nv-uplink-cursor')) && Boolean(document.querySelector('.nv-btn-abort'));",
      8_000,
      200,
    );
    if (!streaming) {
      record("R3-1 CUT behält das Teilergebnis", false,
        "Stream startete nicht (kein Cursor / kein CUT-Knopf) — Verdrahtung von uplink() prüfen");
      return;
    }

    // Der Modellname muss aus den Settings durch den Adapter beim Client ankommen.
    const model = await cdp.evaluate<string | null>("return window.__nvSmokeSawModel ?? null;");
    record(
      "R3-0 Modellwahl erreicht den Transport",
      model === "stub",
      model === "stub" ? "cfg.model === 'stub'" : `cfg.model war ${JSON.stringify(model)} statt 'stub'`,
    );

    await cdp.evaluate(`
      document.querySelector('.nv-btn-abort').click();
      await new Promise((r) => setTimeout(r, 1500));
      return true;
    `);

    const afterCut = await cdp.evaluate<{ text: string; inputEnabled: boolean; busyBtn: boolean }>(`
      const lines = [...document.querySelectorAll('.nv-uplink-line.nv-uplink-assistant .nv-uplink-text')];
      const input = document.querySelector('.nv-uplink-input');
      return {
        text: lines.length ? lines[lines.length - 1].textContent.trim() : '',
        inputEnabled: Boolean(input) && !input.disabled,
        busyBtn: Boolean(document.querySelector('.nv-btn-abort')),
      };
    `);

    // Beides zusammen ist der Prüfpunkt: Wäre CUT wie RST gebaut (Turn enteignet), fiele
    // der gekillte Turn durch seinen Identitätscheck — das Teilergebnis ginge verloren
    // UND `busy` bliebe hängen, die Eingabe also gesperrt.
    const cutOk = afterCut.text.includes("signal cut") && afterCut.inputEnabled && !afterCut.busyBtn;
    record(
      "R3-1 CUT behält das Teilergebnis und gibt die Eingabe frei",
      cutOk,
      cutOk
        ? `"${afterCut.text}", Eingabe wieder frei`
        : `Text=${JSON.stringify(afterCut.text)}, Eingabe frei=${afterCut.inputEnabled}, CUT noch da=${afterCut.busyBtn}`,
    );

    // --- R3-2: RST leert den Kanal ------------------------------------------
    await cdp.evaluate(`
      document.querySelector('.nv-btn-reset').click();
      await new Promise((r) => setTimeout(r, 800));
      return true;
    `);
    const afterReset = await cdp.evaluate<number>(
      "return document.querySelectorAll('.nv-uplink-line').length;",
    );
    record(
      "R3-2 RST leert den Kanal",
      afterReset === 0,
      afterReset === 0 ? "keine Zeilen mehr im Log" : `${afterReset} Zeile(n) blieben stehen`,
    );

    // --- R3-3: ein voller Turn landet als Antwort ----------------------------
    await cdp.evaluate(`
      const input = document.querySelector('.nv-uplink-input');
      input.value = 'zweite Frage';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return true;
    `);
    // Erst wenn der Stub den zweiten Turn haelt, darf er ihn beenden — sonst gaebe die
    // Freigabe den ERSTEN (laengst abgebrochenen) Turn frei oder liefe ins Leere.
    const held = await pollUntil<boolean>(
      cdp,
      "return typeof window.__nvSmokeRelease === 'function' && Boolean(document.querySelector('.nv-btn-abort'));",
      8_000,
      200,
    );
    if (held) await cdp.evaluate("window.__nvSmokeRelease(); window.__nvSmokeRelease = null; return true;");
    const answered = held && await pollUntil<boolean>(
      cdp,
      `return [...document.querySelectorAll('.nv-uplink-assistant .nv-uplink-text')]
         .some((e) => e.textContent.includes('Use dw.'));`,
      10_000,
      300,
    );
    const roles = await cdp.evaluate<string[]>(`
      return [...document.querySelectorAll('.nv-uplink-line')].map((l) =>
        l.classList.contains('nv-uplink-user') ? 'user'
        : l.classList.contains('nv-uplink-error') ? 'error' : 'assistant');
    `);
    record(
      "R3-3 ein voller Turn landet als Antwort",
      answered === true && roles.join(",") === "user,assistant",
      !held ? "zweiter Turn startete nicht (kein Stub-Halt / kein CUT-Knopf)"
        : answered === true ? `Zeilen: ${roles.join(", ")}` : "Antwort 'Use dw.' erschien nicht",
    );
  } finally {
    // Stub zurückbauen. Der Kanal bleibt geleert — das ist Sitzungszustand, nichts
    // Persistiertes (ChatSession wird bewusst nicht gespeichert).
    await cdp
      .evaluate(`
        const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
        const r = window.__nvSmokeRestore;
        if (p && r) {
          p.cipherClient.stream = r.stream;
          p.endpointResolver.resolve = r.resolve;
          p.endpointResolver.invalidate = r.invalidate;
          p.settings.llmEndpoints = r.endpoints;
          p.settings.llmModel = r.model;
          p.cipherUplink = null;
          p.cipherSession.reset();
        }
        delete window.__nvSmokeRestore;
        delete window.__nvSmokeSawModel;
        delete window.__nvSmokeRelease;
        return true;
      `)
      .catch(() => undefined);
  }
}

// --- Hauptlauf ---------------------------------------------------------------

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main(): Promise<void> {
  if (process.argv.includes("--setup")) {
    setupStagingVault();
    return;
  }
  const port = Number(arg("port", "9222"));
  const vault = arg("vault");

  let cdp: Cdp | null = null;
  /** Vorwert außerhalb des try — er muss auch nach einem Abbruch zurückgestellt werden. */
  let collapsedBefore: unknown = null;
  // Ein SIGINT mitten im Lauf ueberspringt die einzelnen `finally`-Bloecke in
  // checkMasteryTier/checkCipherUplink NICHT im try/catch-Sinn, sondern beendet den
  // Node-Prozess sofort, bevor sie je erreicht werden. Vier Zustandssorten ueberleben das
  // sonst dauerhaft — bis zum naechsten Obsidian-Neustart, fuer die gesamte Instanz sichtbar:
  //  · Theme/Farbschema (R4-4) haengt im falschen Kombinationszustand fest.
  //  · Der CIPHER-Stub (R3) ersetzt `cipherClient`/`endpointResolver` dauerhaft — ein echter
  //    Uplink-Aufruf landete beim gestubbten Fake-Client statt beim echten Server.
  //  · Eine aktive Mission haelt Vim-Modus/Editor-Capture fest (globale Tastatur-Wirkung).
  //  · `uiCollapsed` bleibt auf dem waehrend R2-2 gesetzten Testwert stehen.
  // Alle vier Wiederherstellungen sind idempotent (jede prueft ihre Vorbedingung selbst), die
  // Werte liegen als window-Globals (nicht als Node-Closures) — nur so erreicht sie ein
  // Handler, der unabhaengig davon feuert, WELCHE Pruef-Funktion gerade lief.
  let signalCleanupRunning = false;
  const onAbortSignal = (signal: NodeJS.Signals): void => {
    if (signalCleanupRunning || !cdp) return;
    signalCleanupRunning = true;
    const liveCdp = cdp;
    void (async () => {
      console.log(`\n\nAbbruch durch ${signal} — raeume Testzustand auf...`);
      await liveCdp.evaluate(`
        const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
        const tb = window.__nvSmokeThemeBefore;
        if (p && tb) { p.settings.colorScheme = tb.scheme; await p.saveSettings(); app.vault.setConfig('theme', tb.theme); app.workspace.trigger('css-change'); }
        const r = window.__nvSmokeRestore;
        if (p && r) {
          p.cipherClient.stream = r.stream;
          p.endpointResolver.resolve = r.resolve;
          p.endpointResolver.invalidate = r.invalidate;
          p.settings.llmEndpoints = r.endpoints;
          p.settings.llmModel = r.model;
          p.cipherUplink = null;
          p.cipherSession.reset();
        }
        if (p && p.session && p.session.activeMissionId) { p.session.end(); p.restoreVim(); p.repaint(); }
        for (const leaf of app.workspace.getLeavesOfType('markdown')) {
          if (p && leaf.view?.file?.path?.startsWith(p.settings.missionFolder)) leaf.detach();
        }
        const cb = window.__nvSmokeCollapsedBefore;
        if (p && cb) { p.settings.uiCollapsed = cb; await p.saveSettings?.(); }
        app.workspace.detachLeavesOfType(${JSON.stringify(HUB_VIEW)});
        delete window.__nvSmokeThemeBefore;
        delete window.__nvSmokeRestore;
        delete window.__nvSmokeSawModel;
        delete window.__nvSmokeRelease;
        delete window.__nvSmokeCollapsedBefore;
        return true;
      `).catch(() => { console.log("  ! Aufraeumen im Renderer fehlgeschlagen — Vault von Hand pruefen (Theme, Vim-Modus, UPLINK-Stub)"); });
      liveCdp.close();
      process.exit(130);
    })();
  };
  try {
    cdp = await attachTo("workspace", port, vault);
    if (!cdp) {
      throw new PreconditionError(
        `Kein Obsidian-Fenster auf Port ${port}${vault ? ` mit Vault "${vault}"` : ""}.\n`
        + `   Obsidian mit offenem Debug-Port starten:\n`
        + `   osascript -e 'quit app "Obsidian"' && open -a Obsidian --args --remote-debugging-port=${port}`,
      );
    }
    process.on("SIGINT", onAbortSignal);
    process.on("SIGTERM", onAbortSignal);
    // Chromium drosselt nicht-fokussierte Fenster: ohne das ist das DOM leer und der
    // Lauf misst ein Phantom. Page.bringToFront reicht auf macOS nicht.
    try {
      execFileSync("osascript", ["-e", 'tell application "Obsidian" to activate']);
    } catch {
      console.warn("   (konnte Obsidian nicht nach vorn holen — Messwerte könnten leer sein)");
    }
    await new Promise((r) => setTimeout(r, 1500));

    await requireEnvironment(cdp, vault);
    if (process.argv.includes("--reload")) {
      // Für die Gegenprobe: neu deployten Code übernehmen, ohne Obsidian neu zu starten
      // (ein Neustart würde den Debug-Port wieder schließen).
      console.log("   Plugin wird neu geladen…");
      await cdp.evaluate(`
        await app.plugins.disablePlugin(${JSON.stringify(PLUGIN_ID)});
        await app.plugins.enablePlugin(${JSON.stringify(PLUGIN_ID)});
        await new Promise((r) => setTimeout(r, 1200));
        return true;
      `);
      // Gemessen 2026-08-19: `disablePlugin`/`enablePlugin` laedt zwar `main.js` neu,
      // liest `manifest.json` aber NICHT — die gemeldete Version bleibt die vom
      // App-Start. Die Nummer taugt deshalb nicht als Beleg dafuer, welcher Stand
      // laeuft. Was sie kann: den Unterschied sichtbar machen, damit niemand sie
      // faelschlich als Beleg nimmt.
      const loaded = await cdp.evaluate<string>(
        `return app.plugins.manifests[${JSON.stringify(PLUGIN_ID)}]?.version ?? '?';`,
      );
      const onDisk = JSON.parse(readFileSync("manifest.json", "utf8")).version;
      if (loaded !== onDisk) {
        console.log(
          `   ⚠️  Manifest-Version: Obsidian meldet ${loaded}, deployt ist ${onDisk}.\n`
          + `      Der Code AUS main.js ist neu geladen; nur das Manifest bleibt bis zum\n`
          + `      naechsten Obsidian-Neustart auf dem alten Stand. Kein Befund am Plugin.`,
        );
      } else {
        console.log(`   Neu geladen: ${PLUGIN_ID} ${loaded}`);
      }
    }
    // C0 — ein liegen gebliebener CIPHER-Stub aus einem per Ctrl-C abgebrochenen Vorlauf
    // (vor diesem Handler bzw. bei einem SIGKILL) waere sonst still UND gefaehrlich: wuerde
    // R3 spaeter unbesehen ueber ihn druebersetzen, capturete es die STUB-Funktionen als
    // "Original" und die Instanz bliebe bis zum Obsidian-Neustart permanent gestubbt. Deshalb
    // hier aktiv zurueckbauen, nicht nur melden.
    const staleStub = await cdp.evaluate<boolean>(`
      const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
      const r = window.__nvSmokeRestore;
      if (!p || !r) return false;
      p.cipherClient.stream = r.stream;
      p.endpointResolver.resolve = r.resolve;
      p.endpointResolver.invalidate = r.invalidate;
      p.settings.llmEndpoints = r.endpoints;
      p.settings.llmModel = r.model;
      p.cipherUplink = null;
      p.cipherSession.reset();
      delete window.__nvSmokeRestore;
      delete window.__nvSmokeSawModel;
      delete window.__nvSmokeRelease;
      return true;
    `);
    record(
      "C0 Kein liegen gebliebener CIPHER-Stub aus einem abgebrochenen Vorlauf",
      !staleStub,
      staleStub ? "Stub aus einem Vorlauf gefunden und zurueckgebaut" : "kein Rest gefunden",
    );

    collapsedBefore = await cdp.evaluate<unknown>(
      `const b = JSON.parse(JSON.stringify(app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}].settings.uiCollapsed || {}));
       window.__nvSmokeCollapsedBefore = b; return b;`,
    );
    await closeExtraLeaves(cdp);
    await openHub(cdp);

    await checkTabWrap(cdp);

    if (!(await selectTab(cdp, "ARCHIVE"))) {
      throw new PreconditionError("ARCHIVE-Tab nicht gefunden — falsche Plugin-Version deployt?");
    }
    await checkCollapse(cdp);
    await checkCardAlignment(cdp);
    await checkReader(cdp);
    await checkMasteryTier(cdp, vault);
    await checkCipherUplink(cdp);
  } catch (err) {
    if (err instanceof PreconditionError) {
      console.error(`\n⛔ Abbruch — Voraussetzung nicht erfüllt:\n   ${err.message}\n`);
      console.error("   Das ist KEIN Befund am Plugin. Nichts wurde gemessen.\n");
      process.exitCode = 2;
      return;
    }
    throw err;
  } finally {
    if (cdp) {
      // Die Hub-Blätter, die dieser Lauf geöffnet hat, wieder abräumen — sonst wächst
      // ihre Zahl mit jedem Lauf (gemessen: 16 nach mehreren Durchläufen).
      await cdp
        .evaluate(`app.workspace.detachLeavesOfType(${JSON.stringify(HUB_VIEW)}); return true;`)
        .catch(() => undefined);
    }
    if (cdp && collapsedBefore !== null) {
      // Vorwert zurück: der Treiber klappt Gruppen zu und darf den Vault so nicht lassen.
      await cdp
        .evaluate(`
          const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
          p.settings.uiCollapsed = ${JSON.stringify(collapsedBefore)};
          await p.saveSettings?.();
          return true;
        `)
        .catch(() => undefined);
    }
    cdp?.close();
    // Abmelden, sonst haengt ein SPAETES Signal (nach normalem Abschluss, cdp schon zu) den
    // Prozess in onAbortSignal an einer toten Verbindung auf.
    process.off("SIGINT", onAbortSignal);
    process.off("SIGTERM", onAbortSignal);
  }

  const gruen = checks.filter((c) => c.status === "gruen").length;
  const rot = checks.filter((c) => c.status === "rot").length;
  const uebersprungen = checks.filter((c) => c.status === "uebersprungen");
  console.log(
    `\n${gruen} grün · ${uebersprungen.length} übersprungen · ${rot} rot (von ${checks.length} Prüfpunkten)`,
  );
  // Die Gründe gehören in die Schlusszeile, nicht nur ins Protokoll: wer nur das Ende
  // liest, soll sehen, WAS ungemessen blieb — ein Punkt, der jedes Mal übersprungen wird,
  // sieht in der Historie sonst aus wie einer, der jedes Mal hält.
  for (const c of uebersprungen) console.log(`   ⏭️  ${c.name} — ${c.detail}`);
  // Ein Skip ist kein Fehlschlag, nur kein Erfolg — der Exit-Code bleibt daran grün.
  if (rot > 0) process.exitCode = 1;
}

void main();
