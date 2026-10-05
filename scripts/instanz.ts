/** Gemeinsames der Treiber: Plugin-ID, Zweitinstanz vorbereiten, Abbruch mit Vorbedingung. */
import { type Cdp, pollUntil } from "../../tools/obsidian-cdp/cdp.js";

export const PLUGIN_ID = "neurovim";

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class PreconditionError extends Error {}

/** Fresh second-instance profile: confirm the "trust author" dialog, lift Restricted Mode, enable the
 *  plugin, English UI. No-op in an already prepared instance. */
export async function prepareInstance(cdp: Cdp): Promise<void> {
  await pollUntil<{ ok: boolean }>(cdp, `
    const btn = Array.from(document.querySelectorAll(".modal-container button")).find((b) => /trust|vertrau/i.test(b.textContent || ""));
    if (btn) { btn.click(); return { ok: true }; }
    return document.querySelector(".workspace") && app.plugins && app.plugins.manifests && app.plugins.manifests[${JSON.stringify(PLUGIN_ID)}] && !document.querySelector(".modal-container") ? { ok: false } : null;
  `, 20_000, 500);
  await sleep(800);
  await cdp.evaluate(`
    try { localStorage.setItem("language", "en"); } catch (e) {}
    if (app.plugins.setEnable) await app.plugins.setEnable(true);
    if (!app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}]) await app.plugins.enablePluginAndSave(${JSON.stringify(PLUGIN_ID)});
    await new Promise((r) => setTimeout(r, 1500));
    return true;
  `);
}
