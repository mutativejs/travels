/**
 * Real-library undo/redo benchmark.
 *
 * Every adapter receives the same deterministic document and records one
 * history entry per two-field update. Store creation is intentionally excluded
 * so the benchmark focuses on steady-state history recording, navigation, and
 * persistence footprint rather than model-schema construction.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createRequire } = require('module');
const { performance } = require('perf_hooks');
const { createStore: createReduxStore } = require('redux');
const undoable = require('redux-undo').default;
const { createStore: createZustandStore } = require('zustand/vanilla');
const { temporal } = require('zundo');
const {
  destroy: destroyMst,
  getSnapshot: getMstSnapshot,
  types: mstTypes,
} = require('mobx-state-tree');
const { UndoManager: MstUndoManager } = require('mst-middlewares');
const {
  Model: KeystoneModel,
  decoratedModel,
  getSnapshot: getKeystoneSnapshot,
  modelAction,
  prop,
  registerRootStore,
  undoMiddleware,
  unregisterRootStore,
} = require('mobx-keystone');
const { createTravels } = require('../dist/index.cjs');
const { writeBenchmarkChart } = require('./generate-real-library-chart');

const cliArgs = process.argv.slice(2);
const isQuick = cliArgs.includes('--quick');
const shouldWriteResults = !cliArgs.includes('--no-write');

function readStringFlag(name) {
  const prefix = `${name}=`;
  return cliArgs.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const localCoactionRepoInput = readStringFlag('--coaction-repo');
const localCoactionRepo = localCoactionRepoInput
  ? path.resolve(localCoactionRepoInput)
  : undefined;

function requireCoaction() {
  if (!localCoactionRepo) {
    return {
      createStore: require('coaction/local').create,
      history: require('@coaction/history').history,
      source: 'npm',
    };
  }
  const coreEntry = path.join(
    localCoactionRepo,
    'packages/core/dist/local.js'
  );
  const historyEntry = path.join(
    localCoactionRepo,
    'packages/coaction-history/dist/index.js'
  );
  for (const entry of [coreEntry, historyEntry]) {
    if (!fs.existsSync(entry)) {
      throw new Error(
        `Missing local Coaction build at ${entry}. Build coaction and @coaction/history before running this benchmark.`
      );
    }
  }

  // The local history build should exercise the current Travels checkout. Map
  // its dependency resolution to this benchmark's already-built CJS export
  // without mutating either repository's node_modules links.
  const historyRequire = createRequire(historyEntry);
  const resolvedHistoryTravels = historyRequire.resolve('travels');
  require.cache[resolvedHistoryTravels] = {
    id: resolvedHistoryTravels,
    filename: resolvedHistoryTravels,
    loaded: true,
    exports: require('../dist/index.cjs'),
    children: [],
    paths: [],
  };

  const revision = execFileSync(
    'git',
    ['-C', localCoactionRepo, 'rev-parse', '--short', 'HEAD'],
    { encoding: 'utf8' }
  ).trim();
  const dirty = execFileSync(
    'git',
    ['-C', localCoactionRepo, 'status', '--porcelain'],
    { encoding: 'utf8' }
  ).trim();
  return {
    createStore: require(coreEntry).create,
    history: require(historyEntry).history,
    source: `local ${revision}${dirty ? ' (dirty)' : ''}`,
  };
}

const {
  createStore: createCoactionStore,
  history: coactionHistory,
  source: coactionSource,
} = requireCoaction();

function detectCoactionPatchTimeline() {
  const store = createCoactionStore(() => ({ value: 0 }), {
    middlewares: [coactionHistory()],
  });
  try {
    return typeof store.history?.getPatches === 'function';
  } finally {
    store.destroy?.();
  }
}

const coactionHasPatchTimeline = detectCoactionPatchTimeline();

function readPositiveIntegerFlag(name, fallback) {
  const prefix = `${name}=`;
  const argument = cliArgs.find((value) => value.startsWith(prefix));
  if (!argument) return fallback;
  const parsed = Number(argument.slice(prefix.length));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

const iterations = readPositiveIntegerFlag('--iterations', isQuick ? 20 : 100);
const config = {
  stateSizeKB: readPositiveIntegerFlag('--state-size-kb', 100),
  iterations,
  navigationSteps: Math.min(
    iterations,
    readPositiveIntegerFlag('--navigation-steps', isQuick ? 10 : 50)
  ),
  rounds: readPositiveIntegerFlag('--rounds', isQuick ? 3 : 7),
  warmupIterations: Math.min(iterations, isQuick ? 5 : 20),
};

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(sorted.length * ratio) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function summarize(values) {
  return {
    median: round(percentile(values, 0.5)),
    p95: round(percentile(values, 0.95)),
  };
}

function measure(callback) {
  const startedAt = performance.now();
  const result = callback();
  return {
    result,
    ms: performance.now() - startedAt,
  };
}

function collectHeap() {
  if (global.gc) global.gc();
  return process.memoryUsage().heapUsed;
}

function createItem(index, descriptionSize) {
  return {
    id: `item-${index}`,
    name: `Item ${index}`,
    description: 'x'.repeat(descriptionSize),
    tags: Array.from(
      { length: 8 },
      (_, tagIndex) => `tag-${index}-${tagIndex}`
    ),
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

function generateComplexObject(targetSizeKB) {
  const itemCount = 12;
  const descriptionSize = Math.max(
    16,
    Math.floor((targetSizeKB * 1024) / itemCount / 1.08)
  );
  return {
    id: 'document-0',
    timestamp: 0,
    metadata: {
      title: 'Benchmark document',
      version: 1,
      flags: { published: false, locked: false },
    },
    items: Array.from({ length: itemCount }, (_, index) =>
      createItem(index, descriptionSize)
    ),
    config: {
      locale: 'en-US',
      autosave: true,
    },
  };
}

const MstDocument = mstTypes
  .model('TravelsBenchmarkDocument', {
    id: mstTypes.string,
    timestamp: mstTypes.number,
    metadata: mstTypes.frozen(),
    items: mstTypes.frozen(),
    config: mstTypes.frozen(),
  })
  .actions((state) => ({
    update(id, timestamp) {
      state.id = id;
      state.timestamp = timestamp;
    },
  }));

const KeystoneDocument = decoratedModel(
  'travelsBenchmark/Document',
  class extends KeystoneModel({
    id: prop(''),
    timestamp: prop(0),
    metadata: prop(() => ({})),
    items: prop(() => []),
    config: prop(() => ({})),
  }) {
    update(id, timestamp) {
      this.id = id;
      this.timestamp = timestamp;
    }
  },
  { update: modelAction }
);

function createReduxUndo(initialState) {
  const reducer = (state = initialState, action) => {
    if (action.type !== 'UPDATE') return state;
    return {
      ...state,
      id: action.id,
      timestamp: action.timestamp,
    };
  };
  const store = createReduxStore(undoable(reducer));
  return {
    update(index) {
      store.dispatch({
        type: 'UPDATE',
        id: `modified-${index}`,
        timestamp: index + 1,
      });
    },
    undo() {
      store.dispatch({ type: '@@redux-undo/UNDO' });
    },
    redo() {
      store.dispatch({ type: '@@redux-undo/REDO' });
    },
    getId: () => store.getState().present.id,
    getHistoryLength: () =>
      store.getState().past.length + store.getState().future.length,
    getPersistencePayload: () => store.getState(),
  };
}

function createZundo(initialState, benchmarkConfig) {
  const store = createZustandStore(
    temporal(
      (set) => ({
        ...initialState,
        update(id, timestamp) {
          set({ id, timestamp });
        },
      }),
      { limit: benchmarkConfig.iterations }
    )
  );
  const history = store.temporal;
  return {
    update(index) {
      store.getState().update(`modified-${index}`, index + 1);
    },
    undo() {
      history.getState().undo();
    },
    redo() {
      history.getState().redo();
    },
    getId: () => store.getState().id,
    getHistoryLength: () => {
      const temporalState = history.getState();
      return (
        temporalState.pastStates.length + temporalState.futureStates.length
      );
    },
    getPersistencePayload: () => {
      const temporalState = history.getState();
      return {
        state: store.getState(),
        past: temporalState.pastStates,
        future: temporalState.futureStates,
      };
    },
    dispose() {
      history.destroy?.();
      store.destroy?.();
    },
  };
}

function createCoaction(initialState, benchmarkConfig) {
  const store = createCoactionStore(
    (set) => ({
      ...initialState,
      update(id, timestamp) {
        set((draft) => {
          draft.id = id;
          draft.timestamp = timestamp;
        });
      },
    }),
    { middlewares: [coactionHistory({ limit: benchmarkConfig.iterations })] }
  );
  const history = store.history;
  const getPatchHistory = () => history.getPatches?.();
  return {
    update(index) {
      store.getState().update(`modified-${index}`, index + 1);
    },
    undo() {
      history.undo();
    },
    redo() {
      history.redo();
    },
    getId: () => store.getState().id,
    getHistoryLength: () => {
      const patchHistory = getPatchHistory();
      return patchHistory
        ? patchHistory.patches.length
        : history.getPast().length + history.getFuture().length;
    },
    getPersistencePayload: () => {
      const patchHistory = getPatchHistory();
      return patchHistory
        ? {
            version: 1,
            state: store.getPureState(),
            ...patchHistory,
          }
        : {
            state: store.getPureState(),
            past: history.getPast(),
            future: history.getFuture(),
          };
    },
    dispose() {
      store.destroy();
    },
  };
}

function createMst(initialState) {
  const store = MstDocument.create(initialState);
  const history = MstUndoManager.create({}, { targetStore: store });
  return {
    update(index) {
      store.update(`modified-${index}`, index + 1);
    },
    undo() {
      history.undo();
    },
    redo() {
      history.redo();
    },
    getId: () => store.id,
    getHistoryLength: () => history.undoLevels + history.redoLevels,
    getPersistencePayload: () => ({
      state: getMstSnapshot(store),
      history: getMstSnapshot(history),
    }),
    dispose() {
      destroyMst(history);
      destroyMst(store);
    },
  };
}

function createMobxKeystone(initialState, benchmarkConfig) {
  const store = new KeystoneDocument(initialState);
  registerRootStore(store);
  const history = undoMiddleware(store, undefined, {
    maxUndoLevels: benchmarkConfig.iterations,
    maxRedoLevels: benchmarkConfig.iterations,
  });
  return {
    update(index) {
      store.update(`modified-${index}`, index + 1);
    },
    undo() {
      history.undo();
    },
    redo() {
      history.redo();
    },
    getId: () => store.id,
    getHistoryLength: () => history.undoLevels + history.redoLevels,
    getPersistencePayload: () => ({
      state: getKeystoneSnapshot(store),
      history: getKeystoneSnapshot(history.store),
    }),
    dispose() {
      history.dispose();
      unregisterRootStore(store);
    },
  };
}

function createTravelsAdapter(initialState, benchmarkConfig, mutable) {
  const originalReference = initialState;
  const travels = createTravels(initialState, {
    maxHistory: benchmarkConfig.iterations,
    mutable,
    warnOnUnsupportedState: false,
  });
  return {
    update(index) {
      travels.setState((draft) => {
        draft.id = `modified-${index}`;
        draft.timestamp = index + 1;
      });
      if (mutable && travels.getState() !== originalReference) {
        throw new Error('Travels mutable mode replaced the root reference.');
      }
    },
    undo() {
      travels.back();
    },
    redo() {
      travels.forward();
    },
    getId: () => travels.getState().id,
    getHistoryLength: () => travels.getPatches().patches.length,
    getPersistencePayload: () => travels.serialize(),
  };
}

function packageVersion(packageName) {
  let currentDirectory = path.dirname(require.resolve(packageName));
  while (true) {
    const manifestPath = path.join(currentDirectory, 'package.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.name === packageName) return manifest.version;
    }
    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) break;
    currentDirectory = parentDirectory;
  }
  throw new Error(`Could not resolve the package version for ${packageName}.`);
}

function localPackageVersion(relativeManifestPath) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(localCoactionRepo, relativeManifestPath), 'utf8')
  );
  return manifest.version;
}

const coactionVersion = localCoactionRepo
  ? `${localPackageVersion('packages/core/package.json')} + ${localPackageVersion(
      'packages/coaction-history/package.json'
    )} (${coactionSource})`
  : `${packageVersion('coaction')} + ${packageVersion('@coaction/history')}`;

const adapters = [
  {
    id: 'travels-immutable',
    label: 'Travels immutable',
    group: 'travels',
    historyStrategy: 'JSON Patch',
    referenceSemantics: 'immutable root',
    version: require('../package.json').version,
    create: (initialState, benchmarkConfig) =>
      createTravelsAdapter(initialState, benchmarkConfig, false),
  },
  {
    id: 'travels-mutable',
    label: 'Travels mutable',
    group: 'travels',
    historyStrategy: 'JSON Patch',
    referenceSemantics: 'in-place root',
    version: require('../package.json').version,
    create: (initialState, benchmarkConfig) =>
      createTravelsAdapter(initialState, benchmarkConfig, true),
  },
  {
    id: 'mst',
    label: 'MST + UndoManager',
    group: 'model-tree',
    historyStrategy: 'JSON Patch',
    referenceSemantics: 'model tree',
    version: `${packageVersion('mobx-state-tree')} + ${packageVersion(
      'mst-middlewares'
    )}`,
    create: createMst,
  },
  {
    id: 'mobx-keystone',
    label: 'mobx-keystone',
    group: 'model-tree',
    historyStrategy: 'array-path patches',
    referenceSemantics: 'model tree',
    version: packageVersion('mobx-keystone'),
    create: createMobxKeystone,
  },
  {
    id: 'coaction',
    label: 'Coaction history',
    group: coactionHasPatchTimeline ? 'integration' : 'snapshot',
    historyStrategy: coactionHasPatchTimeline
      ? 'Travels JSON Patch'
      : 'snapshots',
    referenceSemantics: 'Coaction store',
    version: coactionVersion,
    create: createCoaction,
  },
  {
    id: 'redux-undo',
    label: 'Redux-undo',
    group: 'snapshot',
    historyStrategy: 'snapshots',
    referenceSemantics: 'immutable root',
    version: packageVersion('redux-undo'),
    create: createReduxUndo,
  },
  {
    id: 'zundo',
    label: 'Zundo',
    group: 'snapshot',
    historyStrategy: 'snapshots',
    referenceSemantics: 'immutable root',
    version: packageVersion('zundo'),
    create: createZundo,
  },
];

function assertState(adapter, expectedId, operation) {
  const actualId = adapter.getId();
  if (actualId !== expectedId) {
    throw new Error(
      `${operation} produced id ${JSON.stringify(actualId)}; expected ${JSON.stringify(
        expectedId
      )}.`
    );
  }
}

function runRound(definition, benchmarkConfig) {
  const initialState = generateComplexObject(benchmarkConfig.stateSizeKB);
  const adapter = definition.create(initialState, benchmarkConfig);
  try {
    const heapBeforeUpdates = collectHeap();
    const updateTime = measure(() => {
      for (let index = 0; index < benchmarkConfig.iterations; index += 1) {
        adapter.update(index);
      }
    }).ms;
    assertState(
      adapter,
      `modified-${benchmarkConfig.iterations - 1}`,
      `${definition.label} updates`
    );

    const heapAfterUpdates = collectHeap();
    const retainedHeapMB = (heapAfterUpdates - heapBeforeUpdates) / 1024 / 1024;

    const undoTime = measure(() => {
      for (let index = 0; index < benchmarkConfig.navigationSteps; index += 1) {
        adapter.undo();
      }
    }).ms;
    const expectedUndoIndex =
      benchmarkConfig.iterations - benchmarkConfig.navigationSteps - 1;
    assertState(
      adapter,
      expectedUndoIndex >= 0 ? `modified-${expectedUndoIndex}` : 'document-0',
      `${definition.label} undo`
    );

    const redoTime = measure(() => {
      for (let index = 0; index < benchmarkConfig.navigationSteps; index += 1) {
        adapter.redo();
      }
    }).ms;
    assertState(
      adapter,
      `modified-${benchmarkConfig.iterations - 1}`,
      `${definition.label} redo`
    );

    const recordedEntries = adapter.getHistoryLength();
    if (recordedEntries !== benchmarkConfig.iterations) {
      throw new Error(
        `${definition.label} recorded ${recordedEntries} history entries; ` +
          `expected ${benchmarkConfig.iterations}.`
      );
    }

    const persistencePayload = adapter.getPersistencePayload();
    const serializedMeasurement = measure(() =>
      JSON.stringify(persistencePayload)
    );
    if (typeof serializedMeasurement.result !== 'string') {
      throw new Error(
        `${definition.label} persistence payload is not JSON data.`
      );
    }
    const parseTime = measure(() =>
      JSON.parse(serializedMeasurement.result)
    ).ms;

    return {
      retainedHeapMB: round(retainedHeapMB),
      updateMs: round(updateTime),
      undoMs: round(undoTime),
      redoMs: round(redoTime),
      serializedSizeKB: round(
        Buffer.byteLength(serializedMeasurement.result) / 1024
      ),
      stringifyMs: round(serializedMeasurement.ms),
      parseMs: round(parseTime),
    };
  } finally {
    adapter.dispose?.();
  }
}

const metricKeys = [
  'retainedHeapMB',
  'updateMs',
  'undoMs',
  'redoMs',
  'serializedSizeKB',
  'stringifyMs',
  'parseMs',
];

function summarizeSamples(samples) {
  return Object.fromEntries(
    metricKeys.map((key) => [
      key,
      summarize(samples.map((sample) => sample[key])),
    ])
  );
}

function formatMetric(metric) {
  return `${metric.median}/${metric.p95}`;
}

function printSummary(implementations) {
  console.log('\n## Median/p95 results');
  console.log(
    '| Library | Updates (ms) | Undo (ms) | Redo (ms) | Heap (MB) | History (KB) |'
  );
  console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const implementation of implementations) {
    const { metrics } = implementation;
    console.log(
      `| ${implementation.label} | ${formatMetric(metrics.updateMs)} | ` +
        `${formatMetric(metrics.undoMs)} | ${formatMetric(metrics.redoMs)} | ` +
        `${formatMetric(metrics.retainedHeapMB)} | ` +
        `${formatMetric(metrics.serializedSizeKB)} |`
    );
  }
}

function runBenchmark() {
  const initialState = generateComplexObject(config.stateSizeKB);
  const actualInitialSizeKB = round(
    Buffer.byteLength(JSON.stringify(initialState)) / 1024,
    2
  );
  console.log('Real-library undo/redo benchmark');
  console.log(`Node: ${process.version}; NODE_ENV=${process.env.NODE_ENV}`);
  console.log(
    `State: ${actualInitialSizeKB}KB; updates: ${config.iterations}; ` +
      `undo/redo: ${config.navigationSteps}; rounds: ${config.rounds}`
  );
  console.log(
    `Implementations: ${adapters.map(({ label }) => label).join(', ')}`
  );
  console.log('\nWarming adapters...');

  const warmupConfig = {
    ...config,
    iterations: config.warmupIterations,
    navigationSteps: Math.min(config.navigationSteps, config.warmupIterations),
  };
  for (const definition of adapters) {
    runRound(definition, warmupConfig);
  }

  const samplesById = new Map(
    adapters.map((definition) => [definition.id, []])
  );
  for (let roundIndex = 0; roundIndex < config.rounds; roundIndex += 1) {
    const offset = roundIndex % adapters.length;
    const roundOrder = [
      ...adapters.slice(offset),
      ...adapters.slice(0, offset),
    ];
    console.log(`\nRound ${roundIndex + 1}/${config.rounds}`);
    for (const definition of roundOrder) {
      const sample = runRound(definition, config);
      samplesById.get(definition.id).push(sample);
      console.log(
        `  ${definition.label}: update ${sample.updateMs}ms; ` +
          `undo/redo ${sample.undoMs}/${sample.redoMs}ms; ` +
          `history ${sample.serializedSizeKB}KB`
      );
    }
  }

  const implementations = adapters.map((definition) => {
    const samples = samplesById.get(definition.id);
    return {
      id: definition.id,
      label: definition.label,
      group: definition.group,
      version: definition.version,
      historyStrategy: definition.historyStrategy,
      referenceSemantics: definition.referenceSemantics,
      metrics: summarizeSamples(samples),
      samples,
    };
  });

  const cpu = os.cpus()[0];
  const report = {
    schemaVersion: 1,
    benchmark: 'real-library-undo-redo',
    generatedAt: new Date().toISOString(),
    config: {
      ...config,
      actualInitialSizeKB,
      measurements: 'median/p95',
      lowerIsBetter: true,
    },
    environment: {
      node: process.version,
      platform: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpu: cpu?.model ?? 'unknown',
      logicalCpus: os.cpus().length,
      coactionSource,
    },
    implementations,
  };

  printSummary(implementations);
  return report;
}

function writeResults(report) {
  const resultDirectory = path.resolve(__dirname, 'results');
  const jsonPath = path.join(resultDirectory, 'real-library-benchmark.json');
  const chartPath = path.join(resultDirectory, 'real-library-benchmark.svg');
  fs.mkdirSync(resultDirectory, { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeBenchmarkChart(report, chartPath);
  console.log(`\nWrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`Wrote ${path.relative(process.cwd(), chartPath)}`);
}

if (require.main === module) {
  const report = runBenchmark();
  if (shouldWriteResults) writeResults(report);
}

module.exports = {
  generateComplexObject,
  runBenchmark,
};
