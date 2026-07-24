# Travels hardening delivery report

## Repository history

The original uploaded archive did not contain a `.git` directory. A repository
was initialized from that snapshot with this baseline commit:

- `eee6054 chore: import repository baseline`

All hardening work remains as focused, reviewable commits after that baseline.
Use the following command to inspect the complete implementation sequence:

```bash
git log --oneline --reverse eee6054..HEAD
```

The history was intentionally not squashed because the requested delivery
requires each distinct fix, feature, refactor, test, CI, packaging, or
documentation concern to remain independently reviewable.

## Implemented areas

### Controlled journal boundary

- Validate externally recorded patch entries with accessor-safe structural
  normalization.
- Reject invalid operations, malformed or unsafe paths, root add/remove
  operations, missing values, sparse/custom arrays, empty retained entries,
  and one-sided forward/inverse entries.
- Fail closed when controlled patch values cannot be detached without invoking
  accessors or changing runtime semantics.
- Preserve repeated references and cycles inside each detached plain-data patch
  graph while preventing callback mutation from rewriting retained history.
- Validate externally supplied and returned states without relying on
  immutable-state reference caches.
- Preserve internal state, cursor, history, metadata, and observer atomicity
  when validation or controlled application fails.
- Add adversarial regression and mutation coverage for these boundaries.

### Persistence and safe history access

- Add strict persistence compatibility checks and strict serialization.
- Add a patchable-state factory with finite-depth, interface-friendly static
  constraints plus runtime validation of the concrete initial value.
- Add `getHistorySnapshot()` for callers that need detached, independently
  mutable durable history states.
- Extract history reconstruction, caching, and detached snapshot creation into
  a focused internal history view.
- Reject structurally empty or one-sided preloaded and deserialized history
  entries before they can separate cursor position from state.

### Public contracts and diagnostics

- Preserve readonly history through the controls API.
- Keep known event autocomplete while allowing future event names across minor
  releases.
- Add stable runtime error codes and typed runtime errors.
- Add structured `onWarning` callbacks and remove unconditional production
  console warnings.
- Isolate warning callbacks from reentrant Travels mutation.

### Architecture and invariants

- Extract patch ownership utilities, observer dispatch, state transitions,
  mutable transaction rollback, timeline storage, and history views.
- Add development-time timeline invariant checks for cursor bounds, aligned
  forward/inverse entries, metadata alignment, pending manual archives, and
  history limits.
- Preserve the existing synchronous transaction and mutable rollback semantics
  while reducing the responsibilities retained directly in `Travels`.

### Test and quality gates

- Migrate linting to ESLint 9 flat configuration.
- Add per-file coverage thresholds for core modules, including the extracted
  history view.
- Add deterministic mutation smoke checks for replay order, retained-history
  validation, controlled detachment, patchable runtime validation, and mutable
  transaction rollback.
- Make mutation smoke distinguish surviving mutations from baseline,
  infrastructure, signal, and unexpected-exit failures.
- Add property-based reference models for immutable, mutable, controlled,
  manual-archive, transaction, tracking, reset, rebase, navigation, branch
  replacement, and history-trimming behavior.

### CI, packaging, and release engineering

- Split CI into focused quality, Node compatibility, browser, package,
  coverage, mutation, and benchmark jobs.
- Repair workflow dependencies and invalid workflow configuration.
- Align legacy package entry points (`main`/`module`/`exports`) and declare
  Node.js 20+ support.
- Record package version, Git revision, and dirty state in benchmark reports.
- Build one npm tarball, smoke-test that exact extracted artifact through both
  CJS and ESM entry points, upload it, and publish the same tarball without a
  second build.
- Align compatibility, reset, release, controlled-journal, event, failure,
  history-snapshot, and hardening release documentation with the implementation.

## Verification completed in this environment

The following checks completed successfully against the final worktree:

- JavaScript syntax validation for every tracked JavaScript file.
- TypeScript/TSX parser validation for 75 source, test, E2E, example, and
  benchmark files.
- Strict source type-check using a local declaration stub for the unavailable
  `mutative` dependency.
- JSON/JSONC parsing for all tracked configuration and data files.
- YAML parsing for workflows and the pnpm lockfile.
- Root package manifest and pnpm lockfile importer consistency.
- GitHub Actions `needs` dependency validation.
- Mutation-smoke target uniqueness and referenced-test validation.
- Independent self-test of the packed-package verifier with simulated CJS and
  ESM package entries.
- `git diff --check`.
- `git fsck --full`.
- Clean Git worktree verification.

The final delivery archive is also re-extracted after creation and checked for
ZIP integrity, matching `HEAD`, a clean worktree, and complete Git objects.

## Verification not executable here

The environment cannot download the repository-pinned pnpm release or install
registry dependencies. A direct Corepack attempt to fetch `pnpm@10.34.5`
failed at the npm registry. Consequently, this delivery does **not** claim that
these dependency-backed commands ran in this environment:

- Production Rollup build and declaration generation with installed packages.
- ESLint execution.
- Vitest unit, browser, property-based, coverage, and mutation runs.
- Playwright end-to-end runs.
- TypeScript checks using the actual installed Mutative declarations.
- Package-size checks against a freshly built real package.
- Smoke execution of the actual generated npm tarball.
- Performance benchmarks.

The historical benchmark artifact remains identified as a Travels 2.0.0
result; it was not relabeled as 2.1.x. Benchmark tooling now embeds provenance
so a future regeneration cannot be confused with an older run.

## Recommended full verification in a networked environment

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install --frozen-lockfile

pnpm run lint
pnpm run test:types
pnpm run test:examples
pnpm run test
pnpm run test:browser
pnpm run test:e2e:types
pnpm exec playwright install chromium
pnpm run test:e2e
pnpm run coverage
pnpm run test:mutation:smoke
pnpm run size:ci
pnpm run benchmark:ci

pnpm run build
rm -rf release-artifact release-consumer
mkdir -p release-artifact release-consumer
npm pack --pack-destination release-artifact
mv release-artifact/*.tgz release-artifact/travels.tgz
tar -xzf release-artifact/travels.tgz -C release-consumer
node scripts/verify-packed-package.js release-consumer/package
```
