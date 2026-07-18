import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import { existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import pkg from './package.json';

const input = './dist/index.js';
const distDirectory = resolvePath('dist');
const finalSourceMaps = new Set([
  'index.cjs.map',
  'index.esm.js.map',
  'index.umd.js.map',
  'index.dev.cjs.map',
  'index.dev.esm.js.map',
]);
const finalJavaScript = new Set([
  'index.cjs',
  'index.esm.js',
  'index.umd.js',
  'index.dev.cjs',
  'index.dev.esm.js',
]);

/** @type {import('rollup').Plugin} */
const typescriptSourceMaps = {
  name: 'typescript-source-maps',
  /** @param {string} id */
  load(id) {
    if (!id.startsWith(distDirectory) || !id.endsWith('.js')) {
      return null;
    }
    const mapPath = `${id}.map`;
    if (!existsSync(mapPath)) {
      return null;
    }
    return {
      code: readFileSync(id, 'utf8'),
      map: JSON.parse(readFileSync(mapPath, 'utf8')),
    };
  },
};

/** @type {import('rollup').Plugin} */
const removeIntermediateArtifacts = {
  name: 'remove-intermediate-artifacts',
  closeBundle() {
    for (const name of readdirSync(distDirectory)) {
      const isIntermediateMap =
        name.endsWith('.js.map') && !finalSourceMaps.has(name);
      const isIntermediateJavaScript =
        (name.endsWith('.js') || name.endsWith('.cjs')) &&
        !finalJavaScript.has(name);
      if (isIntermediateMap || isIntermediateJavaScript) {
        unlinkSync(resolvePath(distDirectory, name));
      }
    }
  },
};

/** @param {string} nodeEnv */
const createPlugins = (nodeEnv) => [
  typescriptSourceMaps,
  resolve(),
  commonjs(),
  replace({
    'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    preventAssignment: true,
  }),
  terser({ compress: { passes: 3 } }),
];

export default [
  {
    input,
    output: [
      {
        format: 'cjs',
        exports: 'auto',
        file: 'dist/index.cjs',
        sourcemap: true,
      },
      {
        format: 'es',
        file: 'dist/index.esm.js',
        sourcemap: true,
      },
      {
        format: 'umd',
        name: pkg.name
          .split('-')
          .map(([s, ...rest]) => [s.toUpperCase(), ...rest].join(''))
          .join(''),
        file: pkg.unpkg,
        sourcemap: true,
        globals: {
          mutative: 'Mutative',
        },
        exports: 'named',
      },
    ],
    plugins: createPlugins('production'),
    external: ['mutative'],
  },
  // Development-condition bundles keep the diagnostics that production
  // bundles strip. Bundlers resolving the `development` export condition
  // (Vite dev server, webpack mode: development) load these variants; the
  // literal replacement keeps browser builds free of `process` references.
  // The cleanup plugin runs only on this final build so the shared tsc
  // intermediates stay readable for every preceding build.
  {
    input,
    output: [
      {
        format: 'cjs',
        exports: 'auto',
        file: 'dist/index.dev.cjs',
        sourcemap: true,
      },
      {
        format: 'es',
        file: 'dist/index.dev.esm.js',
        sourcemap: true,
      },
    ],
    plugins: [...createPlugins('development'), removeIntermediateArtifacts],
    external: ['mutative'],
  },
];
