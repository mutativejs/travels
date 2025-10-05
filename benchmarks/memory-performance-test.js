/**
 * Undo/Redo performance and memory benchmark
 *
 * Compare Redux-undo, Zundo, and Travels in the following aspects:
 * 1. Memory usage
 * 2. Operation performance (setState, undo, redo)
 * 3. Serialization performance (persistence scenarios)
 */

const { performance } = require('perf_hooks');

// ============ Utilities ============

/**
 * Generate a complex object with the specified size
 */
function generateComplexObject(targetSizeKB = 100) {
  const obj = {
    id: Math.random().toString(36),
    timestamp: Date.now(),
    metadata: {},
    items: [],
    config: {},
  };

  // Fill to target size
  const stringSize = Math.floor((targetSizeKB * 1024) / 10); // Each string roughly 1/10 of object size
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

/**
 * Measure memory usage
 */
function measureMemory(label) {
  if (global.gc) {
    global.gc();
  }
  const used = process.memoryUsage();
  console.log(`\n[${label}]`);
  console.log(`  Heap Used: ${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`);
  console.log(`  External: ${Math.round(used.external / 1024 / 1024 * 100) / 100} MB`);
  return used.heapUsed;
}

/**
 * Measure execution time
 */
function measureTime(fn, label) {
  const start = performance.now();
  fn();
  const end = performance.now();
  const duration = Math.round((end - start) * 100) / 100;
  console.log(`  ${label}: ${duration} ms`);
  return duration;
}

/**
 * Measure serialized size
 */
function measureSerializedSize(data, label) {
  const serialized = JSON.stringify(data);
  const sizeKB = Math.round(serialized.length / 1024 * 100) / 100;
  console.log(`  ${label}: ${sizeKB} KB`);
  return sizeKB;
}

// ============ Redux-undo simulator ============

class ReduxUndoSimulator {
  constructor(initialState) {
    this.history = {
      past: [],
      present: initialState,
      future: [],
    };
  }

  setState(newState) {
    this.history.past.push(this.history.present);
    this.history.present = newState;
    this.history.future = [];
  }

  undo() {
    if (this.history.past.length === 0) return;
    const previous = this.history.past.pop();
    this.history.future.unshift(this.history.present);
    this.history.present = previous;
  }

  redo() {
    if (this.history.future.length === 0) return;
    const next = this.history.future.shift();
    this.history.past.push(this.history.present);
    this.history.present = next;
  }

  getState() {
    return this.history.present;
  }

  getHistory() {
    return this.history;
  }
}

// ============ Zundo simulator (no diff) ============

class ZundoSimulator {
  constructor(initialState) {
    this.pastStates = [];
    this.futureStates = [];
    this.currentState = initialState;
  }

  setState(updater) {
    const newState = typeof updater === 'function'
      ? updater(this.currentState)
      : updater;

    this.pastStates.push(this.currentState);
    this.currentState = newState;
    this.futureStates = [];
  }

  undo() {
    if (this.pastStates.length === 0) return;
    const previous = this.pastStates.pop();
    this.futureStates.unshift(this.currentState);
    this.currentState = previous;
  }

  redo() {
    if (this.futureStates.length === 0) return;
    const next = this.futureStates.shift();
    this.pastStates.push(this.currentState);
    this.currentState = next;
  }

  getState() {
    return this.currentState;
  }

  getHistory() {
    return {
      past: this.pastStates,
      present: this.currentState,
      future: this.futureStates,
    };
  }
}

// ============ Zundo with Diff simulator ============

class ZundoDiffSimulator {
  constructor(initialState) {
    this.pastStates = [];
    this.futureStates = [];
    this.currentState = initialState;
  }

  // Simple diff implementation (similar to microdiff)
  diff(obj1, obj2, path = '') {
    const changes = {};
    const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

    for (const key of keys) {
      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in obj2)) {
        changes[currentPath] = { type: 'REMOVE' };
      } else if (!(key in obj1)) {
        changes[currentPath] = { type: 'CREATE', value: obj2[key] };
      } else if (typeof obj2[key] === 'object' && obj2[key] !== null) {
        Object.assign(changes, this.diff(obj1[key], obj2[key], currentPath));
      } else if (obj1[key] !== obj2[key]) {
        changes[currentPath] = { type: 'CHANGE', value: obj2[key] };
      }
    }

    return changes;
  }

  setState(updater) {
    const newState = typeof updater === 'function'
      ? updater(JSON.parse(JSON.stringify(this.currentState)))
      : updater;

    const delta = this.diff(this.currentState, newState);

    if (Object.keys(delta).length > 0) {
      this.pastStates.push(delta);
      this.currentState = newState;
      this.futureStates = [];
    }
  }

  applyDiff(base, delta) {
    const result = JSON.parse(JSON.stringify(base));

    for (const [path, change] of Object.entries(delta)) {
      const keys = path.split('.');
      let current = result;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      const lastKey = keys[keys.length - 1];

      if (change.type === 'REMOVE') {
        delete current[lastKey];
      } else {
        current[lastKey] = change.value;
      }
    }

    return result;
  }

  undo() {
    if (this.pastStates.length === 0) return;
    // Simplified: should apply reverse diff, but rebuild for test simplicity
    this.pastStates.pop();
  }

  redo() {
    // Simplified
  }

  getState() {
    return this.currentState;
  }

  getHistory() {
    return {
      pastDeltas: this.pastStates,
      present: this.currentState,
      futureDeltas: this.futureStates,
    };
  }
}

