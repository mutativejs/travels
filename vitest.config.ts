import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'examples/**',
        'node_modules/**',
        'dist/**',
        'test/**',
        '**/*.config.*',
        '**/*.d.ts',
      ],
    },
  },
  define: {
    __DEV__: false,
  },
});
