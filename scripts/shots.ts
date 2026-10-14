/**
 * README-Bilder aufnehmen — fährt ein laufendes Obsidian per CDP, stellt je Bild den
 * Zustand her und schreibt nach `docs/images/`.
 *
 * Was WELCHES Bild zeigen muss, steht in `docs/images/README.md` (Aufnahme-Vertrag) —
 * dieser Treiber ist nur das Rezept dazu. Der Standard (Klassen, Maße, Budgets) liegt
 * zentral in `_docs/readme/readme-spec.json` und wird hier nie dupliziert.
 *
 * ## Ablauf (Zweitinstanz, eigener Port, Lock je Port — Dach-AGENTS.md § Staging-Vaults)
 *
 * Kein Quit und kein Neustart der regulaeren Instanz. Das Rezept (Profil, `.asar`, `obsidian.json`,
 * Lock) steht in `docs/images/README.md` § Reproduktion. `--port` ist Pflicht.
 *
 * ```bash
 * npm run shots -- --setup                              # Vault bauen
 * # Zweitinstanz starten (eigenes Profil, eigener Port, Lock), dann:
 * npm run shots -- --vault neurovim-obsidian --port <port>
 * npm run shots -- --vault neurovim-obsidian --port <port> --only hero
 * ```
 *
 * ⚠️ Der Aufnahme-Vault ist NICHT der Arbeits-Vault. Alles, was hier in ein Bild gerät,
 * geht mit dem Repo um die Welt — deshalb generische, englische Fixture-Inhalte.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { Cdp, attachTo, bereiteInstanzVor, closeExtraLeaves, pollUntil, schliesseDialog } from "../../tools/obsidian-cdp/cdp.js";
import { startLlmStub } from "../../tools/obsidian-cdp/llm-stub.js";
import { Vorbedingung } from "../../tools/obsidian-cdp/bilanz.js";
import { boxOf, capture, setWindowSize, writeShot, type Rect } from "../../tools/obsidian-cdp/shot.js";
import { buildVault, stagingVaultDir } from "../../tools/obsidian-cdp/vault.js";

const PLUGIN_ID = "neurovim";
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const HUB_VIEW = "neurovim-hub";
/** npm-Scripts laufen im Repo-Root. Nicht aus `import.meta.url` ableiten: das gebündelte
 *  `.shots.mjs` liegt selbst im Root, ein `..` darauf zeigt eine Ebene zu hoch. */
const REPO_ROOT = process.cwd();
const FIXTURE_DIR = join(REPO_ROOT, "docs/images/fixture");
const OUT_DIR = join(REPO_ROOT, "docs/images");
/** Aus `_docs/readme/readme-spec.json` § images — hier gespiegelt, nicht erfunden. */
const CAPTURE_WIDTH = 1200;
const THUMB_WIDTH = 380;

/**
 * Spielstand für die Aufnahme. Ein Mittelstand ist Absicht: bei null XP ist alles
 * gesperrt, bei vollem Fortschritt alles offen — beides zeigt die Progression nicht,
 * um die es in `missions.png` und `archive.png` geht.
 */
const SHOWCASE_STATE = {
  total_xp: 140,
  completed_missions: ["M-01", "M-02", "M-03"],
  unlocked: ["M-01", "M-02", "M-03", "M-04", "KATA-01", "M-05", "LOOT-01"],
};

const FAKE_MODEL = "qwen3-8b";
const CIPHER_QUESTION = "What does the w motion do?";
const CIPHER_ANSWER = "Easy: w jumps you to the start of the next word. Prefix a count, like 3w, to hop three words at once. Try it on the intercept: fewer keystrokes, cleaner trace.";

interface FakeEndpoint { url: string; close: () => Promise<void> }

/** Fake LLM endpoint on the central LLM stub: no model runs, the answer is fixed and generic. The
 *  UI is real, only the words are canned. A free port chosen by the OS, never a standard port: a
 *  fixed one would block whatever else wants it (voicelab serves on 8766). `kontext` serves
 *  `/api/v0/models` like LM Studio, so the endpoint row shows its context line. */
