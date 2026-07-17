# Persistence Integrations

Travels persistence is storage-agnostic. The only value that needs to be stored is the versioned snapshot returned by `travels.serialize()`. Restore it with `Travels.deserialize(...)`, then pass the validated history back to `createTravels(...)`.

This guide shows production-oriented adapters for:

- Dexie.js
- idb
- localForage
- localspace

The API notes below were checked against the current docs and npm package metadata on 2026-05-15:

| Library     | Checked package      | Storage model                                                                                                     | Best fit                                                                                   |
| ----------- | -------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Dexie.js    | `dexie@4.4.2`        | IndexedDB tables, indexes, transactions, rich queries                                                             | Multiple documents, searchable snapshot catalogs, custom cleanup queries                   |
| idb         | `idb@8.0.3`          | Thin promise wrapper over native IndexedDB                                                                        | Small IndexedDB adapter with explicit schema control                                       |
| localForage | `localforage@1.10.0` | Async key-value API over IndexedDB and localStorage, with a legacy WebSQL driver for old browsers                 | Simple browser key-value persistence with legacy compatibility                             |
| localspace  | `localspace@1.2.0`   | localForage-compatible async key-value API with IndexedDB/localStorage drivers, batch APIs, transactions, plugins | TypeScript-first key-value persistence, batching, plugin-driven TTL/compression/encryption |

The Playwright e2e suite exercises these adapter patterns against the real browser storage implementations. It also seeds structurally valid but unreplayable histories to verify semantic validation and fallback recovery. The fixture uses test-specific database names, but keeps the save, load, transaction, and cleanup semantics aligned with the examples below.

## Snapshot Contract

Use the whole serialized snapshot as a single storage record. It contains the state, patch history, current position, optional metadata, and the Travels schema version.

```ts
import {
  createTravels,
  Travels,
  TravelsPersistenceError,
  TRAVELS_HISTORY_SCHEMA_VERSION,
  type TravelsSerializedHistory,
} from 'travels';

type DocumentState = {
  title: string;
  blocks: Array<{ id: string; text: string }>;
};

const createDefaultDocument = (): DocumentState => ({
  title: 'Untitled',
  blocks: [],
});

const createEmptySnapshot = (): TravelsSerializedHistory<DocumentState> => ({
  version: TRAVELS_HISTORY_SCHEMA_VERSION,
  state: createDefaultDocument(),
  patches: { patches: [], inversePatches: [] },
  position: 0,
});

function restoreTravels(raw: unknown) {
  const history = Travels.deserialize<DocumentState>(
    raw ?? createEmptySnapshot(),
    {
      validation: 'semantic',
      fallback: createEmptySnapshot,
      onError(error) {
        if (error instanceof TravelsPersistenceError) {
          console.warn('Ignoring invalid persisted history:', error.code);
        }
      },
    }
  );

  return createTravels(history.state, {
    history,
    maxHistory: 100,
    strictInitialPatches: true,
  });
}
```

For durable persistence, state, retained patch values, and history metadata must use plain objects, dense arrays, strings, finite numbers other than `-0`, booleans, and `null`. Paths must be Travels-accepted JSON Pointer strings or dense arrays of strings/finite non-negative integers; other values are invalid segments. Encode `bigint`; normalize `NaN`, infinities, and `-0` because JSON rejects or changes them. Array holes and custom properties/prototypes are not preserved by snapshots or JSON/JSON Patch; fill holes with `null` and use plain arrays and objects. Map and Set are rejected as Travels state and retained patch payloads even when IndexedDB or another adapter can store them. A runtime-only value or path in old history remains part of the storage record.

The adapter examples below reuse the `DocumentState`, `restoreTravels(...)`, and `attachAutoSave(...)` definitions from this section.

## Auto-Save Pattern

Storage writes should usually be debounced. This keeps rapid editing from writing one snapshot per keystroke while still persisting the latest committed Travels state.

```ts
function attachAutoSave(
  travels: ReturnType<typeof restoreTravels>,
  saveSnapshot: (
    snapshot: TravelsSerializedHistory<DocumentState>
  ) => Promise<void>,
  debounceMs = 200
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingSave = Promise.resolve();

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const flush = async () => {
    clearTimer();

    const snapshot = travels.serialize();

    pendingSave = pendingSave
      .catch(() => undefined)
      .then(() => saveSnapshot(snapshot));

    await pendingSave;
  };

  const unsubscribe = travels.subscribe(() => {
    clearTimer();

    timer = setTimeout(() => {
      void flush().catch((error) => {
        console.error('Failed to persist Travels history:', error);
      });
    }, debounceMs);
  });

  return {
    flush,
    async dispose(options: { flush?: boolean } = { flush: true }) {
      clearTimer();
      unsubscribe();

      if (options.flush !== false) {
        await flush();
      }
    },
  };
}
```

