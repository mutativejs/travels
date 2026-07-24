import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
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
};

const sharedRules = {
  'class-methods-use-this': 'off',
  'max-classes-per-file': 'off',
  'no-await-in-loop': 'off',
  'no-restricted-syntax': 'off',
  'no-underscore-dangle': 'off',
  'no-useless-constructor': 'off',
  'prettier/prettier': 'error',
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
      prettier: prettierPlugin,
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...importRules,
      ...prettierPlugin.configs.recommended.rules,
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
      prettier: prettierPlugin,
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...importRules,
      ...prettierPlugin.configs.recommended.rules,
      ...sharedRules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