async function startFakeEndpoint(): Promise<FakeEndpoint> {
  const stub = await startLlmStub({
    models: [FAKE_MODEL],
    kontext: { geladen: 8192, max: 32768 },
    standard: CIPHER_ANSWER,
    teile: 2,
  });
  return { url: stub.url, close: () => stub.stop() };
}

/** Point the plugin at the fake endpoint (local list; no endpoint manager in the recording vault). */
async function useFakeEndpoint(cdp: Cdp, fake: FakeEndpoint): Promise<void> {
  await cdp.evaluate(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    p.settings.llmEndpoints = [{ url: ${JSON.stringify(fake.url)}, model: ${JSON.stringify(FAKE_MODEL)} }];
    p.llm.invalidate();
    await p.saveSettings();
    await new Promise((r) => setTimeout(r, 500));
    return true;
  `);
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// --- Zustand herstellen ------------------------------------------------------

async function applyShowcaseState(cdp: Cdp): Promise<void> {
  await cdp.evaluate(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    Object.assign(p.data, ${JSON.stringify(SHOWCASE_STATE)});
    await p.saveData(p.data);
    p.settings.colorScheme = 'crt';
    await p.saveSettings?.();
    await new Promise((r) => setTimeout(r, 400));
    return true;
  `);
}

/** Hub in der rechten Sidebar öffnen. Räumt vorher ab — siehe gui-smoke.ts. */
async function openHub(cdp: Cdp): Promise<void> {
  await cdp.evaluate(`
    app.workspace.detachLeavesOfType(${JSON.stringify(HUB_VIEW)});
    await new Promise((r) => setTimeout(r, 300));
    const leaf = app.workspace.getRightLeaf(true);
    await leaf.setViewState({ type: ${JSON.stringify(HUB_VIEW)}, active: true });
    app.workspace.revealLeaf(leaf);
    return true;
  `);
  const ready = await pollUntil<boolean>(cdp, "return Boolean(document.querySelector('.nv-tabs'));", 20_000, 500);
  if (!ready) throw new Vorbedingung("Hub-Pane öffnete sich nicht.");
  // Sidebar breit genug, dass die Karten lesbar sind — das Panel ist der Bildgegenstand.
  await cdp.evaluate(`
    const s = app.workspace.rightSplit;
    if (s.setSize) s.setSize(420);
    await new Promise((r) => setTimeout(r, 500));
    return true;
  `);
}

async function selectTab(cdp: Cdp, label: string): Promise<void> {
  const ok = await cdp.evaluate<boolean>(`
    const btn = [...document.querySelectorAll('.nv-tabs .nv-tab')]
      .find((b) => b.textContent.trim() === ${JSON.stringify(label)});
    if (!btn) return false;
    btn.click();
    await new Promise((r) => setTimeout(r, 800));
    return true;
  `);
  if (!ok) throw new Vorbedingung(`Tab "${label}" nicht gefunden.`);
}

// --- Die einzelnen Bilder ----------------------------------------------------

type Shot = { name: string; run: (cdp: Cdp, ctx: { port: number; vault: string; fake: FakeEndpoint }) => Promise<Buffer | null> };

/**
 * Box eines Elements, **auf das Fenster beschnitten**.
 *
 * `boxOf` liefert die volle Ausdehnung des Elements. Bei einem scrollenden Panel ist das
 * die Hoehe seines Inhalts, nicht die des Fensters: `archive.png` entstand so mit
 * 824x4236 px, davon rund 80 % leer (gemessen 2026-08-16). Der Lauf meldet dabei Erfolg —
 * genau die Sorte Fehler, gegen die im Skill die Weissraum-Regel steht.
 */
async function visibleBox(cdp: Cdp, selector: string, padding = 0): Promise<Rect | null> {
  const box = await boxOf(cdp, selector, padding);
  if (!box) return null;
  const view = await cdp.evaluate<{ w: number; h: number }>(
    "return { w: window.innerWidth, h: window.innerHeight };",
  );
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  return {
    x, y,
    width: Math.min(box.width, view.w - x),
    height: Math.min(box.height, view.h - y),
  };
}

