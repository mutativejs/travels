import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
} from 'node:fs';
import {
  dirname as dirnamePath,
  join as joinPath,
  resolve as resolvePath,
  sep as pathSeparator,
} from 'node:path';
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

/** @returns {Set<string>} */
const getPublicDeclarationArtifacts = () => {
  /** @type {Set<string>} */
  const publicArtifacts = new Set();
  const pending = [resolvePath(distDirectory, 'index.d.ts')];

  while (pending.length > 0) {
    const declarationPath = pending.pop();
    if (!declarationPath || publicArtifacts.has(declarationPath)) {
      continue;
    }

    publicArtifacts.add(declarationPath);
    const mapPath = `${declarationPath}.map`;
    if (existsSync(mapPath)) {
      publicArtifacts.add(mapPath);
    }

    const source = readFileSync(declarationPath, 'utf8');
    for (const match of source.matchAll(
      /\b(?:from|import)\s*['"](\.[^'"]+)['"]/g
    )) {
      const specifierPath = resolvePath(dirnamePath(declarationPath), match[1]);
      const importedDeclaration = specifierPath.endsWith('.js')
        ? `${specifierPath.slice(0, -3)}.d.ts`
        : `${specifierPath}.d.ts`;
      if (
        importedDeclaration.startsWith(`${distDirectory}${pathSeparator}`) &&
        existsSync(importedDeclaration) &&
        !publicArtifacts.has(importedDeclaration)
      ) {
        pending.push(importedDeclaration);
      }
    }
  }

  return publicArtifacts;
};

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

/**
 * Remove the per-module JavaScript and unreachable declarations tsc emits
 * before bundling.
 *
 * The walk has to recurse: source subdirectories emit into matching dist
 * subdirectories, and anything left there is published as an unbundled module
 * alongside the real entry points.
 *
 * @param {string} directory
 * @param {ReadonlySet<string>} publicDeclarations
 * @returns {boolean} whether anything was kept in it
 */
const removeIntermediateBuildArtifacts = (directory, publicDeclarations) => {
  let keptEntry = false;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = joinPath(directory, entry.name);

    if (entry.isDirectory()) {
      if (removeIntermediateBuildArtifacts(entryPath, publicDeclarations)) {
        keptEntry = true;
      } else {
        rmdirSync(entryPath);
      }
      continue;
    }

    // Only top-level names can be final artifacts; nested ones never are.
    const isTopLevel = directory === distDirectory;
    const isIntermediateMap =
      entry.name.endsWith('.js.map') &&
      !(isTopLevel && finalSourceMaps.has(entry.name));
    const isIntermediateJavaScript =
      (entry.name.endsWith('.js') || entry.name.endsWith('.cjs')) &&
      !(isTopLevel && finalJavaScript.has(entry.name));
    const isUnusedDeclaration =
      (entry.name.endsWith('.d.ts') || entry.name.endsWith('.d.ts.map')) &&
      !publicDeclarations.has(entryPath);

    if (
      isIntermediateMap ||
      isIntermediateJavaScript ||
      isUnusedDeclaration
    ) {
      unlinkSync(entryPath);
    } else {
      keptEntry = true;
    }
  }

  return keptEntry;
};

/** @type {import('rollup').Plugin} */
const removeIntermediateArtifacts = {
  name: 'remove-intermediate-artifacts',
  closeBundle() {
    removeIntermediateBuildArtifacts(
      distDirectory,
      getPublicDeclarationArtifacts()
    );
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