Use `flush()` before route transitions or other app-controlled shutdown points. Use `dispose()` when the Travels instance is no longer active; it clears any pending debounce, removes the subscription, and flushes the latest snapshot by default.

If edits must survive a tab close, also call `travels.serialize()` from your page lifecycle handler and run a best-effort final save, or call the returned `flush()` method when the page is still active. Keep that path small: browser shutdown events are not reliable for long async work.

## Dexie.js

Dexie.js is a high-level IndexedDB wrapper with table APIs, schema versioning, indexes, transactions, and bulk operations. It is a good fit when an app stores many persisted timelines and needs to query them by document, timestamp, owner, or project.

Install:

```bash
npm install dexie
```

Adapter:

```ts
import Dexie, { type Table } from 'dexie';
import type { TravelsSerializedHistory } from 'travels';

type SnapshotRow = {
  key: string;
  value: TravelsSerializedHistory<DocumentState>;
  updatedAt: number;
};

type SnapshotAuditRow = {
  id?: number;
  key: string;
  action: 'save';
  updatedAt: number;
};

class TravelsDexieDB extends Dexie {
  snapshots!: Table<SnapshotRow, string>;
  snapshotAudit!: Table<SnapshotAuditRow, number>;

  constructor() {
    super('travels');

    this.version(1).stores({
      snapshots: 'key, updatedAt',
      snapshotAudit: '++id, key, updatedAt',
    });
  }
}

const db = new TravelsDexieDB();
const SNAPSHOT_KEY = 'document:main';

async function loadSnapshotFromDexie() {
  const row = await db.snapshots.get(SNAPSHOT_KEY);
  return row?.value ?? null;
}

async function saveSnapshotToDexie(
  snapshot: TravelsSerializedHistory<DocumentState>
) {
  await db.snapshots.put({
    key: SNAPSHOT_KEY,
    value: snapshot,
    updatedAt: Date.now(),
  });
}

async function initDexiePersistence() {
  const travels = restoreTravels(await loadSnapshotFromDexie());
  const persistence = attachAutoSave(travels, saveSnapshotToDexie);

  return { travels, persistence };
}
```

Use a transaction when one user action updates the snapshot and a related table:

```ts
async function saveDexieSnapshotWithRelatedRows(
  travels: ReturnType<typeof restoreTravels>
) {
  const updatedAt = Date.now();

  await db.transaction('rw', db.snapshots, db.snapshotAudit, async () => {
    await db.snapshots.put({
      key: SNAPSHOT_KEY,
      value: travels.serialize(),
      updatedAt,
    });

    await db.snapshotAudit.add({
      key: SNAPSHOT_KEY,
      action: 'save',
      updatedAt,
    });
  });
}
```

Use the `updatedAt` index when pruning old snapshot rows:

```ts
async function deleteDexieSnapshotsOlderThan(cutoff: number) {
  await db.snapshots.where('updatedAt').below(cutoff).delete();
}
```

Dexie-specific notes:

- Use `version(...).stores(...)` for schema evolution.
- Keep the serialized Travels snapshot in one row when you need atomic restore.
- Add secondary indexes such as `updatedAt` only for values you actually query.
- Prefer Dexie when persistence is part of a broader IndexedDB data model, not just a single key-value record.

## idb

`idb` is a small promise-based wrapper that mostly mirrors native IndexedDB. It is a good fit when you want IndexedDB's object stores, indexes, and transaction semantics without a larger abstraction.

Install:

```bash
npm install idb
```

Adapter:

