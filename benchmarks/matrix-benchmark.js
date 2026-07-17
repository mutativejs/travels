/**
 * Scenario matrix benchmark.
 *
 * Compares a full-snapshot undo stack with Travels across state sizes,
 * update shapes, and multiple rounds. This benchmark is intentionally
 * synthetic: it isolates the algorithmic trade-off between snapshot history
 * and patch history without Redux/Zustand integration overhead.
 */

const { performance } = require('perf_hooks');
const { createTravels } = require('../dist/index.cjs');

const args = new Set(process.argv.slice(2));
const isCi = args.has('--ci');
const isFull = args.has('--full');

const config = {
  rounds: isCi ? 3 : isFull ? 7 : 5,
  iterations: isCi ? 20 : isFull ? 100 : 50,
  stateSizesKB: isCi ? [10, 100] : isFull ? [10, 100, 1024, 5120] : [10, 100, 1024],
  updateNames: isCi
    ? ['smallPatch', 'deepObject', 'arraySplice']
    : ['smallPatch', 'largePatch', 'arraySplice', 'deepObject', 'mapSet'],
};

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = Math.ceil(sorted.length * ratio) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function summarizeMetric(values) {
  return {
    median: round(percentile(values, 0.5)),
    p95: round(percentile(values, 0.95)),
  };
}

function measure(fn) {
  const startedAt = performance.now();
  const result = fn();
  return {
    result,
    ms: round(performance.now() - startedAt),
  };
}

function collectHeap() {
  if (global.gc) {
    global.gc();
  }
  return process.memoryUsage().heapUsed;
}

function heapDeltaMB(before, after) {
  return round((after - before) / 1024 / 1024);
}

function createItem(index, descriptionSize) {
  return {
    id: `item-${index}`,
    name: `Item ${index}`,
    description: 'x'.repeat(descriptionSize),
    tags: Array.from({ length: 8 }, (_, tagIndex) => `tag-${index}-${tagIndex}`),
    nested: {
      level1: {
        level2: {
          level3: {
            data: Array.from({ length: 4 }, (_, dataIndex) => ({
              key: `data-${index}-${dataIndex}`,
              value: index * 100 + dataIndex,
            })),
          },
        },
      },
    },
  };
}

function generateState(targetSizeKB, includeCollections = false) {
  const itemCount = 12;
  const descriptionSize = Math.max(16, Math.floor((targetSizeKB * 1024) / itemCount / 1.4));
  const state = {
    id: 'document-0',
    timestamp: 0,
    metadata: {
      title: 'Benchmark document',
      version: 0,
      flags: {
        published: false,
        locked: false,
      },
    },
    items: Array.from({ length: itemCount }, (_, index) =>
      createItem(index, descriptionSize)
    ),
  };

  if (includeCollections) {
    state.collections = {
      map: new Map([
        ['a', { value: 1 }],
        ['b', { value: 2 }],
      ]),
      set: new Set(['a', 'b']),
    };
  }

  return state;
}

function cloneState(state) {
  if (typeof structuredClone === 'function') {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state));
}

function toPersistenceValue(value) {
  if (value instanceof Map) {
    return {
      __travelsBenchmarkType: 'Map',
      entries: Array.from(value.entries()).map(([key, entryValue]) => [
        key,
        toPersistenceValue(entryValue),
      ]),
    };
  }

  if (value instanceof Set) {
    return {
      __travelsBenchmarkType: 'Set',
      values: Array.from(value.values()).map(toPersistenceValue),
    };
  }

  if (Array.isArray(value)) {
    return value.map(toPersistenceValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        toPersistenceValue(entryValue),
      ])
    );
  }

  return value;
}

function stringifyForPersistence(value) {
  return JSON.stringify(toPersistenceValue(value));
}

