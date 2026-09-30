import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Unit tests sit next to the code (`*.test.ts`, `*.test.tsx`); end-to-end tests are in e2e/ (Playwright).
// Component tests ask for a DOM with `// @vitest-environment happy-dom` at the top of the file.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    include: ['core/**/*.test.ts', 'electron/**/*.test.ts', 'export/**/*.test.ts', 'prototype/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 30_000,
  },
})