```ts
import { openDB, type DBSchema } from 'idb';
import type { TravelsSerializedHistory } from 'travels';

interface TravelsPersistenceDB extends DBSchema {
  snapshots: {
    key: string;
    value: {
      key: string;
      value: TravelsSerializedHistory<DocumentState>;
      updatedAt: number;
    };
    indexes: {
      'by-updatedAt': number;
    };
  };
}

const SNAPSHOT_KEY = 'document:main';

const dbPromise = openDB<TravelsPersistenceDB>('travels', 1, {
  upgrade(db) {
    const store = db.createObjectStore('snapshots', {
      keyPath: 'key',
    });

    store.createIndex('by-updatedAt', 'updatedAt');
  },
});

async function loadSnapshotFromIdb() {
  const db = await dbPromise;
  const row = await db.get('snapshots', SNAPSHOT_KEY);

  return row?.value ?? null;
}

async function saveSnapshotToIdb(
  snapshot: TravelsSerializedHistory<DocumentState>
) {
  const db = await dbPromise;
  const tx = db.transaction('snapshots', 'readwrite');

  await tx.store.put({
    key: SNAPSHOT_KEY,
    value: snapshot,
    updatedAt: Date.now(),
  });

  await tx.done;
}

async function deleteIdbSnapshotsOlderThan(cutoff: number) {
  const db = await dbPromise;
  const tx = db.transaction('snapshots', 'readwrite');
  const index = tx.store.index('by-updatedAt');
  let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff, true));

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

async function initIdbPersistence() {
  const travels = restoreTravels(await loadSnapshotFromIdb());
  const persistence = attachAutoSave(travels, saveSnapshotToIdb);

  return { travels, persistence };
}
```

idb-specific notes:

- `openDB(name, version, { upgrade })` is where object stores and indexes are created or migrated.
- Use `db.get(...)`, `db.put(...)`, `db.delete(...)`, and `db.clear(...)` for single-store shortcuts.
- Use explicit transactions and `await tx.done` when a save includes multiple operations.
- Do not wait on unrelated async work, such as `fetch(...)`, in the middle of an active IndexedDB transaction. Transactions can auto-close while waiting.

## localForage

localForage exposes an async `localStorage`-like API with `getItem`, `setItem`, `removeItem`, `clear`, `keys`, and `iterate`. Its documented default driver order is IndexedDB, WebSQL, then localStorage, but WebSQL is obsolete in modern browsers. Treat WebSQL as legacy migration context and design new persistence around IndexedDB.

Install:

```bash
npm install localforage
```

Adapter:

```ts
import localforage from 'localforage';
import type { TravelsSerializedHistory } from 'travels';

const SNAPSHOT_KEY = 'document:main';

const store = localforage.createInstance({
  name: 'travels',
  storeName: 'snapshots',
});

async function loadSnapshotFromLocalForage() {
  await store.ready();

  return store.getItem<TravelsSerializedHistory<DocumentState>>(SNAPSHOT_KEY);
}

async function saveSnapshotToLocalForage(
  snapshot: TravelsSerializedHistory<DocumentState>
) {
  await store.setItem(SNAPSHOT_KEY, snapshot);
}

async function initLocalForagePersistence() {
  const travels = restoreTravels(await loadSnapshotFromLocalForage());
  const persistence = attachAutoSave(travels, saveSnapshotToLocalForage);

  return { travels, persistence };
}
```

localForage-specific notes:

- Call `config(...)` before any data API call, or prefer `createInstance(...)` for isolated stores.
- `setItem(...)` returns the saved value; `getItem(...)` returns `null` when a key does not exist.
- `undefined` is not a durable stored value; use `null` for intentional empty values.
- `clear()` removes everything in the current store. Use `removeItem(key)` for a single Travels snapshot.
- localForage is a simple key-value adapter. If you need atomic multi-key writes, use IndexedDB directly, Dexie.js, idb, or localspace with IndexedDB as the active driver.

## localspace

localspace keeps localForage-style storage methods while adding TypeScript-first APIs, batch operations, transaction helpers, plugins, and explicit modern drivers. It supports IndexedDB and localStorage in the browser; WebSQL is not supported. The in-memory driver is available only when explicitly added as a fallback and loses data on reload.

Install:

```bash
npm install localspace
```

Adapter:

```ts
import localspace from 'localspace';
import type { TravelsSerializedHistory } from 'travels';

const SNAPSHOT_KEY = 'document:main';

const store = localspace.createInstance({
  name: 'travels',
  storeName: 'snapshots',
  driver: [localspace.INDEXEDDB, localspace.LOCALSTORAGE],
});

async function loadSnapshotFromLocalspace() {
  await store.ready();

  return store.getItem<TravelsSerializedHistory<DocumentState>>(SNAPSHOT_KEY);
}

async function saveSnapshotToLocalspace(
  snapshot: TravelsSerializedHistory<DocumentState>
) {
  await store.setItem(SNAPSHOT_KEY, snapshot);
}

async function initLocalspacePersistence() {
  const travels = restoreTravels(await loadSnapshotFromLocalspace());
  const persistence = attachAutoSave(travels, saveSnapshotToLocalspace);

  return { travels, persistence };
}
```

