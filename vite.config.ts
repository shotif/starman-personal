import { defineConfig, type Plugin } from 'vite';
import { compileStory } from './scripts/ink.ts';

/**
 * Compiles ink files when they are imported, so only the ink is kept in the repository (DIALOGUE.md);
 * the files a story INCLUDEs are read from beside it, and watched.
 */
function ink(): Plugin {
  return {
    name: 'ink',
    transform(source, id) {
      if (!id.endsWith('.ink')) return null;
      const story = compileStory(id, source);
      for (const file of story.files.slice(1)) this.addWatchFile(file);
      if (story.errors.length > 0) this.error(`${id}:\n${story.errors.join('\n')}`);
      return { code: `export default ${JSON.stringify(story.json)};`, map: null };
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
