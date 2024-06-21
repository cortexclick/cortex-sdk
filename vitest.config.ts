// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./vitest-setup.ts'],
    exclude: ['**/*.js'],
  },
});