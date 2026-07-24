import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const packageRoot = resolve(process.argv[2] ?? 'release-consumer/package');
const manifest = JSON.parse(
  await readFile(resolve(packageRoot, 'package.json'), 'utf8')
);

assert.equal(manifest.name, 'travels');
assert.equal(manifest.main, './dist/index.cjs');
assert.equal(manifest.module, './dist/index.esm.js');
assert.equal(manifest.types, './dist/index.d.ts');

const exerciseUndoRedo = (api, label) => {
  assert.equal(typeof api.createTravels, 'function', `${label} createTravels`);
  const travels = api.createTravels({ count: 0 });
  travels.setState((draft) => {
    draft.count = 1;
  });
  assert.equal(travels.getState().count, 1, `${label} update`);
  travels.back();
  assert.equal(travels.getState().count, 0, `${label} undo`);
  travels.forward();
  assert.equal(travels.getState().count, 1, `${label} redo`);
};

const require = createRequire(import.meta.url);
exerciseUndoRedo(require(packageRoot), 'CommonJS package entry');

const esm = await import(
  `${pathToFileURL(resolve(packageRoot, manifest.module)).href}?packed-smoke=1`
);
exerciseUndoRedo(esm, 'ESM package entry');

for (const artifact of [
  'dist/index.cjs',
  'dist/index.esm.js',
  'dist/index.dev.cjs',
  'dist/index.dev.esm.js',
  'dist/index.umd.js',
  'dist/index.d.ts',
]) {
  await readFile(resolve(packageRoot, artifact));
}

console.log(`Verified packed travels@${manifest.version} CJS and ESM entries.`);
