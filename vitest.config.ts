import { defineConfig } from 'vitest/config'

// Unit tests sit next to the code (`*.test.ts`); end-to-end tests are in e2e/ (Playwright).
export default defineConfig({
  test: {
    include: ['core/**/*.test.ts', 'electron/**/*.test.ts', 'export/**/*.test.ts', 'prototype/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
})
