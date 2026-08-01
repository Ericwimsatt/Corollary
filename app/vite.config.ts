import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/content/index.tsx'),
      output: {
        entryFileNames: 'assets/content.js',
        format: 'iife',
      },
    },
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        copyFileSync('manifest.json', 'dist/manifest.json');
      },
    },
  ],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
