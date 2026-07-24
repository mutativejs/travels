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
    name: 'mutable transactions replay every rollback journal entry',
    file: 'src/internal/transaction-coordinator.ts',
    from: 'index >= journalLength;',
    to: 'index > journalLength;',
    tests: ['test/product-api.test.ts'],
  },
];

let failed = false;
for (const mutation of mutations) {
  const original = readFileSync(mutation.file, 'utf8');
  if (!original.includes(mutation.from)) {
    console.error(`Mutation target not found: ${mutation.name}`);
    failed = true;
    continue;
  }

  try {
    writeFileSync(mutation.file, original.replace(mutation.from, mutation.to));
    const result = spawnSync(
      'pnpm',
      ['exec', 'vitest', 'run', ...mutation.tests],
      { encoding: 'utf8', stdio: 'pipe' }
    );

    if (result.status === 0) {
      console.error(`SURVIVED: ${mutation.name}`);
      failed = true;
    } else {
      console.log(`KILLED: ${mutation.name}`);
    }
  } finally {
    writeFileSync(mutation.file, original);
  }
}

if (failed) {
  process.exitCode = 1;
}
