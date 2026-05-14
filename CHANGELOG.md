# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
