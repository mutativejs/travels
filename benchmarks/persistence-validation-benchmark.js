const { performance } = require('node:perf_hooks');
const { Travels } = require('../dist/index.cjs');

const args = new Set(process.argv.slice(2));
const isCi = args.has('--ci');
const isFull = args.has('--full');

const config = isCi
  ? { width: 5_000, entries: 20, rounds: 3 }
  : isFull
    ? { width: 25_000, entries: 100, rounds: 5 }
    : { width: 10_000, entries: 20, rounds: 5 };

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
  return performance.now() - startedAt;
}

function summarize(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = (value) =>
    sorted[Math.max(0, Math.ceil(sorted.length * value) - 1)];

  return {
    median: percentile(0.5),
    p95: percentile(0.95),
  };
}

const encoded = JSON.stringify(
  createWideArraySnapshot(config.width, config.entries)
);

// Warm up module initialization and both validation branches with a tiny input.
const warmup = JSON.stringify(createWideArraySnapshot(10, 1));
Travels.deserialize(warmup);
Travels.deserialize(warmup, { validation: 'semantic' });

const structuralSamples = [];
const semanticSamples = [];
for (let round = 0; round < config.rounds; round += 1) {
  structuralSamples.push(measure(() => Travels.deserialize(encoded)));
  semanticSamples.push(
    measure(() => Travels.deserialize(encoded, { validation: 'semantic' }))
  );
}

const structural = summarize(structuralSamples);
const semantic = summarize(semanticSamples);

console.log('Travels persistence validation benchmark');
console.log(
  `Wide array: ${config.width} values; history entries: ${config.entries}`
);
console.log(`Encoded snapshot: ${(encoded.length / 1024).toFixed(1)} KiB`);
console.log(`Measured rounds: ${config.rounds}`);
console.log(
  `Default structural validation: median ${structural.median.toFixed(2)} ms; p95 ${structural.p95.toFixed(2)} ms`
);
console.log(
  `Explicit semantic validation: median ${semantic.median.toFixed(2)} ms; p95 ${semantic.p95.toFixed(2)} ms`
);

if (isCi) {
  const failures = [];
  if (structural.p95 > 50) {
    failures.push(
      `default structural validation p95 ${structural.p95.toFixed(2)}ms exceeded the 50ms CI limit`
    );
  }
  if (semantic.p95 > 2_000) {
    failures.push(
      `explicit semantic validation p95 ${semantic.p95.toFixed(2)}ms exceeded the 2000ms CI smoke limit`
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