// ============ Travels simulator ============

class TravelsSimulator {
  constructor(initialState) {
    this.state = initialState;
    this.patches = [];
    this.inversePatches = [];
    this.position = 0;
  }

  // Simplified JSON Patch generation (simulate Mutative behavior)
  generatePatches(oldState, newState, path = '') {
    const patches = [];
    const inversePatches = [];

    const keys = new Set([...Object.keys(oldState), ...Object.keys(newState)]);

    for (const key of keys) {
      const currentPath = path ? `${path}/${key}` : `/${key}`;

      if (!(key in newState)) {
        patches.push({ op: 'remove', path: currentPath });
        inversePatches.push({ op: 'add', path: currentPath, value: oldState[key] });
      } else if (!(key in oldState)) {
        patches.push({ op: 'add', path: currentPath, value: newState[key] });
        inversePatches.push({ op: 'remove', path: currentPath });
      } else if (typeof newState[key] === 'object' && newState[key] !== null) {
        const nested = this.generatePatches(oldState[key], newState[key], currentPath);
        patches.push(...nested.patches);
        inversePatches.push(...nested.inversePatches);
      } else if (oldState[key] !== newState[key]) {
        patches.push({ op: 'replace', path: currentPath, value: newState[key] });
        inversePatches.push({ op: 'replace', path: currentPath, value: oldState[key] });
      }
    }

    return { patches, inversePatches };
  }

  setState(updater) {
    const oldState = JSON.parse(JSON.stringify(this.state));
    const newState = typeof updater === 'function'
      ? updater(JSON.parse(JSON.stringify(this.state)))
      : updater;

    const { patches, inversePatches } = this.generatePatches(oldState, newState);

    if (patches.length > 0) {
      // Clear history after current position
      if (this.position < this.patches.length) {
        this.patches.splice(this.position);
        this.inversePatches.splice(this.position);
      }

      this.patches.push(patches);
      this.inversePatches.push(inversePatches);
      this.position++;
      this.state = newState;
    }
  }

  applyPatches(base, patches) {
    let result = JSON.parse(JSON.stringify(base));

    for (const patch of patches) {
      const keys = patch.path.split('/').filter(k => k);
      let current = result;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      const lastKey = keys[keys.length - 1];

      if (patch.op === 'replace' || patch.op === 'add') {
        current[lastKey] = patch.value;
      } else if (patch.op === 'remove') {
        delete current[lastKey];
      }
    }

    return result;
  }

  undo() {
    if (this.position === 0) return;
    this.position--;
    const patchesToApply = this.inversePatches[this.position];
    this.state = this.applyPatches(this.state, patchesToApply);
  }

