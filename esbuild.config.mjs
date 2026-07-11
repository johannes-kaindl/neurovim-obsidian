import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';

const prod = process.argv[2] === 'production';

const alias = {
  '@neurovim/core': 'src/vendor/neurovim/core/index.ts',
  '@neurovim/content': 'src/vendor/neurovim/content/index.ts',
  'react': 'preact/compat',
  'react-dom/client': 'preact/compat/client',
  'react-dom': 'preact/compat',
  'react/jsx-runtime': 'preact/jsx-runtime',
};

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', ...builtins],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  alias,
});

if (prod) { await ctx.rebuild(); process.exit(0); }
else { await ctx.watch(); console.log('watching…'); }
