import { Compiler } from 'inkjs/full';
import { defineConfig, type Plugin } from 'vite';

/** Compiles ink files when they are imported, so only the ink is kept in the repository (DIALOGUE.md). */
function ink(): Plugin {
  return {
    name: 'ink',
    transform(source, id) {
      if (!id.endsWith('.ink')) return null;
      const compiler = new Compiler(source);
      const story = compiler.Compile();
      if (compiler.errors.length > 0) this.error(`${id}:\n${compiler.errors.join('\n')}`);
      return { code: `export default ${JSON.stringify(story.ToJson())};`, map: null };
    },
  };
}

export default defineConfig({
  // Relative asset paths so the static build works from GitHub Pages' project sub-path.
  base: './',
  plugins: [ink()],
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
