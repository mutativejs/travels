/**
 * Benchmark using real libraries
 *
 * Compare real implementations of Redux-undo, Zundo, and Travels
 */

const { createStore } = require('redux');
const undoable = require('redux-undo').default;
const { createStore: create } = require('zustand/vanilla');
const { temporal } = require('zundo');
const { createTravels } = require('../');
const { performance } = require('perf_hooks');

// ============ Utilities ============

function generateComplexObject(targetSizeKB = 100) {
  const obj = {
    id: Math.random().toString(36),
    timestamp: Date.now(),
    metadata: {},
    items: [],
    config: {},
  };

  const stringSize = Math.floor((targetSizeKB * 1024) / 10);
  for (let i = 0; i < 10; i++) {
    obj.items.push({
      id: i,
      name: `Item ${i}`,
      description: 'x'.repeat(stringSize),
      tags: Array(50).fill(0).map((_, j) => `tag-${i}-${j}`),
      nested: {
        level1: {
          level2: {
            level3: {
              data: Array(20).fill(0).map((_, k) => ({
                key: `data-${k}`,
                value: Math.random(),
              })),
            },
          },
        },
      },
    });
  }

  return obj;
}

function measureMemory(label) {
  if (global.gc) {
    global.gc();
  }
  const used = process.memoryUsage();
  console.log(`\n[${label}]`);
  console.log(`  Heap Used: ${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`);
  return used.heapUsed;
}

function measureTime(fn, label) {
  const start = performance.now();
  fn();
  const end = performance.now();
  const duration = Math.round((end - start) * 100) / 100;
  console.log(`  ${label}: ${duration} ms`);
  return duration;
}

function measureSerializedSize(data, label) {
  const serialized = JSON.stringify(data);
  const sizeKB = Math.round(serialized.length / 1024 * 100) / 100;
  console.log(`  ${label}: ${sizeKB} KB`);
  return sizeKB;
}

// ============ Redux-undo Benchmark ============

function testReduxUndo(iterations = 100) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Redux-undo (real implementation)');
  console.log('='.repeat(60));

  const initialState = generateComplexObject(100);

  // Create reducer
  const reducer = (state = initialState, action) => {
    switch (action.type) {
      case 'UPDATE':
        return { ...state, ...action.payload };
      default:
        return state;
    }
  };

  const memBefore = measureMemory('Initial state');

  // Create undoable store
  const undoableReducer = undoable(reducer);
  const store = createStore(undoableReducer);

  // setState benchmark
  console.log('\n--- Test 1: Small consecutive updates ---');
  const setStateTime = measureTime(() => {
    for (let i = 0; i < iterations; i++) {
      store.dispatch({
        type: 'UPDATE',
        payload: {
          id: `modified-${i}`,
          timestamp: Date.now(),
        },
      });
    }
  }, `${iterations} dispatches`);

  const memAfterSetState = measureMemory('After consecutive updates');
  const memUsed = Math.round((memAfterSetState - memBefore) / 1024 / 1024 * 100) / 100;
  console.log(`  Memory increase: ${memUsed} MB`);

  // Undo benchmark
  console.log('\n--- Test 2: Undo performance ---');
  const undoTime = measureTime(() => {
    for (let i = 0; i < Math.min(50, iterations); i++) {
      store.dispatch({ type: '@@redux-undo/UNDO' });
    }
  }, '50 undos');

  // Redo benchmark
  console.log('\n--- Test 3: Redo performance ---');
  const redoTime = measureTime(() => {
    for (let i = 0; i < Math.min(50, iterations); i++) {
      store.dispatch({ type: '@@redux-undo/REDO' });
    }
  }, '50 redos');

  // Serialization benchmark
  console.log('\n--- Test 4: Serialization performance ---');
  const state = store.getState();

  const serializeTime = measureTime(() => {
    JSON.stringify(state);
  }, 'JSON.stringify');

  const serializedSize = measureSerializedSize(state, 'Serialized size');

  const deserializeTime = measureTime(() => {
    JSON.parse(JSON.stringify(state));
  }, 'JSON.parse');

  return {
    label: 'Redux-undo',
    memoryMB: memUsed,
    setStateTime,
    undoTime,
    redoTime,
    serializeTime,
    deserializeTime,
    serializedSizeKB: serializedSize,
  };
}