Use `runTransaction(...)` or batch APIs when saving related records together. This is transactional with the IndexedDB driver; localStorage fallback runs the operations sequentially but cannot provide IndexedDB-style atomic commits:

```ts
async function saveLocalspaceSnapshotWithRelatedRows(
  travels: ReturnType<typeof restoreTravels>
) {
  await store.runTransaction('readwrite', async (tx) => {
    await tx.set(SNAPSHOT_KEY, travels.serialize());
    await tx.set(`${SNAPSHOT_KEY}:updatedAt`, Date.now());
  });
}
```

For multiple timelines:

```ts
async function saveMultipleLocalspaceSnapshots(
  entries: Array<{
    key: string;
    snapshot: TravelsSerializedHistory<DocumentState>;
  }>
) {
  await store.setItems(
    entries.map(({ key, snapshot }) => ({ key, value: snapshot }))
  );
}
```

localspace-specific notes:

- Prefer `[localspace.INDEXEDDB, localspace.LOCALSTORAGE]` for durable browser fallback.
- Add `localspace.MEMORY` only when runtime-only fallback is acceptable.
- Use `setItems(...)`, `getItems(...)`, and `removeItems(...)` for batch workloads. With localStorage fallback, batches are not atomic.
- Add `coalesceWrites` only for bursty multi-key writes. For a single debounced `SNAPSHOT_KEY`, it is usually unnecessary.
- Set `pluginErrorPolicy: 'strict'` when using encryption so persistence errors do not get swallowed.
- Call `destroy()` when disposing plugin-heavy instances.

## Choosing an Adapter

| Requirement                                            | Recommended adapter                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| One snapshot per app, minimal API                      | localForage or localspace                                                    |
| One snapshot per app, strict IndexedDB semantics       | idb                                                                          |
| Many documents, indexes, cleanup queries               | Dexie.js                                                                     |
| Batch writes and localForage-compatible migration path | localspace                                                                   |
| Existing localForage codebase                          | localForage first; localspace when adopting TypeScript-first APIs or batches |
| Avoid WebSQL and keep modern browser drivers explicit  | localspace, idb, or Dexie.js                                                 |

## Migration and Corruption Recovery

Use `migrate` when the stored shape predates Travels' current serialized history schema:

`migrate` and function-valued `fallback` are synchronous callbacks. Await
storage, network, or other asynchronous work before calling
`Travels.deserialize(...)`. Promise-like callback results fail with
`MIGRATION_FAILED` or `FALLBACK_FAILED`, and Travels observes their rejection
to prevent an unhandled Promise rejection.

```ts
type LegacyDocumentSnapshot = {
  version: 0;
  state: DocumentState;
  history: TravelsSerializedHistory<DocumentState>['patches'];
  cursor: number;
};

const history = Travels.deserialize<DocumentState>(stored, {
  validation: 'semantic',
  migrate(snapshot) {
    if (
      snapshot &&
      typeof snapshot === 'object' &&
      (snapshot as { version?: unknown }).version === 0
    ) {
      const legacy = snapshot as LegacyDocumentSnapshot;

      return {
        version: TRAVELS_HISTORY_SCHEMA_VERSION,
        state: legacy.state,
        patches: legacy.history,
        position: legacy.cursor,
      };
    }

    // Current-schema input still goes through Travels' validation below.
    return snapshot as TravelsSerializedHistory<DocumentState>;
  },
  fallback: createEmptySnapshot,
});
```

## Integrity and Provenance

`Travels.deserialize(...)` always verifies that a snapshot is structurally
valid. With `validation: 'semantic'`, it also verifies that the history can
replay consistently in both directions on a detached validation graph, without
letting replay mutate the supplied state or patch values. Neither mode proves
where the snapshot came from or that a reconstructed past is the history that
was originally recorded. Version 1 has no independent trusted history anchor,
so an internally reversible alternative history is accepted and does not
trigger `fallback`.
This boundary is covered by
[`test/persistence-semantics.test.ts`](../test/persistence-semantics.test.ts).

For object-form input, structural validation requires patch-history containers,
patch groups, array paths, and metadata lists to be plain dense arrays with no
custom own properties or prototypes. Frozen plain arrays are valid. Validation
and history cloning use indexed data-property access rather than input-defined
array methods, so malformed arrays are rejected through the stable persistence
error codes.

