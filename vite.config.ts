import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
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
