# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Add opt-in persisted-history semantic validation with `validation: 'semantic'`, configurable Mutative `strict`/`mark` replay options, and `INVALID_HISTORY` diagnostics that identify the failing entry and replay direction.
- Add `ARRAY_SHAPE` and `OBJECT_SHAPE` state-compatibility diagnostics and a dedicated structural/semantic restore benchmark guard; compatibility scans inspect descriptors without invoking accessors and recognize intentional auto-freeze output.

### Fixed

- Preserve inverse patch operation order for compound history entries and compose pending manual changes without rediffing the full state.
- Publish listeners, devtools, and branch-discard hooks only after their transitions commit; failed transactions no longer leak provisional observer effects.
- Defer nested transaction `onError` hooks until the root transaction commits or rolls back, and report a bubbling failure only once.
- Report rejected listener, devtools, and lifecycle-hook promises through `onObserverError` instead of leaving unhandled rejections.
- Keep `onBranchDiscard` aligned with the committed root-transaction timeline, including reset, rebase, nested rollback, pending entries extended inside a transaction, and branches created only by provisional transaction steps.
- Compare array length and hole topology on a detached semantic replay graph, preventing opaque values from mutating caller-owned snapshots or hiding irreversible patches through shared identity.
- Reject semantic comparisons for unsupported prototypes, built-in subclasses, changed property descriptors or object extensibility, non-durable own-property shapes, and RegExp cursors whose observable state cannot be preserved safely.
- Keep semantic state-key comparison linear so wide untrusted snapshots cannot trigger quadratic replay validation.
- Reuse one isolated ordinary-object replay graph across semantic-validation entries and directions, while retaining per-entry isolation for aliases, cycles, intrinsics, and custom Mutative markers.
- Accept semantic round trips that reorder plain-object own keys, because JSON Patch replay re-appends re-added keys and cannot preserve enumeration order; the key set and values must still round-trip.
- Validate empty persisted timelines through the semantic isolation pipeline so unsupported anchors cannot bypass fallback recovery.
- Include persisted metadata in semantic isolation so unsupported values and accessors cannot bypass fallback recovery.
- Omit unrelated entry and direction fields from whole-graph semantic isolation failures while retaining precise diagnostics for entry-specific replay failures.
- Scan restored compatibility data once and inspect only the newly committed history entry on ordinary updates, avoiding quadratic development-mode diagnostics as retained history grows.
- Diagnose null-prototype objects whose nested writes are not drafted into undoable history by default.
- Diagnose non-durable state, patch values/paths, and history metadata before JSON persistence rejects or changes a snapshot.
- Restore unverified storage and cross-tab snapshots with semantic validation in the official persistence examples, including fallback E2E coverage for unreplayable histories.
- Reject Promise-like migration and function-fallback results with `MIGRATION_FAILED` or `FALLBACK_FAILED`, enforce synchronous migration returns in TypeScript, and consume rejected results without leaking unhandled Promise rejections.
- Reject sparse, extended, or custom-prototype history/path arrays during structural validation, and copy accepted patch groups without invoking caller-overridable array instance methods.
- Reject Map and Set instances created in another JavaScript realm at runtime and persistence boundaries.
- Canonicalize object-form patch operations from own data properties so accessors cannot bypass validation or execute during history cloning.
- Delay auto-freezing candidate updates until Map/Set validation succeeds so rejected updates leave caller-owned values untouched.
- Capture object-form snapshot and patch-container fields once from own data properties, rejecting accessors and inherited fields without evaluating them.
- Skip collection traversal for primitive-only patch streams and cache validated object patch values at their roots, preserving repeated-subtree reuse without penalizing fresh payloads.
- Reconcile deferred compatibility diagnostics with the final retained transaction history and render JSON Pointer array indices with bracket notation.

### Changed

