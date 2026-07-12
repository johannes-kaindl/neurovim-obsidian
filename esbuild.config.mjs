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
  // CM6 packages are provided by Obsidian at runtime — must stay external so we
  // don't bundle a second CodeMirror instance (would break editor integration).
  external: [
    'obsidian', 'electron',
    '@codemirror/state', '@codemirror/view',
    ...builtins,
  ],
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
