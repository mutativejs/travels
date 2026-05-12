# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0](https://github.com/mutativejs/travels/compare/travels-v1.2.0...travels-v1.3.0) (2026-05-12)


### Features

* add product history controls ([4d7fc38](https://github.com/mutativejs/travels/commit/4d7fc3864bab59b5931d1dae8d401eaad19ffc00))
* add versioned persistence api ([8c6f0ce](https://github.com/mutativejs/travels/commit/8c6f0ce9120ff2722e44cd283643b7405261cbd9))
* **core:** implement core feature ([e794d27](https://github.com/mutativejs/travels/commit/e794d27a6475d6a7e39d6e32cb911dc1b4bbc342))
* **mutable:** add mutable in controls instance ([a6c5c22](https://github.com/mutativejs/travels/commit/a6c5c22b0902db73109eda8732b2be3f6f943c5d))
* **mutable:** support mutable mode ([741b7f4](https://github.com/mutativejs/travels/commit/741b7f4e36df876448d6900ce0a462e78ad42496))
* **rebase:** creating rebase history function ([#6](https://github.com/mutativejs/travels/issues/6)) ([936badc](https://github.com/mutativejs/travels/commit/936badcd23c5c690f49fcb28756addf25d8b9520))
* warn on unsupported state shapes ([1c363db](https://github.com/mutativejs/travels/commit/1c363dbdaf9a90b8137e1d29f970d2bedb320247))


### Bug Fixes

* align serialized metadata with patches ([8de61bf](https://github.com/mutativejs/travels/commit/8de61bf3424f258a6a4937f51ab5e7344314a713))
* avoid rebroadcasting remote snapshots ([1608d5a](https://github.com/mutativejs/travels/commit/1608d5a280f92c326a154b98de5bc64447a058bb))
* **back:** fix back issue ([41b57ce](https://github.com/mutativejs/travels/commit/41b57ce55068faf8f1ee7ee11d967ac86faa5a90))
* **canforward:** fix canForward issue ([19de7d3](https://github.com/mutativejs/travels/commit/19de7d3cbbfb3b3410d80ab4a79e65a29ba2decb))
* clone history entry patches ([f8a3049](https://github.com/mutativejs/travels/commit/f8a30491ecbc6ec6247137127047a3a6836f7226))
* clone history metadata ([e431e89](https://github.com/mutativejs/travels/commit/e431e8906a6c0e7ff7188f9437b9aca1d11662d2))
* **clone:** fix clone issue ([ff68886](https://github.com/mutativejs/travels/commit/ff688862af21dd03dadc0e38d1930804a52ee22b))
* fallback local-first snapshots ([71a1a22](https://github.com/mutativejs/travels/commit/71a1a2226141bda3155e122070fca3c7c4c08a6f))
* forward controls archive metadata ([6d6cb25](https://github.com/mutativejs/travels/commit/6d6cb258416ae2decc717bffff1d137fea2916f7))
* **history:** add cache for getHistory ([948686f](https://github.com/mutativejs/travels/commit/948686f12782a543c241c5c2cec80c6b4596af39))
* **history:** handle maxHistory &lt;=0 ([8b64bdc](https://github.com/mutativejs/travels/commit/8b64bdc9b2b9d5fa1ea4de0a54dec070ef498c02))
* include pending history entries ([2449416](https://github.com/mutativejs/travels/commit/2449416253f7794c936de50ec763d229fa5ed48f))
* **initialposition:** fix initialPosition check ([ce86550](https://github.com/mutativejs/travels/commit/ce86550bb1698096e29a4bc39031055f81fd2534))
* isolate nested transactions ([e533bb5](https://github.com/mutativejs/travels/commit/e533bb5a3823b5fe557c3507a2e9a6650939f25d))
* **max-history:** fix rehydrated stores ignore maxHistory when persisted history is longer ([#2](https://github.com/mutativejs/travels/issues/2)) ([7c6ce25](https://github.com/mutativejs/travels/commit/7c6ce25a2d29badf3b411700f948ae3177b9408b))
* **mutable:** fix mutable mode ignores primitive state ([#4](https://github.com/mutativejs/travels/issues/4)) ([dcfe5c1](https://github.com/mutativejs/travels/commit/dcfe5c15c05af0326bece224334618d1e43b7ad5))
* **mutable:** fix mutable mode issue ([ab7bc1a](https://github.com/mutativejs/travels/commit/ab7bc1a88bcef43e1a6bd4b5a6fc868df73b7a12))
* **mutable:** fix root replacement in mutable mode ([9e00e88](https://github.com/mutativejs/travels/commit/9e00e885e0217c537ff06f4e2875faeba83d6ccc))
* **mutable:** fix setState in mutable mode ([e7c977b](https://github.com/mutativejs/travels/commit/e7c977b58acb6b136c1832c481245f2675cabd75))
* **mutable:** update ([bf31cda](https://github.com/mutativejs/travels/commit/bf31cda63a2edee2810a11059120dcdd9009cdd1))
* narrow persisted metadata input ([5e37b74](https://github.com/mutativejs/travels/commit/5e37b740ca021311a27338b9c87e9150b933d928))
* **no-op:** fix no-op issue ([fb3abd2](https://github.com/mutativejs/travels/commit/fb3abd2ca5694a58009a06e4b730b08e9d2e213c))
* **package:** fix package config ([d0e700a](https://github.com/mutativejs/travels/commit/d0e700a36d198a42dfd1efac31c9d29dfb15676a))
* **patches-option:** fix PatchesOption type ([54936d7](https://github.com/mutativejs/travels/commit/54936d7b18877cff2227414fed1664317acf69f9))
* **patches-options:** fix PatchesOptions type issue ([848f101](https://github.com/mutativejs/travels/commit/848f1013c6451df9fbe98356587fafe49afff0f3))
* preserve manual pending metadata ([f02fac7](https://github.com/mutativejs/travels/commit/f02fac7fea89441d66ecbaa86d886fa8e6c68bf2))
* rebase external no-op replacements ([4d57c31](https://github.com/mutativejs/travels/commit/4d57c311659712a6f2f56de408f8734066b49194))
* reject invalid persisted patches ([028872c](https://github.com/mutativejs/travels/commit/028872c06721b50d8fbb6bec7ef61f4ad0d9b0ca))
* reject null persisted metadata ([8bcbee0](https://github.com/mutativejs/travels/commit/8bcbee0afe995515f8f24cc4d9342f0038b44112))
* reject root add remove patches ([3467c93](https://github.com/mutativejs/travels/commit/3467c93d11ef95e2746bfaff31a93c73babeb264))
* reject unsupported persisted patch ops ([6c9389c](https://github.com/mutativejs/travels/commit/6c9389c29da31925cadd1933ea57a5b55d3820ef))
* report benchmark update latency ([1cb2c64](https://github.com/mutativejs/travels/commit/1cb2c64b2ff09128cb774472ca3d76da42f9a839))
* require persisted patch values ([b8d0bb4](https://github.com/mutativejs/travels/commit/b8d0bb40f3e5cd049a247eafa7f25614d8985306))
* reset no-op baseline replacements ([1d42b7d](https://github.com/mutativejs/travels/commit/1d42b7d941a79e1f87a95f77960c0a24b0710d47))
* retain contiguous rehydrated history ([a222bff](https://github.com/mutativejs/travels/commit/a222bffcb0b77012c5a2d677f03283d346958119))
* **return:** fix rawReturn ([e94d9dc](https://github.com/mutativejs/travels/commit/e94d9dc8ce8ef4efb3df7ab600fc38dc3b044429))
* roll back failed transactions ([75ad097](https://github.com/mutativejs/travels/commit/75ad097e32623252688f96b90f66fee041978954))
* serialize pending manual patches ([799d8a8](https://github.com/mutativejs/travels/commit/799d8a83627f9b8805442b15f2208536b8c81dd8))
* **setstate:** handle pendingState race condition arises ([1e64e05](https://github.com/mutativejs/travels/commit/1e64e05d4fa9ee38b02b6a8cdd8b8ad119fffc0c))
* **travels:** fix hasOnlyArrayIndices, maxHistory, and reset edge issue ([8e93e03](https://github.com/mutativejs/travels/commit/8e93e0378c440b7d273edd2767cb5c5a86ea48fd))
* **travels:** harden rehydration defaults and patch history safety ([448048b](https://github.com/mutativejs/travels/commit/448048b5b5b220a3fa64cfdf2d9fcee8179a2547))
* typecheck persistence example ([4d5bac3](https://github.com/mutativejs/travels/commit/4d5bac3a28fe5318bb2c87fedbf53db3dc4c9ff0))
* **type:** fix internal type ([403847e](https://github.com/mutativejs/travels/commit/403847e7e3e378286c577bdd7eb3bf0c0d3e2e29))
* **type:** fix TravelsControls type issue ([4053d7a](https://github.com/mutativejs/travels/commit/4053d7a56be7a59a0f4d4c8e42231962ea90c907))
* **type:** fix type ([8282674](https://github.com/mutativejs/travels/commit/8282674e9b40319b75c46cc0c0df70542764d20f))
* **type:** fix type and add testing ([7e2f126](https://github.com/mutativejs/travels/commit/7e2f1261e31a73ad70bb965e2dc4b1be8986b683))
* **type:** fix type issue ([a214d19](https://github.com/mutativejs/travels/commit/a214d191c81e02e759662b37f472185fb9cbfe7f))
* update vue history status refs ([625aed7](https://github.com/mutativejs/travels/commit/625aed7caf282397556cd64a41c12df1db24986b))
* **updater:** export Updater type ([2683f29](https://github.com/mutativejs/travels/commit/2683f29c7299728f09969890633bbbe9e851717f))
* validate persisted metadata entries ([2e49c24](https://github.com/mutativejs/travels/commit/2e49c245d643e8dea592fd4f8a490f783e31c78e))
* validate persisted string paths ([a6e7377](https://github.com/mutativejs/travels/commit/a6e737773c14be63e721bf456055f7d3abf5f14b))
* wrap vue history methods ([9f3c339](https://github.com/mutativejs/travels/commit/9f3c339074068f140e2674ca47a1390cf2073da7))


### Performance Improvements

* **cache:** add getControls cache ([7c30ff4](https://github.com/mutativejs/travels/commit/7c30ff41a817db6e053f89a95ab58a8ea7033512))

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
