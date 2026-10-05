/**
 * Sequenz-Aufnahme fuer neurovim-obsidian — Mission M-08 als Bildfolge mit Eingabe-Log.
 *
 * Was eine Sequenz zeigen muss, steht in `docs/images/README.md` § Sequenzen (Aufnahme-Vertrag);
 * dieser Treiber ist das Rezept. Bruecke und Log-Vertrag: `tools/obsidian-cdp/README.md` § Sequenz.
 *
 * ## Ablauf (Zweitinstanz, eigener Port, Lock je Port — Dach-AGENTS.md § Staging-Vaults)
 *
 * ```bash
 * npm run sequenz -- --setup                      # Vault bauen (mit Theme Birds of Yore, Schrift 20 px)
 * # Zweitinstanz starten (Profil, .asar, obsidian.json, Lock) — siehe docs/images/README.md § Reproduktion
 * npm run sequenz -- --vault neurovim-obsidian --port 9360 --sequenz m08-hero
 * npm run sequenz -- --vault neurovim-obsidian --port 9360 --sequenz m08-voll --ohne-video
 * npm run sequenz -- --port 9360 --beenden        # eigene Zweitinstanz beenden
 * ```
 *
 * Ergebnis: `out/sequenz/<name>/` (Einzelbilder, eingaben.jsonl, sequenz.json; gitignored) und fuer
 * `m08-hero` zusaetzlich `docs/images/hero-demo.gif` + `.mp4` (Klasse hero-video).
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Cdp, attachTo, closeExtraLeaves, pollUntil } from "../../tools/obsidian-cdp/cdp.js";
import { boxAround, setWindowSize } from "../../tools/obsidian-cdp/shot.js";
import { buildVault, stagingVaultDir } from "../../tools/obsidian-cdp/vault.js";
import { konkatListe, sequenzZuGif, sequenzZuMp4, type Schritt } from "../../tools/obsidian-cdp/sequenz.js";
import { aufnehmen, ergebnisSchreiben, messzeile } from "../../tools/obsidian-cdp/sequenz-aufnahme.js";
import { PLUGIN_ID, PreconditionError, prepareInstance, sleep } from "./instanz.js";

const REPO_ROOT = process.cwd();
const FIXTURE_DIR = join(REPO_ROOT, "docs/images/fixture");
const IMAGES_DIR = join(REPO_ROOT, "docs/images");
const THEME_NAME = "Birds of Yore";
const BASE_FONT_SIZE = 20;
/** Aus readme-spec.json images.hero_video — gespiegelt, nicht erfunden. */
const VIDEO = { fps: 24, width: 800, gifKb: 2048 };
const ANSCHLAG = 0.1;
const VORHALT = 0.8;
/** Standardmodus — wird in Plan C, Task 4 nach der Messung gesetzt. */
const MODUS_STANDARD: "schritt" | "screencast" = "schritt";

/** Spielstand: Level 2 (ab 66 XP), M-01 bis M-07 erledigt, M-08 frei — der Hub zeigt die Mission offen. */
const SPIELSTAND = {
  total_xp: 140,
  completed_missions: ["M-01", "M-02", "M-03", "M-04", "M-05", "M-06", "M-07"],
  unlocked: ["M-01", "M-02", "M-03", "M-04", "KATA-01", "M-05", "M-06", "M-07", "M-08", "LOOT-01"],
};

const ZEILE_HERO_VORHER = "Once upon a ██████████ dreary, while I pondered, weak and weary,";
const ZEILE_HERO_NACHHER = "Once upon a midnight dreary, while I pondered, weak and weary,";
const ZEILE_ZWEI_NACHHER = "Eagerly I wished the morrow;—vainly I had sought to borrow";

const submit = async (k: { evaluate: <T>(a: string) => Promise<T> }): Promise<void> => {
  await k.evaluate(`app.commands.executeCommandById(${JSON.stringify(`${PLUGIN_ID}:submit`)}); return true;`);
};

const HERO: Schritt[] = [
  { key: "ESC", kind: "key", target: "editor", halt: 0.6 },
  { key: "3w", kind: "text", target: "editor", halt: 0.7 },
  { key: "ciw", kind: "text", target: "editor", halt: 0.5 },
  { key: "midnight", kind: "text", target: "editor", halt: 0.4 },
  { key: "ESC", kind: "key", target: "editor", halt: 1.2 },
];

