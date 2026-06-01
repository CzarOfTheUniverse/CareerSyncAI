import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      include: ['services/**/*.ts', 'utils/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
