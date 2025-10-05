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

- **Redux-undo / Zundo (no diff)**: store full state snapshots
- **Zundo (with diff)**: store microdiff-generated delta objects
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

| Metric | Redux-undo | Zundo | Zundo+Diff | Travels |
|------|-----------|-------|-----------|---------|
| Memory | High | High | Medium | Low ⭐ |
| setState | Fast ⭐ | Fast ⭐ | Slow | Medium |
| Undo/Redo | Fast ⭐ | Fast ⭐ | Medium | Medium |
| Serialized size | Large | Large | Medium | Small ⭐ |
| Serialization time | Slow | Slow | Medium | Fast ⭐ |

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
