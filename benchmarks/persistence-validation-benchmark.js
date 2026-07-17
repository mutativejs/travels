const { performance } = require('node:perf_hooks');
const { Travels } = require('../dist/index.cjs');

const args = new Set(process.argv.slice(2));
const isCi = args.has('--ci');
const isFull = args.has('--full');

const config = isCi
  ? { width: 5_000, entries: 20 }
  : isFull
    ? { width: 25_000, entries: 100 }
    : { width: 10_000, entries: 20 };

function createWideArraySnapshot(width, entries) {
  const state = { items: Array(width).fill(0) };
  const patches = [];
  const inversePatches = [];

  for (let index = 0; index < entries; index += 1) {
    patches.push([{ op: 'replace', path: ['items', index], value: index + 1 }]);
    inversePatches.push([{ op: 'replace', path: ['items', index], value: 0 }]);
    state.items[index] = index + 1;
  }

  return {
    version: 1,
    state,
    position: entries,
    patches: { patches, inversePatches },
  };
}

function measure(fn) {
  const startedAt = performance.now();
  fn();
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

const encoded = JSON.stringify(
  createWideArraySnapshot(config.width, config.entries)
);

// Warm up module initialization and both validation branches with a tiny input.
const warmup = JSON.stringify(createWideArraySnapshot(10, 1));
Travels.deserialize(warmup, { validation: 'structural' });
Travels.deserialize(warmup);

const structuralMs = measure(() => {
  Travels.deserialize(encoded, { validation: 'structural' });
});
const semanticMs = measure(() => {
  Travels.deserialize(encoded);
});

console.log('Travels persistence validation benchmark');
console.log(
  `Wide array: ${config.width} values; history entries: ${config.entries}`
);
console.log(`Encoded snapshot: ${(encoded.length / 1024).toFixed(1)} KiB`);
console.log(`Structural validation: ${structuralMs.toFixed(2)} ms`);
console.log(`Semantic validation: ${semanticMs.toFixed(2)} ms`);

if (isCi) {
  const failures = [];
  if (structuralMs > 250) {
    failures.push(
      `structural validation ${structuralMs}ms exceeded the 250ms CI limit`
    );
  }
  if (semanticMs > 5_000) {
    failures.push(
      `semantic validation ${semanticMs}ms exceeded the 5000ms CI smoke limit`
    );
  }

  if (failures.length) {
    console.error('\nPersistence validation benchmark failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Persistence validation benchmark passed.');
  }
}
