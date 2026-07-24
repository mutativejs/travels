import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      'e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      'use-travel/**',
      'zustand-travel/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'benchmarks/**',
        'examples/**',
        'node_modules/**',
        'dist/**',
        'docs-site/**',
        'e2e/**',
        'use-travel/**',
        'zustand-travel/**',
        'test/**',
        '**/*.config.*',
        '**/*.d.ts',
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
        'src/travels.ts': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        'src/persistence.ts': {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
        'src/replay.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        'src/utils.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
  define: {
    __DEV__: false,
  },
});
