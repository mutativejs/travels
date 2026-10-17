# Travels

![Node CI](https://github.com/mutativejs/travels/workflows/Node%20CI/badge.svg)
[![npm](https://img.shields.io/npm/v/travels.svg)](https://www.npmjs.com/package/travels)
![license](https://img.shields.io/npm/l/travels)

**Patch-based undo/redo optimized for large state, small updates, long history, and persistence.**

Travels gives your users the power to undo and redo their actions—essential for text editors, drawing apps, form builders, and any interactive application. Unlike traditional undo systems that copy entire state objects for each change, Travels stores only the differences (JSON Patches), making history much smaller to keep in memory and persist when updates touch a small part of a large state tree.

Works with React, Vue, Zustand, or vanilla JavaScript.

<details>
<summary><b>Table of Contents</b></summary>

- [Why Travels? Performance That Scales](#why-travels-performance-that-scales)
- [Choosing the Right Undo Strategy](#choosing-the-right-undo-strategy)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
  - [createTravels](#createtravelsinitialstate-options)
  - [restoreTravels](#restoretravelssnapshot-options)
  - [Instance Methods](#instance-methods)
  - [maxHistory option](#maxhistory-option)
- [Controlled Journal: Integrate an External State Owner](#controlled-journal-integrate-an-external-state-owner)
- [Mutable Mode: Keep Reactive State In Place](#mutable-mode-keep-reactive-state-in-place)
- [Archive Mode: Control When Changes Are Saved](#archive-mode-control-when-changes-are-saved)
- [State Requirements and Compatibility](#state-requirements-and-compatibility)
- [Framework Integration](#framework-integration)
- [Persistence: Saving History to Storage](#persistence-saving-history-to-storage)
- [TypeScript Support](#typescript-support)
- [Advanced: Extending Travels with Custom Logic](#advanced-extending-travels-with-custom-logic)
- [Maintenance](#maintenance)
- [Related Projects](#related-projects)
- [License](#license)

</details>

## Why Travels? Performance That Scales

Traditional undo systems clone your entire state object for each change. If your state is 1MB and the user makes 100 edits, that's 100MB of memory. Travels stores only the differences between states (JSON Patches following [RFC 6902](https://jsonpatch.com/)), so that same 1MB object with 100 small edits might use just a few kilobytes.

Travels is not designed to be the fastest possible choice for every hot path. Snapshot-based stacks can be faster for small state, short history, and local-only undo/redo because they avoid patch generation. Travels is designed for apps where history size, persistence cost, and replayable operation logs matter.

**Core advantages:**

- **Memory-efficient history storage** - Stores only differences (patches), not full snapshots. Changing one field in a large object stores only a few bytes.

- **Persistence-friendly history** - Patch histories are much smaller to serialize, store, send, and restore than full snapshot stacks when state is large and each update is small.

- **Fast immutable updates** - Built on [Mutative](https://github.com/unadlib/mutative). Write simple mutation code like `draft.count++` while maintaining immutability.

**Framework-agnostic** - Works with React, Vue, Zustand, MobX, Pinia, or vanilla JavaScript.

## Choosing the Right Undo Strategy

| Scenario                                                                 | Recommended approach                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------ |
| Small state, short history, local-only undo/redo                         | Snapshot stack, Redux-undo, or Zundo                   |
| Large state, small updates, long history, persistence, or operation logs | Travels                                                |
| Collaborative editing, conflict merging, or concurrent multi-user state  | CRDT/OT system; Travels alone does not solve conflicts |

<details>
<summary><b>Travels fit by priority (trade-off table)</b></summary>

| Priority                                                                   | Travels fit              | Trade-off                                                                                           |
| -------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| Minimize serialized history size                                           | Strong                   | Patch history is compact for small changes to large state                                           |
| Persist history to localStorage, IndexedDB, worker messages, or cloud sync | Strong                   | You still need a storage and migration strategy                                                     |
| Lowest setState/undo/redo latency for tiny state                           | Usually not the best fit | Patch generation and patch application add overhead                                                 |
| Large replace-everything updates                                           | Scenario-dependent       | Large patches can approach snapshot costs                                                           |
| Framework integration                                                      | Strong                   | Use immutable mode by default; use mutable mode for reactive stores that require identity stability |

</details>

For current benchmark numbers and caveats, see [`benchmarks/README.md`](benchmarks/README.md). The benchmark results intentionally separate hot-path latency from persistence costs because those trade-offs decide whether patch-based history is the right tool.

## Installation

```bash
npm install travels mutative
# or
pnpm add travels mutative
```

Travels 3 requires Node.js 22 or newer for server-side use.

#### Integrations

- Zustand: [zustand-travel](https://github.com/mutativejs/zustand-travel) - A powerful and high-performance time-travel middleware for Zustand
- React: [use-travel](https://github.com/mutativejs/use-travel) - A React hook for state time travel with undo, redo, reset and archive functionalities.

## Quick Start

```typescript
import { createTravels } from 'travels';

// Create a travels instance with initial state
const travels = createTravels({ count: 0 });

// Subscribe to state changes
const unsubscribe = travels.subscribe(
  ({ type, state, position, historyLength }) => {
    console.log('Event:', type);
    console.log('State:', state);
    console.log('Position:', position);
    console.log('Retained history:', historyLength);
  }
);

// Update state using mutation syntax (preferred - more intuitive)
travels.setState((draft) => {
  draft.count += 1; // Mutate the draft directly
});

// Or set state directly by providing a new value
travels.setState({ count: 2 });

// Undo the last change
travels.back();

// Redo the undone change
travels.forward();

// Get current state
console.log(travels.getState()); // { count: 1 }

// Cleanup when done
unsubscribe();
```

**Try it yourself:** [Travels Counter Demo](https://codesandbox.io/p/sandbox/travels-vanilla-ts-wzdd62)

---

**⚠️ Important: State Requirements**

Persistence requires JSON-compatible state, retained patch values, and history metadata: plain objects, dense arrays, strings, finite numbers other than `-0`, booleans, and `null`. Patch paths must be Travels-accepted JSON Pointer strings or dense arrays of strings/non-negative integers. Values such as `bigint`, `NaN`, infinities, and `-0` require normalization before JSON persistence. Map and Set are not supported in either runtime mode: construction and updates reject them, and restored state or patch payloads containing them fail validation. Normalize collections to plain objects or dense arrays before passing state to Travels. Complex types like Date, class instances, null-prototype objects, DOM nodes, refs, and functions are not supported as durable data. See [State Requirements](#state-requirements-and-compatibility) for details.

---

## Core Concepts

Before diving into the API, understanding these terms will help:

**State** - Your application data. In the example above, `{ count: 0 }` is the state.

**Draft** - A temporary mutable copy of your state that you can change freely. When you use `setState((draft) => { draft.count++ })`, the `draft` parameter is what you modify. Travels converts your mutations into immutable updates automatically.

**Patches** - The differences between states, stored as JSON Patch operations. Instead of saving entire state copies, Travels saves these small change records to minimize memory usage.

**Position** - Your current location in the history timeline. Position 0 is the initial state, position 1 is after the first change, etc. Moving back decreases position; moving forward increases it.

**Archive** - The act of saving the current state to history. By default, every `setState` call archives automatically. You can disable this and control archiving manually for more advanced use cases.

## API Reference

### `createTravels(initialState, options?)`

Creates a new Travels instance.

Use this factory instead of `new Travels(...)`. The exported `Travels` value
is a persistence namespace for `Travels.deserialize()` and is not a
constructor.

**Parameters:**

<details>
<summary><b>All options</b></summary>

| Parameter                | Type           | Description                                                                                                                                                                                                                              | Default                          |
| ------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `initialState`           | S              | Your application's starting state (see [state compatibility](#state-requirements-and-compatibility))                                                                                                                                     | (required)                       |
| `maxHistory`             | number         | Maximum number of history entries to keep. Older entries are dropped. Must be a non-negative integer (`NaN`, `Infinity`, decimals are rejected).                                                                                         | 10                               |
| `autoArchive`            | boolean        | Automatically save each change to history (see [Archive Mode](#archive-mode-control-when-changes-are-saved))                                                                                                                             | true                             |
| `mutable`                | boolean        | Whether to mutate the state in place (for observable state like MobX, Vue, Pinia)                                                                                                                                                        | false                            |
| `warnOnUnsupportedState` | boolean        | Development warnings for weak state, retained patch path/value, or metadata persistence semantics                                                                                                                                        | true in development              |
| `onError`                | function       | Receives typed `TravelsError` failures from core helper APIs                                                                                                                                                                             | undefined                        |
| `onBranchDiscard`        | function       | Called when a committed edit after undo discards redo entries; root transactions report only entries visible before they began                                                                                                           | undefined                        |
| `onWarning`              | function       | Receives structured non-fatal warnings with stable codes; otherwise warnings are written to the console only in development                                                                                                                | undefined                        |
| `onObserverError`        | function       | Receives errors thrown by listeners, devtools, and lifecycle hooks after the transition has committed                                                                                                                                    | undefined                        |
| `devtools`               | function       | Receives timeline events for external devtools integrations                                                                                                                                                                              | undefined                        |
| `patchesOptions`         | PatchesOptions | Customize JSON Patch format. Supports `{ pathAsArray: boolean }` to control path format. Patches are always enabled and cannot be set to `false`. See [Mutative patches docs](https://mutative.js.org/docs/api-reference/create#patches) | `{}`                             |
| `enableAutoFreeze`       | boolean        | Prevent accidental state mutations outside setState ([learn more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options))                                                                                        | false                            |
| `strict`                 | boolean        | Enable stricter immutability checks ([learn more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options))                                                                                                        | false                            |
| `mark`                   | Mark<O, F>[]   | Mark certain objects as immutable ([learn more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options))                                                                                                          | () => void                       |

</details>

**Returns:** `Travels<S, F, A, P>` - A Travels instance

### `restoreTravels(snapshot, options?)`

Restores a Travels instance from one complete `TravelsSerializedHistory`.
Decode untrusted storage with `Travels.deserialize()` first. Creation options
such as `maxHistory`, `autoArchive`, and observer hooks remain available, but a
separate `initialState` or `history` option is intentionally not accepted.

A snapshot returned by `Travels.deserialize()` is not validated a second time
while its top-level fields and patch-history arrays are unchanged; any other
input, including an edited or spread snapshot, is validated structurally.

The restored timeline owns a detached copy of `snapshot.state`, so decoded
snapshots and `fallback` constants are never mutated and can be restored
again. To restore into a live reactive store object (MobX, Vue, Pinia), pass it
as `target` together with `mutable: true`; Travels overwrites `target` in place
with the snapshot state and keeps that reference:

```ts
const store = reactive(defaultState);
const travels = restoreTravels(Travels.deserialize(stored), {
  mutable: true,
  target: store,
});
travels.getState() === store; // true
```

### Instance Methods

#### `getState(): S`

Get the current state. The returned value is the live state that history
patches apply to, the same object observers receive as `event.state`, so treat
it as read-only and change it only through Travels operations. Mutating it
directly in immutable mode silently desynchronizes undo/redo. It is typed as
`S` rather than `ReadonlyState<S>` so it can be passed to stores and APIs that
expect the state type, such as Zustand's `set()`. `enableAutoFreeze` freezes
every state Travels produces from then on (the initial object you pass in is
left as is); copy the state with `structuredClone()` before editing it.

#### `getRevision(): number`

Get an O(1), monotonically increasing token for external-store bindings. It
advances once for every committed subscriber event, including operations such
as manual `archive()` and `rebase()` that can change timeline controls without
changing the current state reference. No-op updates and failed transactions do
not advance it.

#### `setState(updater: S | (() => S) | ((draft: Draft<S>) => void), metadata?): void`

Update the state. Supports three styles:

- **Direct value:** `setState({ count: 1 })` - Replace state with a new object
- **Function returning value:** `setState(() => ({ count: 1 }))` - Compute new state
- **Draft mutation (recommended):** `setState((draft) => { draft.count = 1 })` - Mutate a draft copy

Updater callbacks must be synchronous. Async functions and Promise-like results are rejected so state changes cannot escape the history boundary.

> **Performance Optimization:** Updates that produce no actual changes (empty patches) won't create history entries or trigger subscribers. For example, `setState(state => state)` or conditional updates that don't modify any fields. This prevents memory bloat from no-op operations.

Pass optional metadata to label history entries for product UI:

```ts
travels.setState(
  (draft) => {
    draft.layer.name = 'Header';
  },
  { label: 'Rename Layer', source: 'layers-panel', timestamp: Date.now() }
);
```

Metadata is included in persisted snapshots. Keep custom metadata values in the same durable JSON-compatible subset as state, or use an application codec.

#### `subscribe(listener: (event: TravelsEvent<S, P>) => void): () => void`

Subscribe to state changes. Returns an unsubscribe function.

<details>
<summary><b>Event envelope and observer guarantees</b></summary>

Each notification creates one shallow-frozen event envelope shared by all
listeners and the devtools hook. `event.state` is the borrowed live state and
is exposed as `ReadonlyState<S>`; mutating it would bypass patch recording, so
write only through Travels operations. Top-level metadata is cloned and frozen
on first access. `event.patches` is the event-local
forward/inverse delta from the previously published state to `event.state`.
Root transactions compose their internal steps into one delta; operations that
do not change state, such as `archive()` and `rebase()`, publish empty patch
arrays. The patch snapshot is materialized lazily and its forward/inverse
directions are cloned independently. Its containers, patch groups, operations,
and array paths are frozen. Nested patch values and metadata are detached from
state and retained history but shared within the event, so treat them as
read-only too: mutating one can affect later observers handling that event. Use
`getPatches()` explicitly when a full retained history snapshot is required.

Notifications run only after state, position, and history have committed. An
observer exception is isolated from other observers and is reported through
`onObserverError` when configured. Synchronous calls to mutating Travels APIs
from an observer are rejected to prevent nested transitions from mixing event
versions; schedule a later task if a follow-up update is required.
Observer promises are not awaited, but rejected promises are isolated and
reported through `onObserverError` with the same source information.

Root transactions are also atomic at the observer boundary. State listeners
and devtools receive one final `transaction` event after a successful commit;
failed transactions publish neither provisional changes nor rollback
compensation events. `onBranchDiscard` likewise reports only redo entries that
were visible before the root transaction and are absent after commit, never
branches created and discarded entirely inside the transaction.

</details>

**Parameters:**

- `listener`: Callback receiving one `TravelsEvent`
  - `type`: The committed operation (`setState`, `recordPatches`, `archive`, `transaction`, `go`, `reset`, `rebase`, or `replaceStateWithoutHistory`)
  - `state`: The new state
  - `patches`: The lazily materialized event-local state transition patches
  - `position`: The current position in history
  - `historyLength`: The number of entries currently retained in history
  - `metadata`: Optional metadata associated with the operation

#### `back(amount?: number): void`

Undo one or more changes by moving back in history. Defaults to 1 step.

#### `forward(amount?: number): void`

Redo one or more changes by moving forward in history. Defaults to 1 step.

#### `go(position: number): void`

Jump to a specific position in the history timeline.

#### `reset(): void`

Restore the state, cursor, retained history, and metadata captured as this instance's initial baseline. For a fresh instance this is the original state with empty history; for preloaded history it is the validated starting timeline.

#### `rebase(): void`

Remove all past and future history and make the current state as the new initial state.

> [!WARNING]
> This is a **destructive operation**. All previous and future history entries are discarded, and the current state (including any unarchived temp patches) becomes the new baseline (position 0). Any subsequent `reset()` calls will return to this new baseline, not the original initial state.

#### `getHistory(): readonly ReadonlyState<S>[]`

Returns the complete history of states as an array. Use it to read the timeline: render it, map it, measure it, index into it.

> **IMPORTANT**: Treat the returned array and every state entry as read-only. They are cached internally.
> The array container is frozen in every build; the state entries are shared cached snapshots and are not deep-frozen.
> Casting away the read-only type and modifying an entry can corrupt the cache.

The same array is reachable through `getControls().getHistory()`. Both methods
return `readonly ReadonlyState<S>[]` in Travels 3.

#### `getHistorySnapshot(): S[]`

Returns a new array of fully detached history states, and is the method to reach for whenever the array outlives the read: keeping it in component state, sorting or otherwise reordering it, posting it to a worker, or handing it to code that expects to own its input. Nothing it returns is shared with the cache, so later edits to Travels cannot change it and edits to it cannot corrupt Travels.

The method fails with `PERSISTENCE_INCOMPATIBLE` when a history state contains functions, class instances, circular or shared references, or another runtime-only value that cannot be detached without changing semantics. A history that cannot be detached is also a history that cannot be persisted, so the failure is the same signal `serialize()` gives.

```ts
// Reading the timeline: getHistory() is enough.
const labels = travels.getHistory().map((state) => state.title);

// Keeping or reshaping it: take a snapshot first.
const [timeline, setTimeline] = useState(() => travels.getHistorySnapshot());
const newestFirst = travels.getHistorySnapshot().reverse();
```

#### `getPosition(): number`

Returns the current position in the history timeline.

#### `getPatches(): TravelPatches`

Returns the stored patches (the differences between states).

#### `getMetadata(): Array<TravelMetadata | undefined>`

Returns metadata aligned with `getPatches()` entries, including the pending manual archive entry when one exists.

#### `getHistoryEntries(): TravelHistoryEntry[]`

Returns patch entries with inverse patches and optional metadata, using the same entry set as `getPatches()`. Use this for undo menus, devtools timelines, and audit views.

#### `serialize(options?): TravelsSerializedHistory`

Returns a versioned persistence snapshot containing the current state, patch history, position, and metadata. The returned state, patches, and metadata are cloned. State, patch values, and metadata must meet the durable-data requirements below; paths must be Travels-accepted JSON Pointer strings or dense arrays of strings/non-negative integers. Callers can then pass the snapshot to `JSON.stringify`, storage adapters, or compression. `serialize()` does not itself encode or normalize runtime-only values. Pass `{ strict: true }` to reject any value that cannot round-trip through the documented JSON persistence contract.

#### `assertPersistenceCompatible(): void`

Checks current state, retained forward/inverse patches, patch paths, and metadata against the durable-data contract. It throws `TravelsTypeError` with code `PERSISTENCE_INCOMPATIBLE` and path-specific diagnostics instead of producing a snapshot that JSON would normalize or lose.

#### `Travels.deserialize(snapshot, options?): TravelsSerializedHistory`

Validates and normalizes a persisted snapshot before restoring it with `restoreTravels(snapshot)`. Accepts either a parsed object or a JSON string. Structural validation is the low-latency default; select `validation: 'semantic'` to replay every entry in both directions and reject patches that cannot be applied or reversed. Invalid input throws `TravelsPersistenceError` unless a `fallback` is supplied. `migrate` and function-valued `fallback` callbacks must return synchronously.

#### `isTravels(value): value is Travels`

Returns `true` for state-owning timelines created by `createTravels()`,
`restoreTravels()`, or `createPatchableTravels()` from this copy of Travels.
`Travels` is a persistence namespace rather than a class, so use `isTravels()`
instead of `instanceof Travels`. External journals are not state-owning
timelines and return `false`.

#### `canBack(): boolean`

Returns `true` if undo is possible (not at the beginning of history).

#### `canForward(): boolean`

Returns `true` if redo is possible (not at the end of history).

#### `archive(metadata?): void` (Manual archive mode only)

Saves the current state to history. Only available when `autoArchive: false`; automatic timelines omit both `archive` and `canArchive` at runtime and in TypeScript. Accepts optional metadata. If omitted, Travels uses the latest metadata supplied to pending `setState(...)` calls.

#### `canArchive(): boolean` (Manual archive mode only)

Returns `true` if there are unsaved changes that can be archived.

#### `mutable: boolean`

Returns whether mutable mode is enabled.

#### `transaction(metadata?, fn): void`

Runs multiple `setState` calls and archives them as one undo step.

```ts
travels.transaction({ label: 'Move Selection' }, () => {
  travels.setState((draft) => {
    draft.selection.x += 10;
  });
  travels.setState((draft) => {
    draft.selection.y += 20;
  });
});
```

`batch(...)` is an alias for `transaction(...)`.

Transaction callbacks must also be synchronous. A rejected asynchronous callback rolls the transaction back and reports a `TravelsError` through `onError` when configured.

<details>
<summary><b>Transaction semantics: nesting, errors, and mutable mode</b></summary>

Nested changes remain private until the root transaction commits, so listeners
and devtools never observe states that are later rolled back. Branch-discard
hooks also omit redo entries created only by provisional transaction steps.
Nested transaction errors are likewise deferred until the root transaction
commits or rolls back, so `onError` always observes the settled root state. A
single failure that bubbles through multiple nested scopes is reported once.

In mutable mode, rollback replays inverse patches only for changes made through
Travels APIs. Direct writes to the live state during the callback are outside
the transaction journal and survive rollback. Route every change that must be
atomic through `travels.setState(...)`; framework observers bound directly to
the live object may still observe in-place mutations before the root
transaction settles even though Travels listeners and devtools do not.

</details>

#### `pauseTracking(): void` / `resumeTracking(): void`

Temporarily apply state updates without creating history entries. Paused updates become the new baseline so later undo/redo cannot replay patches against mismatched state.

#### `replaceStateWithoutHistory(updater): void`

Replace or mutate state without creating a history entry, then clear history and use the result as the new baseline. This is useful for loading server state, applying remote snapshots, or resetting external store data.

#### `getControls(): RebasableTravelsControls | RebasableManualTravelsControls`

Returns a cached, frozen controls object containing navigation methods and
current timeline views, including `rebase()`. Its properties and methods are
read-only, making it suitable for UI components that should not receive the
entire Travels instance.

`controls.patches` is a shared, frozen `ReadonlyTravelPatches` view that keeps
its reference until history changes, so it is cheap to read while rendering
and works as a memo dependency. Call `travels.getPatches()` for a detached copy
you can keep or change.

```typescript
const travels = createTravels({ count: 0 });
const controls = travels.getControls();

// Use controls
controls.back();
controls.forward();
console.log(controls.position);
console.log(controls.patches);
```

#### `maxHistory` option

The `maxHistory` option limits how many history entries (patches) are kept in memory. Older entries beyond this limit are automatically discarded to save memory.

**How it works:**

- `maxHistory` defines the maximum number of **patches** (changes), not states
- When the limit is exceeded, the oldest patches are removed
- The current `position` is capped at `maxHistory`, even if you make more changes
- `reset()` can always return to the true initial state, regardless of history trimming
- Invalid values throw immediately: `maxHistory` must be a non-negative integer

<details>
<summary><b>Example: Understanding the history window</b></summary>

If you set `maxHistory: 3` and make 5 increments, here's what happens:

```ts
const travels = createTravels({ count: 0 }, { maxHistory: 3 });

const controls = travels.getControls();
const increment = () =>
  travels.setState((draft) => {
    draft.count += 1;
  });

// Make 5 changes
increment(); // 1
increment(); // 2
increment(); // 3
increment(); // 4
increment(); // 5

expect(travels.getState().count).toBe(5);

// Position is capped at maxHistory (3), so we're at position 3
// The library keeps only the last 3 patches, representing states: [2, 3, 4, 5]
// Why 4 states? Because patches represent *transitions*:
//   - patch 0: 2→3
//   - patch 1: 3→4
//   - patch 2: 4→5
// So you can access 4 states total: the window start (2) plus 3 transitions

// Go back 1 step: from 5 to 4
controls.back();
expect(travels.getPosition()).toBe(2);
expect(travels.getState().count).toBe(4);

// Go back 1 step: from 4 to 3
controls.back();
expect(travels.getPosition()).toBe(1);
expect(travels.getState().count).toBe(3);

// Go back 1 step: from 3 to 2 (the window start)
controls.back();
expect(travels.getPosition()).toBe(0);
expect(travels.getState().count).toBe(2); // Can only go back to the window start

expect(controls.canBack()).toBe(false); // Can't go further back

// However, reset() can still return to the true initial state
controls.reset();
expect(travels.getState().count).toBe(0); // Back to the original initial state
```

</details>

## Controlled Journal: Integrate an External State Owner

Use `createTravelJournal()` when a store, state machine, worker, or other
runtime already owns state and produces a forward/inverse patch pair for each
commit. The adapter records that pair once instead of asking Travels to run the
update recipe again. Navigation and reset are delegated through the owner's
normal commit path:

```ts
import { apply as applyPatches, create, type Draft } from 'mutative';
import { createTravelJournal } from 'travels';

type State = { count: number };
let state: State = { count: 0 };

const journal = createTravelJournal(state, {
  maxHistory: 100,
  apply({ patches }) {
    state = applyPatches(state, patches);
    publishToStoreSubscribers(state);
    return state;
  },
});

function commit(recipe: (draft: Draft<State>) => void) {
  const [nextState, patches, inversePatches] = create(state, recipe, {
    enablePatches: true,
  });

  state = nextState; // Commit through the external owner first.
  journal.recordPatches(state, { patches, inversePatches });
}

commit((draft) => {
  draft.count += 1;
});
journal.back();
```

Restore a persisted controlled timeline with
`restoreTravelJournal(snapshot, { apply })`; like `restoreTravels()`, it accepts
the complete snapshot as one atomic input rather than a separate state/history
pair.

<details>
<summary><b>Contract: what the external owner must guarantee</b></summary>

- `recordPatches(state, entry)` must receive the committed post-update state
  and the exact forward/inverse patch pair for that transition. Travels
  validates and detaches retained patch inputs, but intentionally does not
  replay the pair to prove its relationship to `state`.
- `apply` must synchronously commit `transition.patches` through the external
  owner and return its committed state. If it throws or returns a Promise,
  Travels does not advance its cursor or replace its retained state reference;
  it cannot roll back side effects the external owner already performed. Do not
  record delegated navigation or reset as a new history entry.
- The public `TravelJournal` type omits state-owning operations such as
  `setState()`, transactions, tracking controls, and `getControls()`. Those
  properties are absent from the runtime facade as well. `reset()` applies the
  journal baseline through the owner. With `autoArchive: false`, `archive()`
  and `canArchive()` group pending external commits just like a manual
  state-owning timeline. Use `rebase()` to clear the timeline while preserving
  the current externally owned state.
- A successful `recordPatches()` notification has event type `recordPatches`.
  `TravelsEvent['type']` is intentionally open for future minor-release event
  names, so consumers should keep a `default` branch. Standard
  `createTravels()` use never emits `recordPatches`.

</details>

See the [Controlled Journal Guide](docs/controlled-journal.md) for the complete
commit, navigation, failure, and trust-boundary contract.

## Mutable Mode: Keep Reactive State In Place

`mutable: true` lets Travels mutate the same object reference you hand in. This is crucial for observable stores (MobX, Vue/Pinia, custom proxies) that depend on identity stability to trigger reactions. Under the hood, Travels still generates JSON Patches but applies them back to the live object via Mutative's `apply(..., { mutable: true })`, so undo/redo continues to work without allocating new objects.

### When to Enable It

- You pass a reactive store into `createTravels` and swapping the reference would break your observers.
- You expect subscribers (`travels.subscribe`) to always receive the exact same object instance.
- You batch multiple mutations with `autoArchive: false` but still need the UI to reflect every intermediate change.

Stick with the default immutable mode for reducer-driven stores (Redux, Zustand) where replacing the root object is the norm.

<details>
<summary><b>Behavior at a Glance</b></summary>

- `setState` keeps the reference stable as long as the current state root is an object. Primitive roots (number, string, `null`) trigger an automatic immutable fallback plus a dev warning.
- Function updaters that return a brand-new root (root replacement) also fall back to immutable assignment in mutable mode, with a dev warning.
- No-op updates (producing empty patches) are optimized away and won't create history entries or notify subscribers.
- `back`, `forward`, and `go` also mutate in place unless the history entry performs a root-level replacement (patch path `[]`). Those rare steps reassign the reference to keep history correct.
- Root array time-travel in mutable mode can have ordering limitations; if you rely on array root navigation, prefer immutable mode or wrap the array in an object.
- `reset` replays a diff from the original initial state, so the observable reference survives a reset.
- `archive` (manual mode) merges temporary patches and still mutates the live object before saving history.
- `getHistory()` reconstructs and caches snapshots from the stored patches. Treat the returned array and every entry as read-only; they are not reactive proxies.
- `subscribe` listeners receive a read-only typed view of the live mutable object as `event.state`, so `event.state === travels.getState()` stays true. Mutate it only through Travels operations.

</details>

### Example: Pinia/Vue Store

```ts
import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { createTravels } from 'travels';

export const useTodosStore = defineStore('todos', () => {
  const state = reactive({ items: [] });
  const travels = createTravels(state, { mutable: true });
  const controls = travels.getControls();

  function addTodo(text: string) {
    travels.setState((draft) => {
      draft.items.push({ id: crypto.randomUUID(), text, done: false });
    });
  }

  return { state, addTodo, controls };
});
```

Vue components keep using the original `state` reference while Travels tracks history and provides `controls` for undo/redo.

<details>
<summary><b>Limitations & Tips</b></summary>

**Compatibility Requirements:**

Mutable mode has the same supported-state contract as immutable mode. Map and Set are rejected in either mode; keep reactive collections outside Travels state or normalize them to plain objects and dense arrays. See [State Requirements and Compatibility](#state-requirements-and-compatibility) for the full matrix.

**Other Tips:**

- If you often replace the entire root object (e.g., `setState(() => newState)`) the library has to fall back to immutable jumps when navigating history. Prefer mutating the provided draft to keep reference sharing.
- You can inspect `travels.mutable` at runtime to verify which mode is active.
- See [`docs/mutable-mode.md`](docs/mutable-mode.md) for a deep dive, integration checklists, and troubleshooting tips.

</details>

## Archive Mode: Control When Changes Are Saved

Travels provides two ways to control when state changes are recorded in history:

### Auto Archive Mode (default: `autoArchive: true`)

In auto archive mode, every `setState` call is automatically recorded as a separate history entry. This is the simplest mode and suitable for most use cases.

```typescript
const travels = createTravels({ count: 0 });
// or explicitly: createTravels({ count: 0 }, { autoArchive: true })

// Each setState creates a new history entry
travels.setState({ count: 1 }); // History: [0, 1], position: 1
travels.setState({ count: 2 }); // History: [0, 1, 2], position: 2
travels.setState({ count: 3 }); // History: [0, 1, 2, 3], position: 3

// No-op update - position stays the same (optimization)
travels.setState((state) => state); // History: [0, 1, 2, 3], position: 3

// Conditional update that changes nothing
travels.setState((draft) => {
  if (draft.count > 10) {
    // false, so no changes
    draft.count = 0;
  }
}); // History: [0, 1, 2, 3], position: 3

travels.back(); // Go back to count: 2
```

### Manual Archive Mode (`autoArchive: false`)

In manual archive mode, you control when state changes are recorded to history using the `archive()` function. This is useful when you want to group multiple state changes into a single undo/redo step.

**Use Case 1: Batch multiple changes into one history entry**

```typescript
const travels = createTravels({ count: 0 }, { autoArchive: false });

// Multiple setState calls
travels.setState({ count: 1 }); // Temporary change (not in history yet)
travels.setState({ count: 2 }); // Temporary change (not in history yet)
travels.setState({ count: 3 }); // Temporary change (not in history yet)

// Commit all changes as a single history entry
travels.archive(); // History: [0, 3]

// Now undo will go back to 0, not 2 or 1
travels.back(); // Back to 0
```

**Use Case 2: Explicit commit after a single change**

```typescript
function handleSave() {
  travels.setState((draft) => {
    draft.count += 1;
  });
  travels.archive(); // Commit immediately
}
```

**Key Differences:**

- **Auto archive**: Each `setState` = one undo step
- **Manual archive**: `archive()` call = one undo step (can include multiple `setState` calls)

Navigating with `back()`, `forward()`, or `go()` while changes are pending
archives them implicitly as part of the navigation. The navigation publishes a
single `go` event in both immutable and mutable mode, not a separate `archive`
event, so persist on every committed event rather than only on `archive`.

## State Requirements and Compatibility

Travels supports durable state: plain objects, dense arrays, strings, finite numbers other than `-0`, booleans, and `null`. This contract applies to immutable and mutable runtime modes as well as persisted history. Patch paths must be Travels-accepted JSON Pointer strings or dense arrays of strings/finite non-negative integers; booleans, `null`, fractional or negative numbers, objects, and symbols are invalid segments. Durable object and array properties are normal writable, enumerable data properties on extensible containers. Accessors, hidden or read-only properties, frozen or sealed containers, array holes, custom properties, and custom or null prototypes are outside the durable contract; normalize them before storing them in Travels. Null-prototype dictionaries are not drafted by Mutative by default, so nested state writes may not produce undoable patches; convert them to plain objects first.

When `enableAutoFreeze` is enabled, runtime compatibility warnings treat its standard frozen containers as intentional; accessors and other nonstandard shapes are still diagnosed.

The runtime columns below describe state-owning timelines. A controlled journal always validates retained patch values, but its complete state belongs to the external owner: development builds scan that returned state early, while `serialize()`, `rebase()`, and `getHistorySnapshot()` enforce compatibility in every build. See the [controlled journal contract](docs/controlled-journal.md#navigation-and-reset-contract).

<details>
<summary><b>Full compatibility matrix</b></summary>

| Value                                     | Immutable runtime                  | Mutable runtime                               | JSON persistence                  | Recommendation                                  |
| ----------------------------------------- | ---------------------------------- | --------------------------------------------- | --------------------------------- | ----------------------------------------------- |
| Plain object                              | Supported                          | Supported                                     | Supported                         | Preferred                                       |
| Dense array                               | Supported                          | Supported                                     | Supported                         | Preferred                                       |
| Sparse, extended, or subclassed array     | Limited runtime support            | Array roots have additional shape limitations | Not preserved by JSON/JSON Patch  | Use a plain dense array                         |
| string, boolean, `null`                   | Supported                          | Falls back to immutable for primitive roots   | Supported                         | Preferred                                       |
| Finite number other than `-0`             | Supported                          | Falls back to immutable for primitive roots   | Supported                         | Preferred                                       |
| `NaN`, infinity, `-0`                     | Supported in memory                | Falls back to immutable for primitive roots   | Converted to `null` or `0`        | Normalize to a finite number                    |
| `bigint`                                  | Supported in memory                | Falls back to immutable for primitive roots   | `JSON.stringify` throws           | Encode as a string                              |
| `undefined`                               | Patchable in memory                | Patchable in memory                           | Removed from JSON objects         | Use `null`                                      |
| `Date`                                    | Cloneable, but not durable         | Cloneable, but not durable                    | Restored as a string through JSON | Store timestamp or ISO string                   |
| `Map` / `Set`                             | Rejected                           | Rejected                                      | Rejected at snapshot boundaries   | Store entries/values as records or dense arrays |
| Class instance / custom or null prototype | Not durable                        | Not durable                                   | Loses prototype/methods           | Store plain data or IDs                         |
| Function                                  | Not supported                      | Not supported                                 | Dropped by JSON                   | Keep behavior outside state                     |
| Circular reference                        | Not supported for JSON persistence | Not supported for JSON persistence            | `JSON.stringify` fails            | Normalize graph to IDs                          |
| DOM node, ref, observable instance body   | Not supported as durable state     | Not supported as durable state                | Not serializable                  | Store outside Travels state                     |
| WeakMap / WeakSet                         | Not supported                      | Not supported                                 | Not serializable                  | Store outside Travels state                     |

</details>

TypeScript helpers are exported for users who want to enforce the durable subset in their own app code:

```ts
import {
  createPatchableTravels,
  createTravels,
  type JsonValue,
  type PatchableState,
} from 'travels';

const initialDocumentState = {
  title: 'Draft',
  blocks: [] as Array<{ id: string; text: string }>,
} satisfies JsonValue;

const travels = createTravels(initialDocumentState);

function createHistoryFor<S extends PatchableState>(state: S) {
  return createPatchableTravels(state);
}
```

`PatchableState` is the supported JSON-shaped state contract and intentionally excludes Map and Set. `PatchableInput<T>` performs a finite-depth, best-effort static check so recursive interfaces remain usable; broad types such as `{}` cannot prove their contents from TypeScript alone. `createPatchableTravels()` therefore also validates the concrete initial value at runtime and throws `PERSISTENCE_INCOMPATIBLE` for Date, functions, custom instances, non-JSON numbers, collections, and other non-durable values. State-owning timelines also fail fast when Map or Set is found in initial state, a newly generated patch payload, or restored history.

<details>
<summary><b>Diagnostics, metadata, and build-condition notes</b></summary>

These value requirements cover retained patch payloads and custom metadata included by `serialize()`; paths independently obey the structural contract above. An old runtime-only value or path therefore remains relevant after it leaves current state. TypeScript's `number` type cannot exclude `NaN`, infinities, or `-0`; the runtime compatibility scanner diagnoses them.

In development, Travels scans initial and changed state plus retained forward/inverse patch operations and history metadata for known compatibility hazards. Warnings identify whether the incompatible path belongs to state, a patch operation, or metadata, and repeat only once per diagnostic path. `serialize()` performs the same diagnostic check against the current snapshot. Map/Set rejection is a production invariant for state-owning timelines and retained controlled-journal patch values, and is not disabled by `warnOnUnsupportedState: false`; that option controls diagnostics for the remaining compatibility hazards only. Because a controlled journal does not own its complete state, its full returned-state scan is the development diagnostic described above rather than a production navigation cost.

The published package ships the diagnostics through the `development` export condition: tools that resolve it (the Vite dev server, webpack with `mode: 'development'`, and other bundlers with development conditions enabled) load `dist/index.dev.*` bundles containing the full scanner, while the default and `require` entries stay diagnostic-free for production. Script-tag consumers of the UMD bundle always receive the production build.

</details>

## Framework Integration

Runnable and copyable integration examples live in the
[examples directory](https://github.com/mutativejs/travels/tree/main/examples):

- [`examples/zustand.ts`](examples/zustand.ts)
- [`examples/vue.ts`](examples/vue.ts)
- [`examples/pinia.ts`](examples/pinia.ts)
- [`examples/mobx.ts`](examples/mobx.ts)
- [`examples/form-builder.ts`](examples/form-builder.ts)
- [`examples/canvas-editor.ts`](examples/canvas-editor.ts)
- [`examples/local-first-persistence.ts`](examples/local-first-persistence.ts)

<details>
<summary><b>React Integration</b></summary>

```tsx
import { useSyncExternalStore } from 'react';
import { createTravels } from 'travels';

const travels = createTravels({ count: 0 });

function useTravel() {
  const state = useSyncExternalStore(
    travels.subscribe.bind(travels),
    travels.getState.bind(travels)
  );

  return [state, travels.setState.bind(travels), travels.getControls()] as const;
}

function Counter() {
  const [state, setState, controls] = useTravel();

  return (
    <div>
      <div>Count: {state.count}</div>
      <button onClick={() => setState((draft) => { draft.count += 1; })}>
        Increment
      </button>
      <button onClick={() => controls.back()} disabled={!controls.canBack()}>
        Undo
      </button>
      <button onClick={() => controls.forward()} disabled={!controls.canForward()}>
        Redo
      </button>
    </div>
  );
}
```

</details>

<details>
<summary><b>External Form Manager Integration</b></summary>

When a form manager or external store remains the single source of truth, Travels can stay as a pure history engine. In that setup, update Travels from the form layer with detached value snapshots, then apply undo/redo results back to the form by reading `travels.getState()` immediately after navigation. With `autoArchive: false`, you can decide when a set of form edits should become one undoable history step.

```tsx
import { createTravels } from 'travels';

type FormValues = {
  title: string;
  description: string;
};

type FormApi<S> = {
  getValues: () => S;
  setValues: (values: S) => void;
};

const travels = createTravels<FormValues>(
  {
    title: '',
    description: '',
  },
  { autoArchive: false }
);

function bindHistoryToForm(form: FormApi<FormValues>) {
  const syncToHistory = () => {
    travels.setState(structuredClone(form.getValues()));
  };

  const commitHistoryStep = () => {
    if (travels.canArchive()) {
      travels.archive();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const modifier = event.metaKey || event.ctrlKey;

    if (modifier && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      if (!travels.canBack()) return;
      travels.back();
      form.setValues(travels.getState());
      return;
    }

    if (
      (modifier && event.key === 'z' && event.shiftKey) ||
      (modifier && event.key === 'y')
    ) {
      event.preventDefault();
      if (!travels.canForward()) return;
      travels.forward();
      form.setValues(travels.getState());
    }
  };

  return {
    syncToHistory,
    commitHistoryStep,
    handleKeyDown,
  };
}
```

Call `syncToHistory()` whenever the form values change, and call `commitHistoryStep()` whenever your form layer considers those changes a single undoable step, for example on blur, submit, or a debounced commit.

`getValues()` should return a detached snapshot, not a live mutable reference owned by the form manager. If your form library returns live objects, clone them before passing them to Travels.

For `react-hook-form`, `getValues()` maps naturally to `form.getValues()`, and `setValues(...)` is typically implemented with `form.reset(...)`.

This pattern is useful for integrations such as `react-hook-form`, custom form managers, or external stores where you want to avoid two reactive sources of truth. React can still render the form state, but Travels only records and replays history.

</details>

<details>
<summary><b>Zustand Integration</b></summary>

```typescript
import { create } from 'zustand';
import { createTravels } from 'travels';

const travels = createTravels({ count: 0 });

const useStore = create((set) => ({
  ...travels.getState(),
  setState: (updater) => {
    travels.setState(updater);
    set(travels.getState());
  },
  controls: travels.getControls(),
}));

// Subscribe to travels changes
travels.subscribe(({ state }) => {
  useStore.setState(state);
});
```

</details>

<details>
<summary><b>Vue Integration</b></summary>

```typescript
import { ref, readonly } from 'vue';
import { createTravels } from 'travels';

export function useTravel(initialState, options) {
  const travels = createTravels(initialState, options);
  const state = ref(travels.getState());

  travels.subscribe(({ state: newState }) => {
    state.value = newState;
  });

  const setState = (updater) => {
    travels.setState(updater);
  };

  return {
    state: readonly(state),
    setState,
    controls: travels.getControls(),
  };
}
```

</details>

## Persistence: Saving History to Storage

To persist state across browser sessions or page reloads, use the versioned snapshot API. A snapshot contains the current state, patch history, position, and schema version.

```typescript
import {
  createTravels,
  restoreTravels,
  Travels,
  TravelsPersistenceError,
} from 'travels';

function saveToStorage(travels) {
  localStorage.setItem('travels:document', JSON.stringify(travels.serialize()));
}

function loadFromStorage() {
  const stored = localStorage.getItem('travels:document');
  if (!stored) return createTravels(defaultState);

  const history = Travels.deserialize(stored, {
    validation: 'semantic',
    fallback: {
      version: 1,
      state: defaultState,
      patches: { patches: [], inversePatches: [] },
      position: 0,
    },
    onError(error) {
      if (error instanceof TravelsPersistenceError) {
        console.warn('Ignoring invalid persisted history:', error.code);
      }
    },
  });

  return restoreTravels(history, { maxHistory: 50 });
}
```

Every `Travels.deserialize(...)` call validates:

- schema version
- snapshot shape
- patch array shape
- JSON Patch operation names and paths
- position bounds

<details>
<summary><b>Validation semantics, error codes, and integrity notes</b></summary>

Object-form snapshots follow the same shape produced by JSON. Top-level
`version`, `state`, `patches`, `position`, and optional `metadata` fields, plus
the patch container's `patches` and `inversePatches` fields, must be own data
properties. Accessors and inherited fields are not evaluated or accepted; each
accepted field is captured once for validation and return. Patch-history
containers, patch groups, array paths, and metadata lists must be plain dense
arrays with `Array.prototype`, indexed data properties, and no custom own
properties. Frozen plain arrays are accepted. Invalid arrays produce
`INVALID_PATCHES` (or `INVALID_SCHEMA` for metadata) without invoking methods
defined on the input.

This structural validation is the default so the synchronous restore API keeps
its historical low-latency behavior. Select semantic validation for snapshots
that have not already crossed a trusted verification boundary:

```typescript
const history = Travels.deserialize(stored, {
  validation: 'semantic',
});
```

Semantic mode additionally replays from the stored position to both ends of
history and verifies forward/inverse reversibility for every reachable entry.
Its cost grows with both state shape and reachable history length. Structural
mode deliberately does not apply patches, so do not use the default alone as a
corruption detector for unverified storage.

`Travels.deserialize(...)` throws `TravelsPersistenceError` with a stable
`code` such as `PARSE_ERROR`, `UNSUPPORTED_VERSION`, `INVALID_SCHEMA`,
`INVALID_PATCHES`, `INVALID_HISTORY`, `MIGRATION_FAILED`, or
`FALLBACK_FAILED`. Entry-specific semantic replay failures also expose
`entryIndex` and `direction` (`forward` or `inverse`). Whole-graph isolation
failures omit those fields because no single patch entry or replay direction is
responsible. Provide `fallback` when detected parsing, migration, or validation
failures should recover to a known-safe snapshot instead of failing startup.
Fallback snapshots pass through the selected validation mode; a throwing or
invalid fallback reports `FALLBACK_FAILED`.

`migrate` and function-valued `fallback` callbacks are synchronous extension
points. Complete storage reads, network requests, or other asynchronous work
before calling `Travels.deserialize(...)`. A Promise-like result is rejected as
`MIGRATION_FAILED` or `FALLBACK_FAILED`, and its rejection is consumed so it
cannot escape as an unhandled Promise rejection.

If history was recorded with custom Mutative replay behavior, provide the same
settings during validation:

```typescript
const history = Travels.deserialize(stored, {
  validation: 'semantic',
  replayOptions: {
    strict: true,
    mark: customMark,
  },
});
```

Semantic validation uses only the documented `strict` and `mark` replay options.
It never enables mutable replay or auto-freeze because those output policies do
not change patch interpretation. State, patch values, and metadata are first
isolated into a validation-only object graph, and values that cannot be isolated
safely are rejected before replay. `Travels.deserialize(...)` therefore does not
mutate or freeze caller-owned snapshot objects; configure those policies on the
restored Travels instance instead. Semantic validation requires native
`structuredClone`, which is available in the supported runtimes.

Replay comparison is deliberately conservative for non-JSON values. Exact
`Date` and `RegExp` instances are compared by their intrinsic state. Map, Set,
built-in subclasses, custom own properties, accessors, non-enumerable data,
custom array prototypes, and non-zero `RegExp.lastIndex` values are rejected as
unverifiable. Property descriptor flags, array length descriptors, and object
extensibility must also survive replay unchanged. Plain-object own-key order is
not treated as observable: patch replay re-appends a removed and re-added key,
so histories that reorder object keys are accepted as long as the key set and
values round-trip. Normalize unsupported values into the supported state
contract before semantic validation.

Semantic validation proves replay consistency only: the stored anchor and patch
pairs can be applied and reversed. It does not authenticate the snapshot's
origin or prove that the reconstructed past is the history originally recorded.
A different but internally reversible history cannot be distinguished without
an external trusted anchor.

`fallback` runs only after parsing, migration, or validation rejects the input.
An internally consistent alternative history is accepted and therefore does
not automatically trigger fallback. Verify checksums, signatures, document
identity, or revisions before calling `Travels.deserialize(...)` when the
source requires integrity or provenance guarantees; select a known-safe
snapshot when that external verification fails.

</details>

<details>
<summary><b>Migrating older snapshots (migrate)</b></summary>

```typescript
import type { TravelsSerializedHistory } from 'travels';

const history = Travels.deserialize<typeof defaultState>(stored, {
  validation: 'semantic',
  migrate(snapshot) {
    if (
      snapshot &&
      typeof snapshot === 'object' &&
      (snapshot as { version?: unknown }).version === 0
    ) {
      const legacy = snapshot as {
        state: typeof defaultState;
        history: TravelsSerializedHistory<typeof defaultState>['patches'];
        cursor: number;
      };

      return {
        version: 1,
        state: legacy.state,
        patches: legacy.history,
        position: legacy.cursor,
      };
    }

    // Pass current-schema input through to Travels' built-in validation.
    return snapshot as TravelsSerializedHistory<typeof defaultState>;
  },
});
```

</details>

For larger histories, store `JSON.stringify(travels.serialize())` in IndexedDB instead of localStorage. If storage size matters, compress the serialized string with a library such as `lz-string` before writing it, then decompress before calling `Travels.deserialize(...)`.

For Dexie.js, idb, localForage, and localspace adapters, see the [Persistence Integrations Guide](docs/persistence-integrations.md).

## TypeScript Support

`travels` is written in TypeScript and provides full type definitions.

```typescript
import {
  createTravels,
  type TravelsOptions,
  type TravelPatches,
} from 'travels';

interface State {
  count: number;
  todos: Array<{ id: number; text: string }>;
}

const travels = createTravels<State>({ count: 0, todos: [] });

// Type-safe state updates
travels.setState((draft) => {
  draft.count += 1;
  draft.todos.push({ id: 1, text: 'Buy milk' });
});
```

## Advanced: Extending Travels with Custom Logic

You can enhance Travels by wrapping its methods to add validation, permissions, logging, rate limiting, and other custom behaviors.

**Common use cases:**

- ✅ **Validation** - Prevent invalid state changes before they're applied
- ✅ **Permissions** - Control who can undo/redo or modify state
- ✅ **Logging & Auditing** - Track all state changes for debugging or compliance
- ✅ **Metadata** - Automatically add timestamps, user IDs, or version numbers
- ✅ **Rate Limiting** - Throttle frequent updates to prevent performance issues
- ✅ **History Overflow Detection** - Archive old history to external storage

**Quick example:**

```typescript
const travels = createTravels({ count: 0 });
const originalSetState = travels.setState.bind(travels);

// Add validation
travels.setState = function (updater: any) {
  if (typeof updater === 'object' && updater.count > 100) {
    console.error('Count cannot exceed 100');
    return; // Block the operation
  }
  return originalSetState(updater);
} as any;
```

**📖 Full documentation:** See [Advanced Patterns Guide](docs/advanced-patterns.md) for:

- Complete examples with both direct values and mutation functions
- Composable wrapper patterns (validation, logging, permissions)
- Real-world integration patterns
- TypeScript-safe implementation techniques

## Maintenance

- [Compatibility policy](docs/compatibility.md)
- [Persistence integrations](docs/persistence-integrations.md)
- [Migration guide](docs/migration-guide.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Release checklist](docs/release-checklist.md)
- API docs site is built by the [`API Docs`](.github/workflows/docs.yml) workflow.

## Related Projects

- [use-travel](https://github.com/mutativejs/use-travel) - React hook for time travel
- [zustand-travel](https://github.com/mutativejs/zustand-travel) - Zustand middleware for time travel
- [mutative](https://github.com/unadlib/mutative) - Efficient immutable updates

## License

MIT
