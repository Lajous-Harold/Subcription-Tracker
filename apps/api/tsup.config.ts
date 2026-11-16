import { defineConfig } from 'tsup';

/** Bundle l'API et les packages du monorepo (TypeScript source) en un seul fichier ESM. */
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@subtracker\//],
});
