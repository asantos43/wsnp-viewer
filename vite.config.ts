import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds the interface (the renderer) into dist/. The main process is built by vite.electron.config.ts.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@core': path.resolve(import.meta.dirname, './core'),
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'chrome152' },
})