- Strip development-only incremental compatibility scans from production bundles and recalibrate package-size budgets for the new transaction, observer, and validation safeguards.
- **Breaking:** Publish one shared `TravelsEvent` object to subscribers and devtools, with lazily materialized event-local state transition patches and retained `historyLength`, instead of positional subscriber arguments or complete retained-history snapshots. Use `getPatches()` for an explicit full-history snapshot.
- **Breaking:** Remove Map and Set from the supported state contract in immutable mode; both runtime modes now reject collection-bearing initial state and updates, while restored state and retained patch payloads fail structural validation.
- Require restored patch paths to use JSON Pointer strings or dense arrays of strings/non-negative integers; runtime-only collection locators are no longer accepted.
- Keep structural persistence validation as the synchronous default for backward-compatible restore latency; applications should explicitly select semantic validation for unverified or potentially corrupted snapshots.
- Materialize observer patch-history snapshots lazily, skip branch snapshots when no discard hook is configured, and discard superseded root-replacement patches to avoid copying or retaining history that no observer or replay can use.

### Documentation

- Define plain dense arrays as the durable persistence contract; holes, custom properties, and custom prototypes remain usable only where callers accept their runtime limitations.
- Document the provenance boundary: replay validation can detect malformed or inconsistent patches, but only an external trusted checksum, signature, revision, or authoritative log can distinguish a self-consistent alternative history.
- Define mutable transaction rollback as covering only changes made through Travels APIs; direct writes to the live state remain outside the journal and survive rollback.

## [1.4.0] - 2026-07-12

### Fixed

- Preserve pending manual changes when enforcing `maxHistory`, including at the smallest capacities.
- Keep mutable-mode root references stable when failed updates roll back or `reset()` restores a compatible object or array root.
- Preserve configured Mutative options while replaying history, and restore tracking state after failed transactions.
- Isolate transaction archive behavior from the configured manual or automatic archive mode.
- Reject asynchronous state updaters and transaction callbacks instead of allowing changes to escape the synchronous history boundary.
- Reject disabled patch generation and malformed or unsafe persisted patch structures before replay.
- Validate persistence fallbacks and report throwing or invalid fallbacks as `FALLBACK_FAILED` without allowing observers to block recovery.
- Remove Node-only `process` references from browser bundles and make declarations resolve under TypeScript `NodeNext`.

### Changed

- Ship only the documented CJS, ESM, and UMD JavaScript bundles instead of intermediate compiler output, and validate source maps and package size budgets in CI and release workflows.
- Run CI for fork pull requests and complete npm trusted publishing with a supported Node/npm combination and no long-lived publish token.
- Build and load the current package artifact explicitly before running performance benchmarks.
- Derive documented release tags from the package version.
- Standardize reproducible local development, benchmarks, CI, and release builds on pnpm.

## [1.3.1] - 2026-05-16

### Fixed

- Wrap object values returned from `setState(() => value)` only when they do not contain Mutative drafts, removing noisy Mutative warnings while preserving draft-returning updater behavior.
- Avoid Mutative warnings when manual `archive()` merges pending patches.
- Avoid scheduling pending-state cleanup microtasks for no-op updates.
- Avoid duplicate subscriber and devtools notifications for clean `replaceStateWithoutHistory` no-ops while preserving mutable external-state rebasing.
- Fix release workflow polling for dispatched API Docs runs, including empty run conclusions while the deployment is still in progress.

### Changed

- Reuse a single cloned patches snapshot for subscribers and devtools callbacks during each change event.
- Build API docs before npm publish, then deploy GitHub Pages from the validated release tag after npm publishing succeeds.

### Documentation

- Clarify that `subscribe` patch snapshots and `getHistory()` arrays and entries are shared read-only data.
- Clarify the release checklist for tag-driven npm publishing and GitHub Pages deployment.

## [1.3.0] - 2026-05-15

### Added

- Add versioned persistence APIs for serializing and restoring state, history, position, metadata, and schema version.
- Add persistence migration hooks and compatibility checks for safely loading older or unsupported snapshots.
- Add warnings for unsupported state shapes so applications can detect values that are unsafe for JSON Patch persistence.
- Add product-oriented history controls for archive metadata, pending history entries, manual pending metadata, and status reporting.
- Add integration examples for persistence adapters, local-first persistence, form builders, canvas editors, MobX, Pinia, Vue, and Zustand.
- Add browser, property-based, persistence, product API, Vue example, and type-level test coverage.