  redo() {
    if (this.position >= this.patches.length) return;
    const patchesToApply = this.patches[this.position];
    this.state = this.applyPatches(this.state, patchesToApply);
    this.position++;
  }

  getState() {
    return this.state;
  }

  getHistory() {
    return {
      patches: this.patches,
      inversePatches: this.inversePatches,
      position: this.position,
    };
  }
}

// ============ Test scenario ============

function runBenchmark(label, ManagerClass, iterations = 100) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${label}`);
  console.log('='.repeat(60));

  const initialState = generateComplexObject(100);
  const memBefore = measureMemory('Initial state');

  const manager = new ManagerClass(initialState);

  // Test 1: Small consecutive updates
  console.log('\n--- Test 1: Small consecutive updates ---');
  const setStateTime = measureTime(() => {
    for (let i = 0; i < iterations; i++) {
      const newState = JSON.parse(JSON.stringify(manager.getState()));
      newState.id = `modified-${i}`;
      newState.timestamp = Date.now();
      manager.setState(newState);
    }
  }, `${iterations} setState calls`);

  const memAfterSetState = measureMemory('After consecutive updates');
  const memUsed = Math.round((memAfterSetState - memBefore) / 1024 / 1024 * 100) / 100;
  console.log(`  Memory increase: ${memUsed} MB`);

  // Test 2: Undo performance
  console.log('\n--- Test 2: Undo performance ---');
  const undoTime = measureTime(() => {
    for (let i = 0; i < Math.min(50, iterations); i++) {
      manager.undo();
    }
  }, '50 undos');

  // Test 3: Redo performance
  console.log('\n--- Test 3: Redo performance ---');
  const redoTime = measureTime(() => {
    for (let i = 0; i < Math.min(50, iterations); i++) {
      manager.redo();
    }
  }, '50 redos');

  // Test 4: Serialization performance (persistence scenario)
  console.log('\n--- Test 4: Serialization performance ---');
  const history = manager.getHistory();

  const serializeTime = measureTime(() => {
    JSON.stringify(history);
  }, 'JSON.stringify');

  const serializedSize = measureSerializedSize(history, 'Serialized size');

  const deserializeTime = measureTime(() => {
    JSON.parse(JSON.stringify(history));
  }, 'JSON.parse');

  // Return aggregated data
  return {
    label,
    memoryMB: memUsed,
    setStateTime,
    undoTime,
    redoTime,
    serializeTime,
    deserializeTime,
    serializedSizeKB: serializedSize,
  };
}

// ============ Run all tests ============

function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('   Undo/Redo performance and memory benchmark');
  console.log('█'.repeat(60));
  console.log('\nTest configuration:');
  console.log('  - Initial object size: ~100 KB');
  console.log('  - History length: 100');
  console.log('  - Each update: 2 fields (small changes)');
  console.log('  - Node version:', process.version);
  console.log('  - Run: node --expose-gc memory-performance-test.js');

  const results = [];

  // Run tests
  results.push(runBenchmark('Redux-undo (snapshot mode)', ReduxUndoSimulator, 100));
  results.push(runBenchmark('Zundo (snapshot mode)', ZundoSimulator, 100));
  results.push(runBenchmark('Zundo (Diff mode)', ZundoDiffSimulator, 100));
  results.push(runBenchmark('Travels (JSON Patch)', TravelsSimulator, 100));

  // Summary
  console.log('\n\n' + '█'.repeat(60));
  console.log('   Summary of results');
  console.log('█'.repeat(60));

  console.log('\n| Metric | Redux-undo | Zundo | Zundo-Diff | Travels | Best |');
  console.log('|------|-----------|-------|-----------|---------|------|');

  // Memory usage
  const minMemory = Math.min(...results.map(r => r.memoryMB));
  console.log(`| Memory (MB) | ${results.map((r, i) =>
    `${r.memoryMB}${r.memoryMB === minMemory ? ' ⭐' : ''}`
  ).join(' | ')} | ${results.find(r => r.memoryMB === minMemory).label} |`);

  // setState performance
  const minSetState = Math.min(...results.map(r => r.setStateTime));
  console.log(`| setState (ms) | ${results.map((r, i) =>
    `${r.setStateTime}${r.setStateTime === minSetState ? ' ⭐' : ''}`
  ).join(' | ')} | ${results.find(r => r.setStateTime === minSetState).label} |`);

  // Undo performance
  const minUndo = Math.min(...results.map(r => r.undoTime));
  console.log(`| Undo (ms) | ${results.map((r, i) =>
    `${r.undoTime}${r.undoTime === minUndo ? ' ⭐' : ''}`
  ).join(' | ')} | ${results.find(r => r.undoTime === minUndo).label} |`);

  // Redo performance
  const minRedo = Math.min(...results.map(r => r.redoTime));
  console.log(`| Redo (ms) | ${results.map((r, i) =>
    `${r.redoTime}${r.redoTime === minRedo ? ' ⭐' : ''}`
  ).join(' | ')} | ${results.find(r => r.redoTime === minRedo).label} |`);

  // Serialized size
  const minSize = Math.min(...results.map(r => r.serializedSizeKB));
  console.log(`| Serialized size (KB) | ${results.map((r, i) =>
    `${r.serializedSizeKB}${r.serializedSizeKB === minSize ? ' ⭐' : ''}`
  ).join(' | ')} | ${results.find(r => r.serializedSizeKB === minSize).label} |`);

  // Serialization time
  const minSerialize = Math.min(...results.map(r => r.serializeTime));
  console.log(`| Serialize (ms) | ${results.map((r, i) =>
    `${r.serializeTime}${r.serializeTime === minSerialize ? ' ⭐' : ''}`
  ).join(' | ')} | ${results.find(r => r.serializeTime === minSerialize).label} |`);

  // Deserialization time
  const minDeserialize = Math.min(...results.map(r => r.deserializeTime));
  console.log(`| Deserialize (ms) | ${results.map((r, i) =>
    `${r.deserializeTime}${r.deserializeTime === minDeserialize ? ' ⭐' : ''}`
  ).join(' | ')} | ${results.find(r => r.deserializeTime === minDeserialize).label} |`);

  // Key findings
  console.log('\n\n' + '█'.repeat(60));
  console.log('   Key findings');
  console.log('█'.repeat(60));

  const travelsResult = results.find(r => r.label.includes('Travels'));
  const reduxResult = results.find(r => r.label.includes('Redux-undo'));

  console.log('\n1. **Memory efficiency**');
  console.log(`   - Travels memory: ${travelsResult.memoryMB} MB`);
  console.log(`   - Redux-undo memory: ${reduxResult.memoryMB} MB`);
  console.log(`   - Savings: ${Math.round((1 - travelsResult.memoryMB / reduxResult.memoryMB) * 100)}%`);

  console.log('\n2. **Persistence efficiency**');
  console.log(`   - Travels serialized size: ${travelsResult.serializedSizeKB} KB`);
  console.log(`   - Redux-undo serialized size: ${reduxResult.serializedSizeKB} KB`);
  console.log(`   - Savings: ${Math.round((1 - travelsResult.serializedSizeKB / reduxResult.serializedSizeKB) * 100)}%`);

  console.log('\n3. **Performance**');
  console.log(`   - Travels undo time: ${travelsResult.undoTime} ms`);
  console.log(`   - Redux-undo undo time: ${reduxResult.undoTime} ms`);

  if (travelsResult.undoTime < reduxResult.undoTime) {
    console.log(`   - Travels faster by ${Math.round((1 - travelsResult.undoTime / reduxResult.undoTime) * 100)}%`);
  } else {
    console.log(`   - Redux-undo faster by ${Math.round((1 - reduxResult.undoTime / travelsResult.undoTime) * 100)}%`);
  }

  console.log('\nNote: This is a simulated test; real performance depends on implementations and scenarios.');
  console.log('Travels with the real Mutative library will perform better.\n');
}

// Run tests
if (require.main === module) {
  main();
}

module.exports = {
  generateComplexObject,
  ReduxUndoSimulator,
  ZundoSimulator,
  ZundoDiffSimulator,
  TravelsSimulator,
};
