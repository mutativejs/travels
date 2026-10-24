# Error Handling (/docs/guides/error-handling)

Travels separates operation errors, persistence decoding errors, non-fatal warnings, and observer failures. Match stable `code` values rather than production error message text.

## Operation errors [#operation-errors]

`TravelsError` extends `Error`; `TravelsTypeError` extends `TypeError`. Both expose a stable `code` and optional `cause`.

```ts
import { TravelsError, TravelsTypeError } from 'travels';

try {
  travels.transaction(updateDocument);
} catch (error) {
  if (error instanceof TravelsError || error instanceof TravelsTypeError) {
    console.error(error.code, error.cause);
  }
  throw error;
}
```

Common codes include:

| Code | Typical meaning |
| --- | --- |
| `ASYNC_CALLBACK` | An updater or transaction returned asynchronous work. |
| `INVALID_OPTION` | Factory or restore options are incompatible or malformed. |
| `INVALID_OPERATION` | The requested operation is not allowed for that capability or state. |
| `UNSUPPORTED_STATE` | State or a patch path violates the runtime state contract. |
| `PERSISTENCE_INCOMPATIBLE` | State, patches, paths, or metadata are not durable. |
| `HISTORY_REPLAY_FAILED` | A retained patch could not be applied during navigation or reconstruction. |
| `TRANSACTION_FAILED` | The atomic operation failed; inspect `cause`. |
| `REENTRANT_MUTATION` | A synchronous observer or controlled callback attempted a nested mutation. |
| `INVALID_PATCH_ENTRY` / `EMPTY_PATCH_ENTRY` | A controlled patch pair is malformed or missing required operations. |
| `UNCLONEABLE_PATCH_VALUE` | A controlled patch value cannot be detached safely. |
| `CONTROLLED_JOURNAL_REQUIRED` | An operation requires a controlled journal. |
| `CONTROLLED_OPERATION_UNAVAILABLE` | A state-owning capability was requested from a journal. |

Use `onError` for wrapped core operation failures, especially when coordinating nested transactions. Keep local `try/catch` around actions whose errors the UI must handle synchronously; do not assume a hook replaces the thrown error.

## Persistence errors [#persistence-errors]

`TravelsPersistenceError` covers decoding, migration, and validation:

| Code | Meaning |
| --- | --- |
| `PARSE_ERROR` | JSON input could not be parsed. |
| `UNSUPPORTED_VERSION` | The snapshot schema version is not supported. |
| `INVALID_SCHEMA` | Snapshot fields, metadata, or position are malformed. |
| `INVALID_PATCHES` | Patch containers, operations, paths, or values are invalid. |
| `INVALID_HISTORY` | Semantic replay or reversibility failed. |
| `MIGRATION_FAILED` | The migration callback failed or returned an invalid/asynchronous result. |
| `FALLBACK_FAILED` | Recovery failed or produced an invalid/asynchronous result. |

Entry-specific semantic failures can also expose `entryIndex` and `direction`. See [Migration and Recovery](/docs/persistence/migration-and-recovery).

## Warnings [#warnings]

`onWarning` receives non-fatal diagnostics with stable codes:

```ts
const travels = createTravels(initialState, {
  onWarning({ code, message }) {
    diagnostics.log({ code, message });
  },
});
```

Warning codes include `HISTORY_DISABLED`, `HISTORY_DISCARDED`, `HISTORY_TRIMMED`, `INVALID_POSITION`, `MUTABLE_FALLBACK`, `MUTABLE_ROOT_REPLACEMENT`, `PERSISTENCE_COMPATIBILITY`, and `POSITION_CLAMPED`.

Without the hook, warnings are written to the console only in development. Disabling compatibility warnings does not disable runtime correctness checks.

## Observer failures [#observer-failures]

Errors thrown by listeners, devtools, branch-discard hooks, error/warning hooks, or compatibility checks after commit are routed to `onObserverError` when configured. They do not interrupt other observers or roll back an already committed transition.

```ts
const travels = createTravels(initialState, {
  onObserverError({ source, error }) {
    reportError({ source, error });
  },
});
```

Observer Promises are not awaited, but rejected Promises are isolated and reported. The application remains responsible for actual asynchronous side-effect recovery.

## Recovery by boundary [#recovery-by-boundary]

- **Invalid caller input:** fix options or state before constructing the timeline; do not continue with a partially initialized owner.
- **Failed transaction:** Travels rolls back writes made through its APIs. Application side effects and direct mutable-store writes need separate handling.
- **Unverified persisted history:** use `validation: 'semantic'` and a known-safe `fallback` before restore.
- **Controlled ingress:** call `assertTravelHistoryEntryRecordable()` before an external commit when the owner cannot roll back a published change.
- **Failed controlled `apply`:** Travels does not advance its own cursor, but cannot undo side effects already performed by the external owner.
- **Replay failure in mutable mode:** writes made before the failing patch can remain. Prefer semantic validation before restoring unverified snapshots.

For integrity and tamper resistance, verify encoded bytes outside Travels before deserialization; replay consistency alone does not prove provenance.
