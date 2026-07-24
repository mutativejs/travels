# Testing Strategy

Travels combines example-based, property-based, browser, package-consumer, coverage, and mutation smoke tests.

## Mutation smoke test

Run:

```bash
pnpm run test:mutation:smoke
```

The smoke suite temporarily introduces a small set of high-value correctness regressions and verifies that focused tests fail. Every source file is restored in a `finally` block. The mutations cover backward replay ordering, controlled journal patch-pair validation, and mutable transaction rollback completeness.

This is intentionally a deterministic gate rather than a broad probabilistic mutation campaign. Add a mutation whenever a bug fix depends on a subtle operator, boundary, or rollback step that line coverage alone would not protect.