const scenarios = {
  smallPatch: {
    label: 'small patch',
    includeCollections: false,
    apply(state, iteration) {
      state.id = `document-${iteration}`;
      state.timestamp = iteration;
      state.metadata.version += 1;
    },
  },
  largePatch: {
    label: 'large patch',
    includeCollections: false,
    apply(state, iteration, stateSizeKB) {
      const replacement = `${iteration}-` + 'y'.repeat(Math.max(1024, stateSizeKB * 256));
      for (let index = 0; index < Math.min(4, state.items.length); index += 1) {
        state.items[index].description = replacement;
      }
      state.metadata.version += 1;
    },
  },
  arraySplice: {
    label: 'array insert/delete',
    includeCollections: false,
    apply(state, iteration) {
      if (iteration % 2 === 0) {
        state.items.splice(1, 0, createItem(1000 + iteration, 128));
      } else if (state.items.length > 4) {
        state.items.splice(state.items.length - 2, 1);
      }
      state.metadata.version += 1;
    },
  },
  deepObject: {
    label: 'deep object',
    includeCollections: false,
    apply(state, iteration) {
      const item = state.items[iteration % state.items.length];
      item.nested.level1.level2.level3.data[0].value = iteration;
      state.metadata.flags.locked = iteration % 2 === 0;
    },
  },
  mapSet: {
    label: 'Map/Set runtime',
    includeCollections: true,
    apply(state, iteration) {
      state.collections.map.set(`k-${iteration}`, { value: iteration });
      state.collections.set.add(`k-${iteration}`);
      if (iteration % 3 === 0) {
        state.collections.map.delete('a');
        state.collections.set.delete('a');
      }
      state.metadata.version += 1;
    },
  },
};

function runSnapshotRound({ scenario, stateSizeKB, iterations }) {
  const initialState = generateState(stateSizeKB, scenario.includeCollections);
  const stack = {
    past: [],
    present: initialState,
    future: [],
  };

  const before = collectHeap();

  const setStateTotalTime = measure(() => {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const next = cloneState(stack.present);
      scenario.apply(next, iteration, stateSizeKB);
      stack.past.push(stack.present);
      stack.present = next;
      stack.future = [];
    }
  }).ms;

  const afterUpdates = collectHeap();
  const navigationSteps = Math.min(20, iterations);

  const undoTime = measure(() => {
    for (let index = 0; index < navigationSteps; index += 1) {
      if (stack.past.length === 0) return;
      stack.future.unshift(stack.present);
      stack.present = stack.past.pop();
    }
  }).ms;

  const redoTime = measure(() => {
    for (let index = 0; index < navigationSteps; index += 1) {
      if (stack.future.length === 0) return;
      stack.past.push(stack.present);
      stack.present = stack.future.shift();
    }
  }).ms;

  let serialized = '';
  const serializeTime = measure(() => {
    serialized = stringifyForPersistence(stack);
  }).ms;

  const jsonParseTime = measure(() => {
    JSON.parse(serialized);
  }).ms;

  return {
    memoryMB: heapDeltaMB(before, afterUpdates),
    setStateMs: round(setStateTotalTime / iterations),
    undoMs: undoTime,
    redoMs: redoTime,
    serializedSizeKB: round(serialized.length / 1024),
    serializeMs: serializeTime,
    jsonParseMs: jsonParseTime,
  };
}

function runTravelsRound({ scenario, stateSizeKB, iterations }) {
  const initialState = generateState(stateSizeKB, scenario.includeCollections);
  const travels = createTravels(initialState, { maxHistory: iterations });

  const before = collectHeap();

  const setStateTotalTime = measure(() => {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      travels.setState((draft) => {
        scenario.apply(draft, iteration, stateSizeKB);
      });
    }
  }).ms;

  const afterUpdates = collectHeap();
  const navigationSteps = Math.min(20, iterations);

  const undoTime = measure(() => {
    travels.back(navigationSteps);
  }).ms;

  const redoTime = measure(() => {
    travels.forward(navigationSteps);
  }).ms;

  const history = {
    state: travels.getState(),
    patches: travels.getPatches(),
    position: travels.getPosition(),
  };

  let serialized = '';
  const serializeTime = measure(() => {
    serialized = stringifyForPersistence(history);
  }).ms;

  const jsonParseTime = measure(() => {
    JSON.parse(serialized);
  }).ms;

  return {
    memoryMB: heapDeltaMB(before, afterUpdates),
    setStateMs: round(setStateTotalTime / iterations),
    undoMs: undoTime,
    redoMs: redoTime,
    serializedSizeKB: round(serialized.length / 1024),
    serializeMs: serializeTime,
    jsonParseMs: jsonParseTime,
  };
}

