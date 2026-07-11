// Vendors a pinned snapshot of @neurovim/core + @neurovim/content into
// src/vendor/neurovim/. Run from the monorepo checkout; re-run to re-pin.
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const MONO = process.env.NEUROVIM_MONOREPO ?? '/Users/Shared/code/neurovim-standalone';
const OUT = 'src/vendor/neurovim';

if (!existsSync(join(MONO, 'packages/core/src/index.ts'))) {
  console.error(`Monorepo not found at ${MONO} (set NEUROVIM_MONOREPO).`);
  process.exit(1);
}

// Ensure content is built (generated/*.ts present).
execSync('npm run build:content', { cwd: MONO, stdio: 'inherit' });

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'core'), { recursive: true });
mkdirSync(join(OUT, 'content', 'generated'), { recursive: true });

// core: whole src tree.
cpSync(join(MONO, 'packages/core/src'), join(OUT, 'core'), { recursive: true });

// content: only the runtime surface (index + generated JSON), NOT raw markdown.
cpSync(join(MONO, 'packages/content/src/index.ts'), join(OUT, 'content/index.ts'));
cpSync(join(MONO, 'packages/content/src/generated'), join(OUT, 'content/generated'), { recursive: true });

const sha = execSync('git rev-parse HEAD', { cwd: MONO }).toString().trim();
const tag = execSync('git describe --tags --abbrev=0', { cwd: MONO }).toString().trim();
const version = JSON.parse(readFileSync(join(MONO, 'package.json'))).version;
writeFileSync(join(OUT, 'VENDOR.json'), JSON.stringify({
  source: 'neurovim-standalone', tag, sha, version,
  vendored: '@neurovim/core (packages/core/src), @neurovim/content (index.ts + generated)',
  note: 'Verbatim snapshot. Never hand-edit. Re-pin via `npm run vendor`.',
}, null, 2) + '\n');

console.log(`Vendored @neurovim/core + content @ ${tag} (${sha.slice(0, 7)}).`);
