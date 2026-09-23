import { defineConfig } from 'vite';

export default defineConfig({
  root: 'app',
  base: process.env.VITE_BASE || './',
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