// ============ Zundo Benchmark (no diff) ============

function testZundoNoDialog(iterations = 100) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Zundo (no diff - real implementation)');
  console.log('='.repeat(60));

  const initialState = generateComplexObject(100);
  const memBefore = measureMemory('Initial state');

  // Create Zustand store with temporal
  const useStore = create(
    temporal((set) => ({
      ...initialState,
      update: (payload) => set((state) => ({ ...state, ...payload })),
    }))
  );

  // setState benchmark
  console.log('\n--- Test 1: Small consecutive updates ---');
  const setStateTime = measureTime(() => {
    for (let i = 0; i < iterations; i++) {
      useStore.getState().update({
        id: `modified-${i}`,
        timestamp: Date.now(),
      });
    }
  }, `${iterations} updates`);

  const memAfterSetState = measureMemory('After consecutive updates');
  const memUsed = Math.round((memAfterSetState - memBefore) / 1024 / 1024 * 100) / 100;
  console.log(`  Memory increase: ${memUsed} MB`);

  // Undo benchmark
  console.log('\n--- Test 2: Undo performance ---');
  const { undo, redo } = useStore.temporal.getState();
  const undoTime = measureTime(() => {
    for (let i = 0; i < Math.min(50, iterations); i++) {
      undo();
    }
  }, '50 undos');

  // Redo benchmark
  console.log('\n--- Test 3: Redo performance ---');
  const redoTime = measureTime(() => {
    for (let i = 0; i < Math.min(50, iterations); i++) {
      redo();
    }
  }, '50 redos');

  // Serialization benchmark
  console.log('\n--- Test 4: Serialization performance ---');
  const temporalState = useStore.temporal.getState();

  const serializeTime = measureTime(() => {
    JSON.stringify(temporalState);
  }, 'JSON.stringify');

  const serializedSize = measureSerializedSize(temporalState, 'Serialized size');

  const deserializeTime = measureTime(() => {
    JSON.parse(JSON.stringify(temporalState));
  }, 'JSON.parse');

  return {
    label: 'Zundo (no diff)',
    memoryMB: memUsed,
    setStateTime,
    undoTime,
    redoTime,
    serializeTime,
    deserializeTime,
    serializedSizeKB: serializedSize,
  };
}

// ============ Travels Benchmark ============

function testTravels(iterations = 100) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Travels (real implementation)');
  console.log('='.repeat(60));

  const initialState = generateComplexObject(100);
  const memBefore = measureMemory('Initial state');

  const travels = createTravels(initialState);

  // setState benchmark
  console.log('\n--- Test 1: Small consecutive updates ---');
  const setStateTime = measureTime(() => {
    for (let i = 0; i < iterations; i++) {
      travels.setState((draft) => {
        draft.id = `modified-${i}`;
        draft.timestamp = Date.now();
      });
    }
  }, `${iterations} setState calls`);

  const memAfterSetState = measureMemory('After consecutive updates');
  const memUsed = Math.round((memAfterSetState - memBefore) / 1024 / 1024 * 100) / 100;
  console.log(`  Memory increase: ${memUsed} MB`);

  // Undo benchmark
  console.log('\n--- Test 2: Undo performance ---');
  const undoTime = measureTime(() => {
    for (let i = 0; i < Math.min(50, iterations); i++) {
      travels.back();
    }
  }, '50 backs');

  // Redo benchmark
  console.log('\n--- Test 3: Redo performance ---');
  const redoTime = measureTime(() => {
    for (let i = 0; i < Math.min(50, iterations); i++) {
      travels.forward();
    }
  }, '50 forwards');

  // Serialization benchmark
  console.log('\n--- Test 4: Serialization performance ---');
  const history = {
    state: travels.getState(),
    patches: travels.getPatches(),
    position: travels.getPosition(),
  };

  const serializeTime = measureTime(() => {
    JSON.stringify(history);
  }, 'JSON.stringify');

  const serializedSize = measureSerializedSize(history, 'Serialized size');

  const deserializeTime = measureTime(() => {
    JSON.parse(JSON.stringify(history));
  }, 'JSON.parse');

  return {
    label: 'Travels',
    memoryMB: memUsed,
    setStateTime,
    undoTime,
    redoTime,
    serializeTime,
    deserializeTime,
    serializedSizeKB: serializedSize,
  };
}

