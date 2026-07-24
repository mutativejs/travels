# Testing Strategy

Travels combines example-based, property-based, browser, package-consumer, coverage, and mutation smoke tests.

## Mutation smoke test

Run:

```bash
pnpm run test:mutation:smoke
```

The smoke suite temporarily introduces a small set of high-value correctness regressions and verifies that focused tests fail. Every source file is restored in a `finally` block. The mutations cover backward replay ordering, controlled journal patch-pair validation, and mutable transaction rollback completeness.

This is intentionally a deterministic gate rather than a broad probabilistic mutation campaign. Add a mutation whenever a bug fix depends on a subtle operator, boundary, or rollback step that line coverage alone would not protect.

## Hot-path budgets

Run:

```bash
pnpm run benchmark:hotpath
```

The matrix benchmark guards `setState` throughput and serialized history size.
It does not cover undo/redo navigation or the controlled journal, and a change
that made controlled navigation 53x slower and external commits 5.5x slower
than the 2.1.0 line passed it unnoticed.

`benchmarks/hot-path-check.js` measures per-operation cost for `setState`,
navigation, transactions, and both controlled-journal paths, and fails the
build when one exceeds its budget. The budgets are order-of-magnitude smoke
limits, set far above the measured cost so shared CI runners do not flake; each
scenario takes the best of three runs for the same reason. They are not
percent-level drift detectors. Tighten a budget only alongside a measured
improvement, and add a scenario whenever a new operation joins the timeline's
hot path.