When integrity or provenance matters, verification MUST happen outside Travels
and before deserialization:

```text
stored bytes -> verify envelope -> decode snapshot -> Travels.deserialize -> createTravels
```

If external verification fails, discard the unverified snapshot and restore a
trusted default or last-known-good generation. Do not rely on `fallback` to
discover an internally consistent alternative history.

Structural validation is the default to preserve the synchronous API's
low-latency behavior. It rejects malformed schemas and patch encodings, but it
does not prove that navigation will apply successfully. Use explicit semantic
validation for unverified or potentially corrupted storage:

```ts
const history = Travels.deserialize(unverifiedSnapshot, {
  validation: 'semantic',
});
```

Semantic replay detects applicability and reversibility failures before the
restored history is used. Its work grows with the reachable history and the
containers copied by each patch. A snapshot that has already been authenticated
or otherwise verified by a trusted application boundary can use the default
structural path when restore latency matters.

Choose the integrity mechanism according to the application's trust model:

| Scenario                     | Host-application responsibility                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ephemeral UI undo/redo       | Travels replay validation and a known-safe fallback are normally sufficient.                                                                                                                         |
| Important offline drafts     | Checksum the exact encoded bytes, store a monotonic revision, and retain at least one previously verified generation. A checksum detects accidental corruption; it does not authenticate the writer. |
| Multi-device synchronization | Bind document and tenant/user identity to a server-controlled revision, and resolve stale or conflicting snapshots before deserialization.                                                           |
| Tamper-resistant storage     | Verify a server-held HMAC, digital signature, or authenticated-encryption tag. A key stored beside attacker-controlled browser data does not establish trust.                                        |
| Audit-grade history          | Keep a server-authoritative append-only event log and a trusted signed chain head or equivalent commitment. Treat Travels snapshots as reconstructable client caches.                                |

Hashing every patch, storing extra checkpoints, or embedding a hash chain in the
same mutable blob adds redundancy but cannot by itself prove historical intent;
an attacker that can rewrite the blob can rewrite those values too. The trusted
checksum, signature, revision, or chain commitment must be controlled outside
the snapshot it protects.

Recovery rules:

- Always provide `fallback` for browser startup paths. It recovers detected parsing, migration, and validation failures; external integrity failures must select a trusted snapshot before deserialization.
- Select `validation: 'semantic'` for unverified snapshots. Use the default structural mode only when schema validation is sufficient or a trusted application boundary has already verified the snapshot.
- Use `onError` to log the stable `TravelsPersistenceError.code`; entry-specific `INVALID_HISTORY` replay failures also identify the failing `entryIndex` and replay `direction`, while whole-graph isolation failures omit fields that cannot be attributed truthfully.
- When recording uses custom Mutative `strict` or `mark` settings, pass the same values through `replayOptions` so semantic validation uses identical replay rules.
- Normalize Map, Set, built-in subclasses, custom own properties, accessors, non-enumerable data, custom array prototypes, and non-zero `RegExp.lastIndex` values at the application boundary; semantic comparison rejects those shapes as unverifiable.
- Configure `enableAutoFreeze` on the restored Travels instance; deserialization deliberately avoids freezing caller-owned snapshot objects.
- Keep storage keys namespaced, for example `travels:<app>:<documentId>`.
- If persistence size matters, compress the serialized snapshot before storage and decompress before `Travels.deserialize(...)`.
- If application data contains `bigint`, Date, Map, or Set values, normalize them before creating or updating Travels state. A persistence codec may restore application-domain collections outside Travels, but the state passed to `createTravels(...)` must remain finite numbers, timestamps, records, dense arrays, and the other supported JSON-shaped values.

## External References

- Dexie.js documentation: https://dexie.org/docs/index
- Dexie.js API reference: https://dexie.org/docs/API-Reference
- idb README and API: https://github.com/jakearchibald/idb#readme
- localForage README: https://github.com/localForage/localForage#readme
- localForage API docs: https://github.com/localForage/localForage/blob/master/docs/api.md
- localspace README: https://github.com/unadlib/localspace#readme
- localspace API reference: https://github.com/unadlib/localspace/blob/main/docs/api-reference.md
- Chrome Web SQL deprecation timeline: https://developer.chrome.com/blog/web-sql-deprecation-timeline-updated