/** Laufende Mission beenden. Ohne das haengt das HUD in jedem Panel-Bild und die
 *  Statusleiste meldet PAUSED — ein Zustand, den kein Bild zeigen soll. */
async function endMission(cdp: Cdp): Promise<void> {
  await cdp.evaluate(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    p.handleAbandon?.();
    await new Promise((r) => setTimeout(r, 600));
    return true;
  `);
}

const SHOTS: Shot[] = [
  {
    // Das Kernversprechen: echte Notiz, echtes Vim, HUD mit Live-Werten.
    name: "hero.png",
    run: async (cdp) => {
      await cdp.evaluate(`
        const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
        await p.beginMission('M-04');   // direkt starten, ohne Briefing-Modal
        await new Promise((r) => setTimeout(r, 1800));
        return true;
      `);
      const ready = await pollUntil<boolean>(cdp, "return Boolean(document.querySelector('.nv-hud'));", 20_000, 500);
      if (!ready) return null;
      // Ein paar Zeilen korrigieren, damit der Diff-Hinweis im Bild etwas zeigt —
      // ein unangetastetes Missionsdokument sieht aus wie eine beliebige Notiz.
      await cdp.evaluate(`
        await new Promise((r) => setTimeout(r, 1200));
        return true;
      `);
      return capture(cdp);
    },
  },
  {
    name: "missions.png",
    run: async (cdp) => {
      await endMission(cdp);
      await openHub(cdp);
      await selectTab(cdp, "MISSIONS");
      const box = await visibleBox(cdp, ".nv-root", 8);
      return capture(cdp, box ?? undefined);
    },
  },
  {
    name: "archive.png",
    run: async (cdp) => {
      await endMission(cdp);
      await openHub(cdp);
      await selectTab(cdp, "ARCHIVE");
      // Loot einklappen wäre falsch — der Vertrag verlangt beide Gruppenköpfe im Bild,
      // also wird die Sidebar hoch genug gemacht statt der Inhalt versteckt.
      const box = await visibleBox(cdp, ".nv-root", 8);
      return capture(cdp, box ?? undefined);
    },
  },
  {
    name: "reader.png",
    run: async (cdp) => {
      await endMission(cdp);
      await openHub(cdp);
      await selectTab(cdp, "ARCHIVE");
      const opened = await cdp.evaluate<boolean>(`
        const card = [...document.querySelectorAll('.nv-card')].find((c) => !c.classList.contains('is-locked'));
        if (!card) return false;
        card.click();
        await new Promise((r) => setTimeout(r, 1200));
        return Boolean(document.querySelector('.nv-lore-modal'));
      `);
      if (!opened) return null;
      const box = await visibleBox(cdp, ".nv-lore-modal", 12);
      return capture(cdp, box ?? undefined);
    },
  },
  {
    name: "briefing.png",
    run: async (cdp) => {
      await schliesseDialog(cdp, { escapeRueckfall: false });   // beide Formen des Schliessen-Knopfs (1.12.4 / 1.14.4); ohne offenes Modal ein No-op
      const opened = await cdp.evaluate<boolean>(`
        await new Promise((r) => setTimeout(r, 400));
        const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
        await p.handleStart('M-01');    // oeffnet das Briefing, startet noch nicht
        // M-01 statt M-05: dessen Briefing traegt einen langen Log-Auszug, dessen
        // DIRECTIVE-Teil ausserhalb des Fensters landet — der Vertrag verlangt aber
        // genau den ableitbaren Auftrag im Bild.
        await new Promise((r) => setTimeout(r, 1200));
        return Boolean(document.querySelector('.nv-briefing-modal'));
      `);
      if (!opened) return null;
      const box = await visibleBox(cdp, ".nv-briefing-modal", 12);
      return capture(cdp, box ?? undefined);
    },
  },
  {
    name: "settings.png",
    run: async (cdp, { port, vault, fake }) => {
      await endMission(cdp);
      await useFakeEndpoint(cdp, fake);
      await cdp.evaluate(`
        app.setting.close();
        await new Promise((r) => setTimeout(r, 500));
        app.setting.open();
        await new Promise((r) => setTimeout(r, 600));
        app.setting.openTabById(${JSON.stringify(PLUGIN_ID)});
        await new Promise((r) => setTimeout(r, 900));
        return true;
      `);
      // From Obsidian 1.13 the settings are their own window without a workspace (a pop-out in a
      // second instance): the bridge needs a second CDP connection. Inline modal as fallback.
      const asModal = await cdp.evaluate<boolean>("return Boolean(document.querySelector('.modal.mod-settings'));");
      const win = asModal ? cdp : await attachTo("settings", port, vault);
      if (!win) return null;
      try {
        if (!asModal) {
          await win.send("Page.bringToFront");
          await setWindowSize(win, 1000, 1300);
          await sleep(800);
        }
        // The tab is taller than any screen: start at the "Record run traces" card (then Appearance: HUD placement,
        // colour scheme) so the CIPHER uplink section with its endpoint list follows below.
        await win.evaluate(`
          const h = [...document.querySelectorAll('.setting-item-name')].find((e) => /^\\s*Record run traces\\s*$/.test(e.textContent || ''));
          if (h) { const row = h.closest('.setting-item'); (row || h).scrollIntoView({ block: 'start' }); const c = document.querySelector('.vertical-tab-content'); if (c) c.scrollTop += 16; }
          await new Promise((r) => setTimeout(r, 500));
          return true;
        `);
        // The context line of the endpoint row arrives after the probe — wait for it, or the picture is early.
        // Bewusst weiches Warten: ohne Kontextzeile (Sonde ohne Kontext) ist das Bild trotzdem richtig, nur frueher. Darum `pollUntil` mit
        // ausgewertetem Ergebnis statt `requireUntil`, und die Wartezeit steht im Log, wenn sie ablief.
        const kontextZeile = await pollUntil<boolean>(win, "return document.querySelector('.okit-ep-context') ? true : null;", 10_000, 300).catch(() => null);
        if (kontextZeile === null) console.log("  ! settings.png: die Kontextzeile der Endpunkt-Zeile erschien in 10 s nicht — Bild ohne sie aufgenommen");
        await sleep(300);
        const box = await visibleBox(win, asModal ? ".modal.mod-settings" : ".vertical-tab-content", 0);
        return await capture(win, box ?? undefined);
      } finally {
        if (asModal) await cdp.evaluate("app.setting.close(); return true;").catch(() => undefined);
        else { await win.evaluate("window.close(); return true;").catch(() => undefined); win.close(); }
      }
    },
  },
  {
    name: "uplink.png",
    run: async (cdp, { fake }) => {
      await endMission(cdp);
      await useFakeEndpoint(cdp, fake);
      await openHub(cdp);
      // UPLINK only exists with a configured endpoint; the tab bar repaints on the next tick.
      const tab = await pollUntil<boolean>(cdp,
        "return [...document.querySelectorAll('.nv-tabs .nv-tab')].some((b) => b.textContent.trim() === 'UPLINK') || null;", 10_000, 500);
      if (!tab) return null;
      await selectTab(cdp, "UPLINK");
      await cdp.evaluate(`
        const input = document.querySelector('.nv-uplink-input');
        input.value = ${JSON.stringify(CIPHER_QUESTION)};
        document.querySelector('.nv-uplink .nv-btn-submit').click();
        return true;
      `);
      const answered = await pollUntil<boolean>(cdp,
        "return document.querySelectorAll('.nv-uplink-assistant').length > 0 && !document.querySelector('.nv-uplink-cursor') ? true : null;", 20_000, 500);
      if (!answered) return null;
      await sleep(600);
      const box = await visibleBox(cdp, ".nv-root", 8);
      return capture(cdp, box ?? undefined);
    },
  },
  {
    name: "guide.png",
    run: async (cdp) => {
      await endMission(cdp);
      await openHub(cdp);
      await selectTab(cdp, "GUIDE");
      // Mit aktiver Suche: ein ungefiltertes Cheatsheet zeigt nicht, dass es eines ist.
      await cdp.evaluate(`
        const input = document.querySelector('.nv-guide-search');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'delete');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await new Promise((r) => setTimeout(r, 800));
        return true;
      `);
      const box = await visibleBox(cdp, ".nv-root", 8);
      return capture(cdp, box ?? undefined);
    },
  },
];

// --- Hauptlauf ---------------------------------------------------------------

async function main(): Promise<void> {
  if (process.argv.includes("--setup")) {
    const vaultDir = stagingVaultDir("neurovim-obsidian");
    const log = buildVault({
      repoRoot: REPO_ROOT,
      vaultDir,
      fixtureDir: FIXTURE_DIR,
      pluginId: PLUGIN_ID,
    });
    log.forEach((l) => console.log(`   ${l}`));
    // Ein früherer Lauf darf nicht in die nächsten Bilder durchschlagen.
    for (const f of ["workspace.json", join("plugins", PLUGIN_ID, "data.json")]) {
      const p = join(vaultDir, ".obsidian", f);
      if (existsSync(p)) { rmSync(p); console.log(`   entfernt: .obsidian/${f}`); }
    }
    console.log(`\n✅ Vault gebaut: ${vaultDir}`);
    console.log("   Jetzt die Zweitinstanz (neu) starten, dann ohne --setup erneut aufrufen.");
    return;
  }

  const port = Number(arg("port", ""));
  if (!Number.isInteger(port) || port <= 0) {
    console.error("⛔ --port <port> ist Pflicht (Zweitinstanz, siehe Kopf dieser Datei); kein Standardport.");
    process.exitCode = 2;
    return;
  }
  const vault = arg("vault", "neurovim-obsidian");
  const only = arg("only");

  const cdp = await attachTo("workspace", port, vault);
  if (!cdp) {
    console.error(
      `⛔ Kein Obsidian-Fenster auf Port ${port} mit Vault "${vault}".\n`
      + `   Zweitinstanz starten (docs/images/README.md § Reproduktion), nicht die regulaere Instanz neu starten.`,
    );
    process.exitCode = 2;
    return;
  }

  let fake: FakeEndpoint | null = null;
  try {
    await bereiteInstanzVor(cdp, { pluginIds: [PLUGIN_ID], nurVault: vault, sprache: "en" });
    const loaded = await cdp.evaluate<boolean>(
      `return Boolean(app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]);`,
    );
    if (!loaded) throw new Vorbedingung(`Plugin "${PLUGIN_ID}" ist im Vault "${vault}" nicht aktiv.`);

    await setWindowSize(cdp, 1280, 860);
    await closeExtraLeaves(cdp);
    await applyShowcaseState(cdp);
    mkdirSync(OUT_DIR, { recursive: true });

    fake = await startFakeEndpoint();
    console.log(`Fake endpoint: ${fake.url} (canned answer, no model)`);
    const todo = only ? SHOTS.filter((s) => s.name.startsWith(only)) : SHOTS;
    if (todo.length === 0) throw new Vorbedingung(`Kein Bild passt auf --only ${only}`);

    for (const shot of todo) {
      try {
        const png = await shot.run(cdp, { port, vault: vault ?? "neurovim-obsidian", fake: fake as FakeEndpoint });
        if (!png) {
          console.log(`⚠️  ${shot.name} — Zustand ließ sich nicht herstellen, übersprungen`);
          continue;
        }
        const info = await writeShot(cdp, shot.name, png, {
          outDir: OUT_DIR,
          captureWidth: CAPTURE_WIDTH,
          thumbWidth: THUMB_WIDTH,
        });
        console.log(`✅ ${info}`);
      } catch (err) {
        console.log(`⚠️  ${shot.name} — ${(err as Error).message}`);
      }
    }
    console.log("\nJetzt jedes Bild ANSEHEN — der Standard prüft die Form, nie die Aussage.");
  } catch (err) {
    if (err instanceof Vorbedingung) {
      console.error(`\n⛔ Abbruch — Voraussetzung nicht erfüllt:\n   ${err.message}\n`);
      process.exitCode = 2;
      return;
    }
    throw err;
  } finally {
    if (fake) await fake.close();
    cdp.close();
  }
}

void main();