### Fixed

- Validate persisted patches, patch paths, metadata entries, patch values, unsupported operations, and root add/remove operations before rehydration.
- Roll back failed transactions and isolate nested transactions to keep history and state consistent.
- Preserve, clone, serialize, and forward history metadata and pending manual patches consistently.
- Retain contiguous rehydrated history while respecting `maxHistory`.
- Keep Vue history methods and status refs in sync after controls updates.
- Avoid rebroadcasting remote snapshots and provide safer local-first snapshot fallback behavior.
- Handle rebase and reset no-op replacements without corrupting baseline history.

### Changed

- GitHub Pages and npm publishing now run only from explicit `v*` release tags.
- Release tags must match the `package.json` version exactly, with a leading `v`.
- Tag releases now run the full CI, e2e, coverage, and benchmark gates before npm publishing or GitHub Pages deployment.
- Ordinary pushes to `main` now run CI only and no longer publish docs, publish npm, or create release PRs.
- Update release documentation to use manual version and changelog commits followed by explicit tag publishing.

### Documentation

- Clarify README positioning, persistence usage, compatibility guidance, and framework integration paths.
- Add compatibility, migration, and release checklist documentation.

## [1.2.0] - 2026-04-22

### Added

- Add rebasable history support for reconciling undo/redo history with external state changes.

### Documentation

- Document rebasable controls and form manager integration guidance.

## [1.1.0] - 2026-02-28

### Fixed

- Preserve `Map`/`Set` values when cloning patch history for `getPatches()` and rehydration.
- Keep `reset()` baseline isolated for `Map`/`Set` states even when `structuredClone` is unavailable.

### Changed

- `maxHistory` now strictly requires a non-negative integer. Invalid values such as `NaN`, `Infinity`, and decimals throw an error.
- Invalid `initialPatches` now default to safe fallback (discard persisted history and continue). Set `strictInitialPatches: true` to opt into fail-fast throws.

## [1.0.0] - 2026-01-24

🎉 **First Stable Release**

Travels is a fast, framework-agnostic undo/redo library powered by Mutative JSON Patch. This v1.0.0 release marks the library as production-ready after extensive testing and refinement.

### Highlights

- **10x faster** than traditional snapshot-based undo systems
- **Memory-efficient** - stores only JSON Patches, not full state copies
- **Framework-agnostic** - works with React, Vue, Zustand, MobX, Pinia, or vanilla JS
- **Full TypeScript support** with comprehensive type definitions

### Features

- **Core API**: `createTravels()` with `setState`, `back`, `forward`, `go`, `reset`
- **History Management**: `getHistory()`, `getPosition()`, `getPatches()`, `canBack()`, `canForward()`
- **Mutable Mode**: Keep reactive state references stable for MobX, Vue/Pinia integration
- **Manual Archive Mode**: Batch multiple changes into a single undo step with `autoArchive: false`
- **Persistence Support**: Save and restore history with `initialPatches` and `initialPosition`
- **Controls API**: `getControls()` for easy UI binding
- **Configurable Options**: `maxHistory`, `enableAutoFreeze`, `strict`, `mark`, `patchesOptions`

### Bug Fixes (since v0.9.0)

- Fixed root replacement handling in mutable mode
- Fixed `hasOnlyArrayIndices`, `maxHistory`, and reset edge cases
- Fixed `pendingState` race condition in `setState`

### Performance

- Added caching for `getControls()` and `getHistory()`

### Documentation

- Comprehensive README with API reference
- Framework integration examples (React, Vue, Zustand)
- Advanced patterns guide (`docs/advanced-patterns.md`)
- Mutable mode deep dive (`docs/mutable-mode.md`)

### Breaking Changes

None. This is the first stable release.

---

## [0.9.0] - Previous Release

See git history for changes prior to v1.0.0.
