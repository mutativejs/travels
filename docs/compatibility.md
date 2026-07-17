# Compatibility Policy

## Runtime Support

Travels is tested on:

- Node.js 20.x
- Node.js 22.x
- jsdom browser-like environment through Vitest

The package is distributed as ESM, CJS, UMD, and TypeScript declarations.

## Browser Support

Travels targets modern browsers that support the required standard JavaScript and JSON APIs. Persistence examples use `localStorage`, IndexedDB, and BroadcastChannel when available.

## Peer Dependencies

`mutative` is a peer dependency and is supported at `>=1.0.0`. The test suite runs against the repository's pinned development version.

## State Compatibility

State, retained patch values, and history metadata are supported when they use plain objects, dense arrays, strings, finite numbers other than `-0`, booleans, and `null`. Paths must be Travels-accepted JSON Pointer strings or dense arrays of strings/finite non-negative integers; other values are invalid segments. Object-form snapshot fields and patch-container fields must be own data properties; accessors and inherited fields are rejected without evaluation. Restored history containers, patch groups, array paths, and metadata lists must be plain dense arrays without custom own properties or prototypes; frozen plain arrays are accepted. `bigint` makes `JSON.stringify` throw; `NaN` and infinities become `null`, while `-0` becomes `0`. Normalize those values at the application boundary. Array holes, custom properties, and custom or null prototypes are not durable across patch replay and JSON persistence; fill holes with `null` and use plain arrays and objects. Mutative does not draft null-prototype state dictionaries by default, so nested writes may not produce undoable patches. An incompatible value or path retained only in an older patch still makes the snapshot unsafe.

Map and Set are rejected in both immutable and mutable runtime modes. Travels checks initial state and newly generated patch payloads before committing an update; structural restore also rejects collections in state or retained patches. Convert Map entries to a plain record or dense entry array and Set values to a dense array before passing them to Travels; a persistence codec must produce those supported shapes rather than decode collections back into Travels state.

## Versioning

Travels follows semver:

- Patch releases fix bugs without intentional API changes.
- Minor releases may add APIs and warnings while preserving existing behavior.
- Major releases may change public API, persisted schema semantics, or runtime support.

Persisted history snapshots include a schema version. Use `Travels.deserialize(..., { migrate })` when upgrading storage formats.
