# Compatibility Policy

## Runtime Support

Travels is tested on:

- Node.js 20.x
- Node.js 22.x
- jsdom browser-like environment through Vitest

The package is distributed as ESM, CJS, UMD, and TypeScript declarations.

## Browser Support

Travels targets modern browsers that support standard JavaScript collections and JSON APIs. Persistence examples use `localStorage`, IndexedDB, and BroadcastChannel when available.

## Peer Dependencies

`mutative` is a peer dependency and is supported at `>=1.0.0`. The test suite runs against the repository's pinned development version.

## State Compatibility

The durable persistence subset for both state and history metadata is JSON-compatible data: plain objects, dense arrays, strings, finite numbers other than `-0`, booleans, and `null`. `bigint` makes `JSON.stringify` throw; `NaN` and infinities become `null`, while `-0` becomes `0`. Normalize those values or encode them with an application codec. Array holes, custom properties, and custom or null prototypes are not durable across patch replay and JSON persistence; fill empty slots with `null` and use plain arrays and objects. In particular, Mutative does not draft null-prototype state dictionaries by default, so their nested writes may not produce undoable patches.

Map and Set are runtime-supported only in immutable mode and require a custom codec for JSON persistence. Mutable mode is intended for plain object and array reactive stores.

## Versioning

Travels follows semver:

- Patch releases fix bugs without intentional API changes.
- Minor releases may add APIs and warnings while preserving existing behavior.
- Major releases may change public API, persisted schema semantics, or runtime support.

Persisted history snapshots include a schema version. Use `Travels.deserialize(..., { migrate })` when upgrading storage formats.
