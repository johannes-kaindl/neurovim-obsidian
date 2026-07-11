import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node' },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  resolve: {
    alias: {
      obsidian: new URL('./test/obsidian-mock.ts', import.meta.url).pathname,
      '@neurovim/core': new URL('./src/vendor/neurovim/core/index.ts', import.meta.url).pathname,
      '@neurovim/content': new URL('./src/vendor/neurovim/content/index.ts', import.meta.url).pathname,
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react-dom/client': 'preact/compat/client',
      'react-dom': 'preact/compat',
      'react': 'preact/compat',
    },
  },
});
