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
 * ⚠️ Chromium drosselt nicht-fokussierte Fenster: ohne Fokus bleibt die View leer und man
 * debuggt ein Phantom. `main()` holt das Fenster deshalb aktiv nach vorn.
 */

import { execFileSync } from "node:child_process";

import { Cdp, attachTo, closeExtraLeaves, pollUntil } from "../../tools/obsidian-cdp/cdp.js";

const PLUGIN_ID = "neurovim";
/** src/HubView.tsx: VIEW_TYPE_NEUROVIM */
const HUB_VIEW = "neurovim-hub";
/** CRT-Akzent aus styles.css (.nv-crt --nv-accent). Der Reader muss ihn tragen. */
const CRT_ACCENT = "rgb(69, 255, 138)";

// --- Prüfpunkte -------------------------------------------------------------

interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(name: string, passed: boolean, detail: string): void {
  checks.push({ name, passed, detail });
  console.log(`${passed ? "✅" : "❌"} ${name} — ${detail}`);
}

function skipped(name: string, reason: string): void {
  checks.push({ name, passed: true, detail: `übersprungen: ${reason}` });
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
      if (b.scrollWidth > b.clientWidth + 1) clipped.push(b.textContent.trim());
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
    const cs = getComputedStyle(pre);
    let lh = parseFloat(cs.lineHeight);
    if (!isFinite(lh)) lh = parseFloat(cs.fontSize) * 1.2;
    const text = pre.textContent.replace(/\\n$/, '');
    return {
      found: true,
      textLines: text.split('\\n').length,
      renderedLines: Math.round(pre.scrollHeight / lh),
      copyHidden: !copy || getComputedStyle(copy).display === 'none',
    };
  `);
  if (!ascii || !ascii.found) {
    skipped("R2-4 ASCII-Rahmen brechen nicht um", "dieses Artefakt enthält keinen Code-Block");
  } else {
    // 1 Zeile Toleranz für Padding-Rundung.
    const ok = ascii.renderedLines <= ascii.textLines + 1;
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
  if (!(await selectTab(cdp, "UPLINK"))) {
    skipped("R3 CIPHER-Uplink", "UPLINK-Tab nicht gefunden");
    return;
  }

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
    p.cipherClient.stream = async (cfg, messages, onToken, signal) => {
      window.__nvSmokeSawModel = cfg && cfg.model;
      onToken('Use d');
      for (let i = 0; i < 40 && !signal.aborted; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (signal.aborted) {
        return { ok: false, kind: 'aborted', detail: 'stream aborted', partial: 'Use d' };
      }
      onToken('w.');
      return { ok: true, content: 'Use dw.' };
    };
    // Einen etwaigen zuvor gebauten Uplink verwerfen, damit er den Stub sieht.
    p.cipherUplink = null;
    return true;
  `);

  if (!patched) {
    skipped("R3 CIPHER-Uplink", "cipherClient/endpointResolver nicht am Plugin gefunden");
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
    const answered = await pollUntil<boolean>(
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
      answered === true ? `Zeilen: ${roles.join(", ")}` : "Antwort 'Use dw.' erschien nicht",
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
  const port = Number(arg("port", "9222"));
  const vault = arg("vault");

  let cdp: Cdp | null = null;
  /** Vorwert außerhalb des try — er muss auch nach einem Abbruch zurückgestellt werden. */
  let collapsedBefore: unknown = null;
  try {
    cdp = await attachTo("workspace", port, vault);
    if (!cdp) {
      throw new PreconditionError(
        `Kein Obsidian-Fenster auf Port ${port}${vault ? ` mit Vault "${vault}"` : ""}.\n`
        + `   Obsidian mit offenem Debug-Port starten:\n`
        + `   osascript -e 'quit app "Obsidian"' && open -a Obsidian --args --remote-debugging-port=${port}`,
      );
    }
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
    }
    collapsedBefore = await cdp.evaluate<unknown>(
      `return JSON.parse(JSON.stringify(app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}].settings.uiCollapsed || {}));`,
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
  }

  const passed = checks.filter((c) => c.passed).length;
  console.log(`\n${passed}/${checks.length} Prüfpunkte grün`);
  if (passed !== checks.length) process.exitCode = 1;
}

void main();
