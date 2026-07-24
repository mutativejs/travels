import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const mutations = [
  {
    name: 'backward replay keeps the oldest selected entry',
    file: 'src/replay.ts',
    from: 'for (let index = groups.length - 1; index >= 0; index -= 1)',
    to: 'for (let index = groups.length - 1; index > 0; index -= 1)',
    tests: ['test/history-replay.test.ts'],
  },
  {
    name: 'controlled patch pairs reject one-sided history',
    file: 'src/persistence.ts',
    from: "if ((patches.length === 0) !== (inversePatches.length === 0))",
    to: "if (false && (patches.length === 0) !== (inversePatches.length === 0))",
    tests: ['test/controlled-journal.test.ts'],
  },
  {
    name: 'retained patch pairs reject one-sided history',
    file: 'src/persistence.ts',
    from:
      '      (forward[entryIndex].length === 0) !==\n' +
      '      (inverse[entryIndex].length === 0)',
    to:
      '      false &&\n' +
      '      (forward[entryIndex].length === 0) !==\n' +
      '      (inverse[entryIndex].length === 0)',
    tests: ['test/persistence.test.ts'],
  },
  {
    name: 'controlled patch values reject functions that cannot be detached',
    file: 'src/internal/patch-utils.ts',
    from: "if (typeof value === 'function') {",
    to: "if (false && typeof value === 'function') {",
    tests: ['test/controlled-journal.test.ts'],
  },
  {
    name: 'strict patchable factory validates the concrete initial value',
    file: 'src/createPatchableTravels.ts',
    from: 'if (issues.length > 0) {',
    to: 'if (false && issues.length > 0) {',
    tests: ['test/state-compatibility.test.ts'],
  },
  {
    name: 'mutable transactions replay every rollback journal entry',
    file: 'src/internal/transaction-coordinator.ts',
    from: 'index >= journalLength;',
    to: 'index > journalLength;',
    tests: ['test/product-api.test.ts'],
  },
];

const runTests = (tests) =>
  spawnSync('pnpm', ['exec', 'vitest', 'run', ...tests], {
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: '0' },
  });

const printResult = (result) => {
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
};

const baselineTests = [...new Set(mutations.flatMap(({ tests }) => tests))];
const baseline = runTests(baselineTests);
if (baseline.error || baseline.signal || baseline.status !== 0) {
  console.error('Mutation smoke baseline failed; mutations were not evaluated.');
  printResult(baseline);
  process.exit(1);
}

let failed = false;
for (const mutation of mutations) {
  const original = readFileSync(mutation.file, 'utf8');
  if (!original.includes(mutation.from)) {
    console.error(`Mutation target not found: ${mutation.name}`);
    failed = true;
    continue;
  }
  if (original.split(mutation.from).length !== 2) {
    console.error(`Mutation target is not unique: ${mutation.name}`);
    failed = true;
    continue;
  }

  try {
    writeFileSync(mutation.file, original.replace(mutation.from, mutation.to));
    const result = runTests(mutation.tests);

    if (result.error || result.signal || result.status === null) {
      console.error(`INFRASTRUCTURE ERROR: ${mutation.name}`);
      printResult(result);
      failed = true;
    } else if (result.status === 0) {
      console.error(`SURVIVED: ${mutation.name}`);
      printResult(result);
      failed = true;
    } else if (result.status === 1) {
      console.log(`KILLED: ${mutation.name}`);
    } else {
      console.error(
        `UNEXPECTED TEST EXIT ${result.status}: ${mutation.name}`
      );
      printResult(result);
      failed = true;
    }
  } finally {
    writeFileSync(mutation.file, original);
  }
}

if (failed) {
  process.exitCode = 1;
}