/** Voller Durchlauf: beide Korruptionen, dann SUBMIT ueber den Plugin-Befehl (kein Tastaturereignis). */
const VOLL: Schritt[] = [
  ...HERO.slice(0, 4),
  { key: "ESC", kind: "key", target: "editor", halt: 0.6 },
  { key: "9j", kind: "text", target: "editor", halt: 0.5 },
  { key: "0", kind: "key", target: "editor", halt: 0.3 },
  { key: "4W", kind: "text", target: "editor", halt: 0.6 },
  { key: "8s", kind: "text", target: "editor", halt: 0.5 },
  { key: "morrow", kind: "text", target: "editor", halt: 0.4 },
  { key: "ESC", kind: "key", target: "editor", halt: 0.8 },
  { key: "SUBMIT", kind: "key", target: "hud", halt: 2.5, aktion: submit },
];

interface Sequenz { name: string; schritte: Schritt[]; soll: (cdp: Cdp) => Promise<string | null>; video: boolean }

const SEQUENZEN: Sequenz[] = [
  {
    name: "m08-hero", schritte: HERO, video: true,
    soll: async (cdp) => {
      const zeile = await textDerZeile(cdp, "Once upon a");
      return zeile === ZEILE_HERO_NACHHER ? null : `Zeile lautet ${JSON.stringify(zeile)}, erwartet ${JSON.stringify(ZEILE_HERO_NACHHER)}`;
    },
  },
  {
    name: "m08-voll", schritte: VOLL, video: false,
    soll: async (cdp) => {
      const eins = await textDerZeile(cdp, "Once upon a");
      const zwei = await textDerZeile(cdp, "Eagerly I wished");
      if (eins !== ZEILE_HERO_NACHHER) return `Zeile 1 lautet ${JSON.stringify(eins)}`;
      if (zwei !== ZEILE_ZWEI_NACHHER) return `Zeile 2 lautet ${JSON.stringify(zwei)}`;
      const modal = await pollUntil<boolean>(cdp, "return document.querySelector('.nv-result') ? true : null;", 10_000, 300);
      return modal ? null : "Result-Modal (.nv-result) erschien nach SUBMIT nicht";
    },
  },
];

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1]?.startsWith("--") ? process.argv[i + 1] : fallback;
}

// --- Zustand herstellen ------------------------------------------------------

async function textDerZeile(cdp: Cdp, beginn: string): Promise<string> {
  return cdp.evaluate<string>(`
    const cm = app.workspace.activeLeaf.view.editor.cm;
    const doc = cm.state.doc;
    for (let i = 1; i <= doc.lines; i++) { const l = doc.line(i); if (l.text.startsWith(${JSON.stringify(beginn)})) return l.text; }
    return "";
  `);
}

/** Cursor an den Anfang der Hero-Zeile, Zeile mittig, Editor fokussiert. */
async function cursorAufHeroZeile(cdp: Cdp): Promise<void> {
  const ok = await cdp.evaluate<boolean>(`
    const cm = app.workspace.activeLeaf.view.editor.cm;
    const doc = cm.state.doc;
    let pos = -1;
    for (let i = 1; i <= doc.lines; i++) { const l = doc.line(i); if (l.text.startsWith("Once upon a")) { pos = l.from; break; } }
    if (pos < 0) return false;
    cm.dispatch({ selection: { anchor: pos } });
    const block = cm.lineBlockAt(pos);
    cm.scrollDOM.scrollTop = Math.max(0, block.top - cm.scrollDOM.clientHeight / 2);
    cm.focus();
    await new Promise((r) => setTimeout(r, 400));
    return Boolean(document.activeElement && cm.contentDOM.contains(document.activeElement));
  `);
  if (!ok) throw new PreconditionError("Hero-Zeile nicht gefunden oder Editor ohne Fokus.");
}

