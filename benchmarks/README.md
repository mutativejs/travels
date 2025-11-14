# Travels Performance & Memory Benchmarks

This directory contains performance and memory benchmarks comparing Redux-undo, Zundo, and Travels.

## Test Scripts

### 1. `memory-performance-test.js` - Simulated implementations

Uses simplified simulated implementations to quickly compare core differences.

**Pros:**

- No dependencies to install
- Fast to run
- Clearly shows core algorithm differences

**Run:**

```bash
node --expose-gc memory-performance-test.js
```

### 2. `real-library-benchmark.js` - Real libraries

Uses real npm packages to reflect real-world scenarios.

**Pros:**

- Real environment behavior
- Accurate performance numbers
- Includes full library overhead

**Run:**

```bash
# Install dependencies
npm install

# Run benchmark
npm run test:real

# Or run manually
node --expose-gc real-library-benchmark.js
```

## Test Scenarios

All tests use the same scenario:

- **Initial object size**: ~100 KB (nested objects, arrays)
- **Number of operations**: 100 updates
- **Update type**: Small changes (only 2 fields per update)
- **Metrics**:
  - Memory usage
  - setState/dispatch performance
  - Undo performance
  - Redo performance
  - Serialized size (persistence)
  - Serialization/deserialization performance

## Why `--expose-gc`?

The `--expose-gc` flag allows manual garbage collection (GC), which helps:

1. Measure memory usage more accurately
2. Reduce GC timing interference
3. Produce more stable results

## Metrics Explained

### Memory usage

Measure memory growth after 100 operations.

- **Redux-undo / Zundo**: store full state snapshots
- **Travels**: store JSON Patch

### setState performance

Measure total time for 100 state updates.

### Undo/Redo performance

Measure the time to perform 50 consecutive undos and redos.

### Serialization

Measure serialized history size and serialization/deserialization times.

**Important when:**

- Persisting to localStorage
- Using IndexedDB
- Cross tab/worker messaging
- Cloud sync

## Expected Results

Based on design principles, expected results:

| Metric             | Redux-undo | Zundo   | Travels  |
| ------------------ | ---------- | ------- | -------- |
| Memory             | High       | High    | Low ⭐   |
| setState           | Fast ⭐    | Fast ⭐ | Medium   |
| Undo/Redo          | Fast ⭐    | Fast ⭐ | Medium   |
| Serialized size    | Large      | Large   | Small ⭐ |
| Serialization time | Slow       | Slow    | Fast ⭐  |

### Why is Travels setState relatively slower?

Because Travels generates JSON Patch, which involves:

1. Calculating the diff
2. Creating patch objects

**But the overhead is worth it:**

- Much smaller memory footprint
- Much faster serialization
- Standardized operation log

### When Travels shines

Travels has clear advantages in:

1. ✅ **Large state, small updates**
   - 1MB document, change one field
   - Redux-undo: store two 1MB snapshots
   - Travels: store one small patch

2. ✅ **Long history**
   - Keep 100+ history entries
   - Memory and serialization differences amplify

3. ✅ **Persistence**
   - localStorage (5-10MB limits)
   - Cloud sync (less traffic)
   - Cross-environment messaging

4. ✅ **Operation logs needed**
   - Auditing
   - Debugging
   - User behavior analysis

## Run all tests

```bash
npm run test:all
```

This will run in order:

1. Simulated implementations
2. Real libraries

## Latest Results (Node v22.21.1)

The tables below capture the output from running `yarn test:all` (which executes both benchmark scripts with `node --expose-gc`) on the current machine.

### Simulated implementations (`memory-performance-test.js`)

| Metric               | Redux-undo | Zundo     | Travels  |
| -------------------- | ---------- | --------- | -------- |
| Memory (MB)          | 11.8       | 11.8      | **0.32** |
| setState (ms)        | 42.74      | **41.27** | 88.16    |
| Undo (ms)            | 0.08       | **0.07**  | 18.65    |
| Redo (ms)            | 0.12       | **0.02**  | 20.34    |
| Serialized size (KB) | 11,626.66  | 11,626.46 | **20.6** |
| Serialize (ms)       | 12.86      | 11.88     | **0.06** |
| Deserialize (ms)     | 23.6       | 23.55     | **0.14** |

- Travels keeps simulated history sizes tiny (20.6 KB vs ~11 MB snapshots) and serializes >200x faster, while snapshot stores remain unbeatable for undo/redo latency.
- The Travels simulated setState cost (88 ms for 100 updates) is roughly 2x the snapshot stores, which matches expectations for generating JSON Patch.

### Real libraries (`real-library-benchmark.js`)

| Metric               | Redux-undo | Zundo     | Travels    |
| -------------------- | ---------- | --------- | ---------- |
| Memory (MB)          | 0.05       | **0.04**  | 0.16       |
| setState (ms)        | 0.35       | **0.3**   | 1.81       |
| Undo (ms)            | 0.25       | **0.12**  | 0.69       |
| Redo (ms)            | **0.07**   | 0.15      | 0.27       |
| Serialized size (KB) | 11,742.03  | 11,510.59 | **116.26** |
| Serialize (ms)       | 12.63      | 11.59     | **0.61**   |
| Deserialize (ms)     | 28.87      | 22.66     | **0.42**   |

- Even with real packages, Travels shrinks serialized history by roughly 100x and finishes (de)serialization in well under a millisecond.
- Snapshot-based stacks still win the hot-path operations (setState/undo/redo), so use cases prioritizing raw speed over persistence will still prefer Redux-undo/Zundo.

## Customize parameters

You can modify parameters in the scripts:

```javascript
// Adjust object size
const initialState = generateComplexObject(200); // change to 200KB

// Adjust number of operations
results.push(testTravels(500)); // change to 500 operations
```

## Environment

- Node.js >= 14
- Enough memory (4GB+ recommended)

## Notes

1. **Close other apps**: to improve accuracy

2. **Run multiple times**: V8 JIT and GC affect numbers; average results

3. **Relative differences matter**: absolute values vary by environment

4. **Scenario dependent**:
   - Small state: snapshot-based may be faster
   - Large changes: diff-based less advantageous
   - Large state + small changes + long history: Travels best

## Benchmarking best practices

To get accurate results:

```bash
# 1. Ensure consistent Node.js version
node --version

# 2. Clear npm cache
npm cache clean --force

# 3. Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# 4. Restart terminal before running
# 5. Close other apps
# 6. Run multiple times and average
for i in {1..3}; do
  echo "=== Run $i ==="
  npm run test:real
  sleep 5
done
```

## Contributing

If you find issues or have suggestions, please open an issue or PR!

## Resources

- [Travels repository](https://github.com/mutativejs/travels)
- [Mutative performance comparison](https://mutative.js.org/docs/getting-started/performance)
- [Redux-undo](https://github.com/omnidan/redux-undo)
- [Zundo](https://github.com/charkour/zundo)
