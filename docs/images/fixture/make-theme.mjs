// Theme fuer die Sequenz-Aufnahme in den Staging-Vault legen — aus dem Schwester-Repo
// obsidian-themes, an einem festen Tag (theme.json), Inhalt und Herkunft aus derselben Ref
// (CORE-META-22). Nicht vendort: 478 KB CSS mit eingebetteten Schriften gehoeren nicht in
// ein oeffentliches Plugin-Repo; das Dach liegt beim Maintainer ohnehin daneben.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const vaultDir = process.argv[2];
if (!vaultDir) { console.error("Aufruf: node make-theme.mjs <vaultDir>"); process.exit(2); }
const hier = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(join(hier, "theme.json"), "utf-8"));
const repo = join(hier, "..", "..", "..", "..", spec.repo);
if (!existsSync(join(repo, ".git"))) {
  console.error(`Theme-Quelle fehlt: ${spec.repo} muss neben diesem Repo im Dach-Checkout liegen (${repo})`);
  process.exit(2);
}
const git = (...args) => execFileSync("git", ["-C", repo, ...args]);
const ziel = join(vaultDir, ".obsidian", "themes", spec.name);
mkdirSync(ziel, { recursive: true });
for (const datei of ["manifest.json", "theme.css"]) {
  writeFileSync(join(ziel, datei), git("show", `${spec.ref}:${spec.pfad}/${datei}`));
}
const commit = git("rev-parse", `${spec.ref}^{commit}`).toString().trim();
writeFileSync(join(ziel, "VENDOR.json"), JSON.stringify({
  source: spec.repo, ref: spec.ref, commit, path: spec.pfad, license: spec.license,
  files: ["manifest.json", "theme.css"],
}, null, 2) + "\n");
console.log(`Theme ${spec.name} aus ${spec.repo}@${spec.ref} (${commit.slice(0, 7)}) -> .obsidian/themes/`);
