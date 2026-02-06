import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Vite plugin that reads raw source code from content/*.js at build time
 * and exposes it via a virtual module so the Code tab works after bundling.
 */
function componentSourcePlugin(): Plugin {
  const virtualModuleId = 'virtual:component-sources';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;
  const contentDir = resolve(__dirname, 'content');

  return {
    name: 'component-source-plugin',
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) return;

      const files = readdirSync(contentDir).filter((f) => f.endsWith('.js'));
      const sources: Record<string, string> = {};
      for (const file of files) {
        sources[file] = readFileSync(resolve(contentDir, file), 'utf-8');
      }
      return `export default ${JSON.stringify(sources)};`;
    },
  };
}

export default defineConfig({
  plugins: [componentSourcePlugin(), react()],
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          pixi: ['pixi.js'],
          gsap: ['gsap'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'pixi.js', 'gsap', 'zustand', 'framer-motion'],
  },
  server: {
    port: 3000,
    open: true,
  },
});