// ============ Run all benchmarks ============

function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('   Undo/Redo performance comparison (real libraries)');
  console.log('█'.repeat(60));
  console.log('\nTest configuration:');
  console.log('  - Initial object size: ~100 KB');
  console.log('  - History length: 100');
  console.log('  - Each update: 2 fields (small changes)');
  console.log('  - Node version:', process.version);
  console.log('  - Run: node --expose-gc real-library-benchmark.js');

  const results = [];

  // Run all tests
  results.push(testReduxUndo(100));
  results.push(testZundoNoDialog(100));
  results.push(testTravels(100));

  // Summary
  console.log('\n\n' + '█'.repeat(60));
  console.log('   Benchmark results summary');
  console.log('█'.repeat(60));

  console.log('\n| Metric | Redux-undo | Zundo | Travels |');
  console.log('|------|-----------|-------|---------|');

  const metrics = [
    { key: 'memoryMB', label: 'Memory (MB)', lower: true },
    { key: 'setStateTime', label: 'setState (ms)', lower: true },
    { key: 'undoTime', label: 'Undo (ms)', lower: true },
    { key: 'redoTime', label: 'Redo (ms)', lower: true },
    { key: 'serializedSizeKB', label: 'Serialized size (KB)', lower: true },
    { key: 'serializeTime', label: 'Serialize (ms)', lower: true },
    { key: 'deserializeTime', label: 'Deserialize (ms)', lower: true },
  ];

  for (const metric of metrics) {
    const values = results.map(r => r[metric.key]);
    const best = metric.lower ? Math.min(...values) : Math.max(...values);

    const row = results.map(r => {
      const value = r[metric.key];
      const isBest = value === best;
      return `${value}${isBest ? ' ⭐' : ''}`;
    });

    console.log(`| ${metric.label} | ${row.join(' | ')} |`);
  }

  // Key findings
  console.log('\n\n' + '█'.repeat(60));
  console.log('   Key findings');
  console.log('█'.repeat(60));

  const travelsResult = results.find(r => r.label === 'Travels');
  const reduxResult = results.find(r => r.label === 'Redux-undo');
  const zundoResult = results.find(r => r.label === 'Zundo (no diff)');

  console.log('\n1. **Memory efficiency**');
  console.log(`   - Travels: ${travelsResult.memoryMB} MB`);
  console.log(`   - Redux-undo: ${reduxResult.memoryMB} MB`);
  console.log(`   - Zundo: ${zundoResult.memoryMB} MB`);
  console.log(`   - Travels vs Redux-undo: saves ${Math.round((1 - travelsResult.memoryMB / reduxResult.memoryMB) * 100)}%`);
  console.log(`   - Travels vs Zundo: saves ${Math.round((1 - travelsResult.memoryMB / zundoResult.memoryMB) * 100)}%`);

  console.log('\n2. **Persistence efficiency**');
  console.log(`   - Travels: ${travelsResult.serializedSizeKB} KB`);
  console.log(`   - Redux-undo: ${reduxResult.serializedSizeKB} KB`);
  console.log(`   - Zundo: ${zundoResult.serializedSizeKB} KB`);
  console.log(`   - Travels vs Redux-undo: saves ${Math.round((1 - travelsResult.serializedSizeKB / reduxResult.serializedSizeKB) * 100)}%`);
  console.log(`   - Travels vs Zundo: saves ${Math.round((1 - travelsResult.serializedSizeKB / zundoResult.serializedSizeKB) * 100)}%`);

  console.log('\n3. **Undo/Redo performance**');
  console.log(`   - Travels undo: ${travelsResult.undoTime} ms`);
  console.log(`   - Redux-undo undo: ${reduxResult.undoTime} ms`);
  console.log(`   - Zundo undo: ${zundoResult.undoTime} ms`);

  console.log('\nNotes:');
  console.log('  - Performance numbers depend on runtime environment and are for reference only');
  console.log('  - Real-world performance depends on your specific use cases');
  console.log('  - Travels shines for large state, small updates, and long histories\n');
}

if (require.main === module) {
  main();
}