async function missionStarten(cdp: Cdp): Promise<void> {
  await cdp.evaluate(`
    const p = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    p.handleAbandon?.();
    await new Promise((r) => setTimeout(r, 400));
    Object.assign(p.data, ${JSON.stringify(SPIELSTAND)});
    await p.saveData(p.data);
    p.settings.colorScheme = 'crt';
    p.settings.hudPlacement = 'box';
    await p.saveSettings?.();
    app.workspace.detachLeavesOfType('neurovim-hub');
    await new Promise((r) => setTimeout(r, 300));
    await p.beginMission('M-08');
    await new Promise((r) => setTimeout(r, 1500));
    return true;
  `);
  const hud = await pollUntil<boolean>(cdp, "return document.querySelector('.nv-hud') ? true : null;", 20_000, 500);
  if (!hud) throw new PreconditionError("HUD (.nv-hud) erschien nach beginMission('M-08') nicht.");
  const vorher = await textDerZeile(cdp, "Once upon a");
  if (vorher !== ZEILE_HERO_VORHER) throw new PreconditionError(`Missionsnotiz zeigt ${JSON.stringify(vorher)}, erwartet ${JSON.stringify(ZEILE_HERO_VORHER)}.`);
  await cursorAufHeroZeile(cdp);
}

async function themePruefen(cdp: Cdp): Promise<void> {
  const theme = await cdp.evaluate<string>("return app.customCss?.theme ?? '';");
  if (theme !== THEME_NAME) throw new PreconditionError(`Theme ist ${JSON.stringify(theme)}, erwartet ${JSON.stringify(THEME_NAME)} — \`npm run sequenz -- --setup\` und Zweitinstanz neu starten.`);
}

async function herkunft(cdp: Cdp): Promise<Record<string, unknown>> {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "manifest.json"), "utf-8")) as { version: string };
  const theme = JSON.parse(readFileSync(join(FIXTURE_DIR, "theme.json"), "utf-8")) as Record<string, string>;
  const obsidian = await cdp.evaluate<string>("return (window.require('electron').remote.app.getVersion());");
  return {
    repo: "neurovim-obsidian", commit, plugin_version: manifest.version, license: "AGPL-3.0-or-later",
    mission: "M-08", theme: { ...theme }, obsidian_version: obsidian, fixture: "docs/images/fixture",
    inhalt: "Missionstext aus src/vendor/neurovim (AGPL-3.0-or-later); Gedichtzeilen Edgar Allan Poe, The Raven (gemeinfrei)",
  };
}

// --- Hauptlauf ---------------------------------------------------------------

async function setup(): Promise<void> {
  const vaultDir = stagingVaultDir("neurovim-obsidian");
  const log = buildVault({ repoRoot: REPO_ROOT, vaultDir, fixtureDir: FIXTURE_DIR, pluginId: PLUGIN_ID, generator: "make-theme.mjs" });
  log.forEach((l) => console.log(`   ${l}`));
  for (const f of ["workspace.json", join("plugins", PLUGIN_ID, "data.json")]) {
    const p = join(vaultDir, ".obsidian", f);
    if (existsSync(p)) { rmSync(p); console.log(`   entfernt: .obsidian/${f}`); }
  }
  // Theme und Schriftgroesse der Sequenz: Obsidian liest beides beim Start.
  const patch = (datei: string, werte: Record<string, unknown>): void => {
    const p = join(vaultDir, ".obsidian", datei);
    const alt = existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown> : {};
    writeFileSync(p, JSON.stringify({ ...alt, ...werte }, null, 2) + "\n");
    console.log(`   ${datei}: ${Object.entries(werte).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}`);
  };
  patch("appearance.json", { cssTheme: THEME_NAME });
  patch("app.json", { baseFontSize: BASE_FONT_SIZE });
  console.log(`\n✅ Vault gebaut: ${vaultDir}\n   Jetzt die Zweitinstanz (neu) starten, dann ohne --setup aufrufen.`);
}

async function beenden(port: number, vault: string): Promise<void> {
  const cdp = await attachTo("workspace", port, vault);
  if (!cdp) { console.log(`Kein Fenster mit Vault "${vault}" auf Port ${port} — nichts zu beenden.`); return; }
  await cdp.evaluate("setTimeout(() => window.require('electron').remote.app.quit(), 200); return true;").catch(() => undefined);
  cdp.close();
  console.log(`Zweitinstanz auf Port ${port} beendet (app.quit).`);
}

function statSizeKb(p: string): number {
  return Math.round(statSync(p).size / 1024);
}

