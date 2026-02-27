# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
