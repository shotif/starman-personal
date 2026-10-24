import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the static build works from GitHub Pages' project sub-path.
  base: './',
  // The screens are Preact, as in Starman Control: JSX compiles to Preact's automatic runtime.
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  // Havok and Recast ship WebAssembly that must not be pre-bundled in development.
  optimizeDeps: {
    exclude: [
      '@babylonjs/havok',
      '@recast-navigation/core',
      '@recast-navigation/generators',
      '@recast-navigation/wasm',
    ],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 4000,
  },
  server: { port: 5391 },
  preview: { port: 4391 },
});