async function main(): Promise<void> {
  if (process.argv.includes("--setup")) { await setup(); return; }
  const port = Number(arg("port", "9360"));
  const vault = arg("vault", "neurovim-obsidian") as string;
  if (process.argv.includes("--beenden")) { await beenden(port, vault); return; }

  const name = arg("sequenz", "m08-hero");
  const sequenz = SEQUENZEN.find((s) => s.name === name);
  if (!sequenz) { console.error(`Unbekannte Sequenz ${name}; bekannt: ${SEQUENZEN.map((s) => s.name).join(", ")}`); process.exitCode = 2; return; }
  const modus = (arg("modus", MODUS_STANDARD) as "schritt" | "screencast");
  const outDir = join(REPO_ROOT, arg("out", "out/sequenz") as string, sequenz.name);

  const cdp = await attachTo("workspace", port, vault);
  if (!cdp) {
    console.error(`⛔ Kein Obsidian-Fenster auf Port ${port} mit Vault "${vault}". Zweitinstanz starten (docs/images/README.md § Reproduktion).`);
    process.exitCode = 2;
    return;
  }
  try {
    await prepareInstance(cdp);
    const loaded = await cdp.evaluate<boolean>(`return Boolean(app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]);`);
    if (!loaded) throw new PreconditionError(`Plugin "${PLUGIN_ID}" ist im Vault "${vault}" nicht aktiv.`);
    await themePruefen(cdp);
    await setWindowSize(cdp, 1280, 860);
    await closeExtraLeaves(cdp);
    await missionStarten(cdp);   // setzt Spielstand, Schema crt, HUD-Platzierung box

    // Pre-Roll: `i` vor der Aufnahme, nicht im Log — die Sequenz beginnt im Einfuegemodus.
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "i", code: "KeyI", windowsVirtualKeyCode: 73, text: "i", unmodifiedText: "i" });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "i", code: "KeyI", windowsVirtualKeyCode: 73 });
    await sleep(500);

    const clip = await boxAround(cdp, [".workspace-leaf.mod-active .cm-editor", ".nv-float-hud-container"], 8);
    if (!clip) throw new PreconditionError("Zuschnitt (Editor + HUD-Box) nicht bestimmbar.");

    const ergebnis = await aufnehmen(cdp, sequenz.name, sequenz.schritte, {
      outDir, modus, clip, scale: 2, anschlag: ANSCHLAG, vorhalt: VORHALT, herkunft: await herkunft(cdp),
    });
    const fehler = await sequenz.soll(cdp);
    if (fehler) throw new PreconditionError(`Sequenz ${sequenz.name} hat nicht gewirkt: ${fehler}`);
    console.log(`✅ ${ergebnisSchreiben(outDir, ergebnis)}`);
    console.log(`   ${messzeile(join(outDir, "sequenz.json"))}`);

    if (sequenz.video && modus === "schritt" && !process.argv.includes("--ohne-video")) {
      const liste = konkatListe(ergebnis.bilder.map((b) => ({ datei: b.datei, t: b.t })), ergebnis.dauer, VIDEO.fps);
      const gif = join(IMAGES_DIR, "hero-demo.gif");
      console.log(`   ${sequenzZuGif(outDir, liste, gif, VIDEO)}`);
      console.log(`   ${sequenzZuMp4(outDir, liste, join(IMAGES_DIR, "hero-demo.mp4"), VIDEO)}`);
      if (existsSync(gif) && statSizeKb(gif) > VIDEO.gifKb) console.log(`⚠️  hero-demo.gif ${statSizeKb(gif)} KB, Budget ${VIDEO.gifKb} KB — kuerzere Halte oder weniger Bilder`);
    }
    console.log("\nJetzt die Bilder ANSEHEN — der Standard prueft die Form, nie die Aussage.");
  } catch (err) {
    if (err instanceof PreconditionError) {
      console.error(`\n⛔ Abbruch — Voraussetzung nicht erfuellt:\n   ${err.message}\n`);
      process.exitCode = 2;
      return;
    }
    throw err;
  } finally {
    await cdp.evaluate(`app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]?.handleAbandon?.(); return true;`).catch(() => undefined);
    cdp.close();
  }
}

void main();
