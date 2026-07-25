import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const globals = {
  __dirname: 'readonly',
  __DEV__: 'readonly',
  Atomics: 'readonly',
  BroadcastChannel: 'readonly',
  Buffer: 'readonly',
  console: 'readonly',
  document: 'readonly',
  exports: 'readonly',
  global: 'readonly',
  globalThis: 'readonly',
  module: 'readonly',
  navigator: 'readonly',
  Node: 'readonly',
  performance: 'readonly',
  process: 'readonly',
  queueMicrotask: 'readonly',
  require: 'readonly',
  setTimeout: 'readonly',
  SharedArrayBuffer: 'readonly',
  structuredClone: 'readonly',
  URL: 'readonly',
  WebSocket: 'readonly',
  window: 'readonly',
};

const importRules = {
  ...importPlugin.configs.recommended.rules,
  'import/extensions': [
    'error',
    'ignorePackages',
    { js: 'always', jsx: 'never', ts: 'never', tsx: 'never' },
  ],
  'import/no-extraneous-dependencies': [
    'error',
    { devDependencies: true },
  ],
  'import/prefer-default-export': 'off',
  'import/no-unresolved': 'off',
};

/**
 * Resolver settings shared by both language blocks.
 *
 * The plain `node` resolver cannot follow a dependency's own dependencies
 * under pnpm's non-hoisted layout: `vue` re-exports its public API from
 * `@vue/runtime-dom`, which exists only inside `.pnpm`, so import/named
 * reported every named Vue import as missing. That failure never appeared in
 * a working tree whose node_modules had been hoisted by an earlier install,
 * only on a clean `--frozen-lockfile` install. The TypeScript resolver reads
 * the real paths and resolves the re-export chain.
 */
const importSettings = {
  'import/resolver': {
    typescript: { alwaysTryTypes: true },
    node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
  },
};

const sharedRules = {
  'class-methods-use-this': 'off',
  'max-classes-per-file': 'off',
  'no-await-in-loop': 'off',
  'no-restricted-syntax': 'off',
  'no-underscore-dangle': 'off',
  'no-useless-constructor': 'off',
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/docs-site/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals,
      sourceType: 'module',
    },
    plugins: {
      import: importPlugin,
    },
    settings: importSettings,
    rules: {
      ...js.configs.recommended.rules,
      ...importRules,
      ...sharedRules,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals,
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    settings: importSettings,
    rules: {
      ...js.configs.recommended.rules,
      // Turns off the base rules that TypeScript itself already enforces or
      // that misfire on type-only syntax such as function overloads.
      ...tsPlugin.configs['flat/eslint-recommended'].rules,
      ...tsPlugin.configs.recommended.rules,
      ...importRules,
      ...sharedRules,
      'no-unused-vars': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Object literals with accessors need a lexical receiver because `this`
      // inside them refers to the literal rather than the enclosing instance.
      '@typescript-eslint/no-this-alias': ['error', { allowedNames: ['self'] }],
    },
  },
  {
    // Ambient global declarations rely on `var` to merge across declaration
    // files; `let` does not declare a global binding the same way.
    files: ['**/*.d.ts'],
    rules: {
      'no-var': 'off',
    },
  },
  {
    files: ['test/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
];