function summarizeRounds(rounds) {
  const keys = Object.keys(rounds[0]);
  return Object.fromEntries(
    keys.map((key) => [key, summarizeMetric(rounds.map((round) => round[key]))])
  );
}

function formatMetric(metric) {
  return `${metric.median}/${metric.p95}`;
}

function printScenarioSummary(summary) {
  console.log(
    `\n### ${summary.stateSizeKB}KB state, ${summary.scenarioLabel}, ` +
      `${config.iterations} updates, ${config.rounds} rounds`
  );
  console.log('| Metric | Snapshot median/p95 | Travels median/p95 |');
  console.log('| --- | ---: | ---: |');

  const rows = [
    ['Memory delta (MB)', 'memoryMB'],
    ['setState/update (ms)', 'setStateMs'],
    ['Undo 20 steps (ms)', 'undoMs'],
    ['Redo 20 steps (ms)', 'redoMs'],
    ['Serialized size (KB)', 'serializedSizeKB'],
    ['Serialize (ms)', 'serializeMs'],
    ['JSON parse (ms)', 'jsonParseMs'],
  ];

  for (const [label, key] of rows) {
    console.log(
      `| ${label} | ${formatMetric(summary.snapshot[key])} | ` +
        `${formatMetric(summary.travels[key])} |`
    );
  }
}

function runMatrix() {
  console.log('Travels scenario matrix benchmark');
  console.log(`Node: ${process.version}`);
  console.log(`Mode: ${isCi ? 'ci' : isFull ? 'full' : 'default'}`);
  console.log(`State sizes: ${config.stateSizesKB.join(', ')} KB`);
  console.log(`Updates: ${config.updateNames.join(', ')}`);
  console.log(`Rounds: ${config.rounds}; iterations per round: ${config.iterations}`);

  const summaries = [];

  for (const stateSizeKB of config.stateSizesKB) {
    for (const updateName of config.updateNames) {
      const scenario = scenarios[updateName];
      const snapshotRounds = [];
      const travelsRounds = [];

      for (let roundIndex = 0; roundIndex < config.rounds; roundIndex += 1) {
        snapshotRounds.push(
          runSnapshotRound({ scenario, stateSizeKB, iterations: config.iterations })
        );
        travelsRounds.push(
          runTravelsRound({ scenario, stateSizeKB, iterations: config.iterations })
        );
      }

      const summary = {
        stateSizeKB,
        updateName,
        scenarioLabel: scenario.label,
        snapshot: summarizeRounds(snapshotRounds),
        travels: summarizeRounds(travelsRounds),
      };

      summaries.push(summary);
      printScenarioSummary(summary);
    }
  }

  return summaries;
}

function runCiGuard(summaries) {
  const failures = [];

  for (const summary of summaries) {
    const compactHistoryScenario =
      summary.stateSizeKB >= 100 &&
      (summary.updateName === 'smallPatch' || summary.updateName === 'deepObject');

    if (compactHistoryScenario) {
      const snapshotSize = summary.snapshot.serializedSizeKB.median;
      const travelsSize = summary.travels.serializedSizeKB.median;
      if (travelsSize > snapshotSize * 0.35) {
        failures.push(
          `${summary.stateSizeKB}KB ${summary.updateName}: Travels serialized size ` +
            `${travelsSize}KB exceeded 35% of snapshot size ${snapshotSize}KB`
        );
      }
    }

    if (summary.travels.setStateMs.p95 > 1000) {
      failures.push(
        `${summary.stateSizeKB}KB ${summary.updateName}: Travels setState p95 ` +
          `${summary.travels.setStateMs.p95}ms exceeded 1000ms smoke limit`
      );
    }
  }

  if (failures.length > 0) {
    console.error('\nCI benchmark guard failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nCI benchmark guard passed.');
}

const summaries = runMatrix();
if (isCi) {
  runCiGuard(summaries);
}
