const { performance } = require('perf_hooks');
const { apply } = require('mutative');
const { createTravels, createTravelJournal } = require('../dist/index.cjs');

// Per-operation smoke budgets for the core timeline paths.
//
// The matrix benchmark guards setState throughput and serialized history size,
// but nothing covered undo/redo navigation or the controlled journal, so a
// change that made controlled navigation 53x slower and external commits 5.5x
// slower than the 2.1.0 line passed CI unnoticed.
//
// These are deliberately loose. They sit far above the measured cost on a
// developer machine so that shared CI runners do not flake, and they exist to
// catch order-of-magnitude regressions, not percent-level drift. Tighten a
// budget only alongside a measured improvement.
const ITEM_COUNT = 20000;
const HUGE_HISTORY = 1000000;

const budgetsUs = {
  'setState small': 20,
  'setState large': 200,
  'back/forward large': 200,
  'transaction x5': 60,
  'controlled recordPatches': 200,
  'controlled back/forward': 200,
};

const makeLargeState = () => ({
  items: Array.from({ length: ITEM_COUNT }, (_, index) => ({
    id: index,
    v: index,
  })),
  meta: { title: 'benchmark' },
});

const scenarios = {
  'setState small'() {
    const travels = createTravels({ count: 0 }, { maxHistory: HUGE_HISTORY });
    let next = 0;
    return [20000, () => travels.setState((draft) => { draft.count = next++; })];
  },
  'setState large'() {
    const travels = createTravels(makeLargeState(), { maxHistory: HUGE_HISTORY });
    let next = 0;
    return [
      2000,
      () => travels.setState((draft) => {
        draft.items[next++ % ITEM_COUNT].v += 1;
      }),
    ];
  },
  'back/forward large'() {
    const travels = createTravels(makeLargeState(), { maxHistory: HUGE_HISTORY });
    for (let index = 0; index < 100; index += 1) {
      travels.setState((draft) => { draft.items[index].v += 1; });
    }
    let step = 0;
    return [
      2000,
      () => {
        if (step++ % 2 === 0) travels.back();
        else travels.forward();
      },
    ];
  },
  'transaction x5'() {
    const travels = createTravels({ count: 0 }, { maxHistory: HUGE_HISTORY });
    let next = 0;
    return [
      10000,
      () => travels.transaction(() => {
        for (let index = 0; index < 5; index += 1) {
          travels.setState((draft) => { draft.count = next++; });
        }
      }),
    ];
  },
  'controlled recordPatches'() {
    let owned = makeLargeState();
    const journal = createTravelJournal(owned, {
      maxHistory: HUGE_HISTORY,
      apply: ({ patches }) => {
        owned = apply(owned, patches);
        return owned;
      },
    });
    let next = 0;
    return [
      2000,
      () => {
        const index = next++ % ITEM_COUNT;
        const value = next;
        const committed = apply(owned, [
          { op: 'replace', path: ['items', index, 'v'], value },
        ]);
        journal.recordPatches(committed, {
          patches: [{ op: 'replace', path: ['items', index, 'v'], value }],
          inversePatches: [
            { op: 'replace', path: ['items', index, 'v'], value: index },
          ],
        });
        owned = committed;
      },
    ];
  },
  'controlled back/forward'() {
    let owned = makeLargeState();
    const journal = createTravelJournal(owned, {
      maxHistory: HUGE_HISTORY,
      apply: ({ patches }) => {
        owned = apply(owned, patches);
        return owned;
      },
    });
    for (let index = 0; index < 100; index += 1) {
      const committed = apply(owned, [
        { op: 'replace', path: ['items', index, 'v'], value: index + 1 },
      ]);
      journal.recordPatches(committed, {
        patches: [
          { op: 'replace', path: ['items', index, 'v'], value: index + 1 },
        ],
        inversePatches: [
          { op: 'replace', path: ['items', index, 'v'], value: index },
        ],
      });
      owned = committed;
    }
    let step = 0;
    return [
      2000,
      () => {
        if (step++ % 2 === 0) journal.back();
        else journal.forward();
      },
    ];
  },
};

const measureUs = (name) => {
  const [iterations, run] = scenarios[name]();
  const warmup = Math.min(iterations, 1000);
  for (let index = 0; index < warmup; index += 1) run();
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) run();
  return ((performance.now() - start) / iterations) * 1000;
};

const failures = [];
console.log('Hot-path budget report (us/op)');
for (const name of Object.keys(scenarios)) {
  const budget = budgetsUs[name];
  // Take the best of three so an unlucky GC pause cannot fail the build.
  let best = Infinity;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    best = Math.min(best, measureUs(name));
  }
  const status = best > budget ? 'FAIL' : 'ok';
  console.log(
    `- ${name}: ${best.toFixed(2)}us (budget ${budget}us) ${status}`
  );
  if (best > budget) {
    failures.push(`${name} took ${best.toFixed(2)}us, budget is ${budget}us`);
  }
}

if (failures.length > 0) {
  console.error('\nHot-path budgets failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\nAll hot-path budgets passed.');
}
