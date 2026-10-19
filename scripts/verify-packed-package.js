import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { apply, create } from 'mutative';

const packageRoot = resolve(process.argv[2] ?? 'release-consumer/package');
const manifest = JSON.parse(
  await readFile(resolve(packageRoot, 'package.json'), 'utf8')
);

assert.equal(manifest.name, 'travels');
assert.equal(manifest.main, './dist/index.cjs');
assert.equal(manifest.module, './dist/index.esm.js');
assert.equal(manifest.types, './dist/index.d.ts');
assert.equal(manifest.exports['.'].require.types, './dist/index.d.cts');

const travelsDeclaration = await readFile(
  resolve(packageRoot, 'dist/travels.d.ts'),
  'utf8'
);
for (const internalName of [
  'TravelsCore',
  'RECORD_TRAVEL_JOURNAL_PATCHES',
  './internal/',
]) {
  assert.equal(
    travelsDeclaration.includes(internalName),
    false,
    `public declarations hide ${internalName}`
  );
}

const exerciseUndoRedo = (api, label) => {
  assert.equal(typeof api.createTravels, 'function', `${label} createTravels`);
  assert.equal(
    typeof api.restoreTravels,
    'function',
    `${label} restoreTravels`
  );
  assert.equal(typeof api.Travels?.deserialize, 'function', `${label} deserialize`);
  assert.equal('TravelsCore' in api, false, `${label} internal constructor`);
  assert.throws(() => new api.Travels({ count: 0 }), TypeError);
  const travels = api.createTravels({ count: 0 });
  assert.equal('recordPatches' in travels, false, `${label} state capabilities`);
  assert.equal(Object.isFrozen(travels.getControls()), true, `${label} controls`);
  let event;
  travels.subscribe((nextEvent) => {
    event = nextEvent;
  });
  const initialRevision = travels.getRevision();
  travels.setState(
    (draft) => {
      draft.count = 1;
    },
    { label: 'increment' }
  );
  assert.equal(
    travels.getRevision(),
    initialRevision + 1,
    `${label} committed revision`
  );
  assert.equal(Object.isFrozen(event.metadata), true, `${label} event metadata`);
  assert.equal(Object.isFrozen(event.patches), true, `${label} event patches`);
  assert.equal(
    Object.isFrozen(event.patches.patches),
    true,
    `${label} event patch groups`
  );
  assert.equal(
    Object.isFrozen(event.patches.patches[0]),
    true,
    `${label} event patch group`
  );
  assert.equal(travels.getState().count, 1, `${label} update`);
  assert.equal('archive' in travels, false, `${label} automatic archive`);
  assert.equal('canArchive' in travels, false, `${label} automatic canArchive`);
  assert.equal(
    Object.isFrozen(travels.getHistory()),
    true,
    `${label} shared history`
  );
  travels.back();
  assert.equal(travels.getState().count, 0, `${label} undo`);
  travels.forward();
  assert.equal(travels.getState().count, 1, `${label} redo`);

  const restoredHistory = api.Travels.deserialize(travels.serialize());
  const restored = api.restoreTravels(restoredHistory);
  restored.back();
  assert.equal(restored.getState().count, 0, `${label} restored history`);
  assert.throws(
    () =>
      api.restoreTravels({
        version: 1,
        state: { count: 0 },
        patches: { patches: [], inversePatches: [] },
        position: 1,
      }),
    /persisted history position 1 is invalid/
  );
  assert.throws(
    () => api.createTravels({ count: 0 }, { history: restoredHistory }),
    (error) => error?.code === 'INVALID_OPTION'
  );

  const manualTravels = api.createTravels({ count: 0 }, { autoArchive: false });
  assert.equal(
    typeof manualTravels.archive,
    'function',
    `${label} manual archive`
  );
  assert.equal(
    typeof manualTravels.canArchive,
    'function',
    `${label} manual canArchive`
  );
  manualTravels.setState({ count: 1 });
  assert.equal(manualTravels.canArchive(), true, `${label} manual pending`);
  manualTravels.archive();
  assert.equal(manualTravels.canArchive(), false, `${label} manual archived`);

  const journal = api.createTravelJournal(
    { count: 0 },
    { apply: ({ state }) => state }
  );
  assert.equal(typeof journal.recordPatches, 'function', `${label} journal commit`);
  assert.equal(
    typeof api.restoreTravelJournal,
    'function',
    `${label} restore journal`
  );
  assert.equal(Object.isFrozen(journal), true, `${label} journal facade`);
  assert.equal('setState' in journal, false, `${label} journal capabilities`);
  assert.equal(typeof journal.reset, 'function', `${label} journal reset`);
  assert.equal('archive' in journal, false, `${label} automatic journal`);

  let ownedState = { count: 0 };
  const manualJournal = api.createTravelJournal(ownedState, {
    autoArchive: false,
    apply: ({ patches }) => {
      ownedState = apply(ownedState, patches);
      return ownedState;
    },
  });
  const [nextState, patches, inversePatches] = create(
    ownedState,
    (draft) => {
      draft.count = 1;
    },
    { enablePatches: true }
  );
  ownedState = nextState;
  manualJournal.recordPatches(nextState, { patches, inversePatches });
  assert.equal(manualJournal.canArchive(), true, `${label} pending archive`);
  manualJournal.archive();
  assert.equal(manualJournal.canArchive(), false, `${label} archived journal`);
  manualJournal.reset();
  assert.equal(ownedState.count, 0, `${label} delegated journal reset`);
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
  'dist/index.d.cts',
]) {
  await readFile(resolve(packageRoot, artifact));
}

console.log(`Verified packed travels@${manifest.version} CJS and ESM entries.`);
