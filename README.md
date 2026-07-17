# Travels

![Node CI](https://github.com/mutativejs/travels/workflows/Node%20CI/badge.svg)
[![npm](https://img.shields.io/npm/v/travels.svg)](https://www.npmjs.com/package/travels)
![license](https://img.shields.io/npm/l/travels)

**Patch-based undo/redo optimized for large state, small updates, long history, and persistence.**

Travels gives your users the power to undo and redo their actions—essential for text editors, drawing apps, form builders, and any interactive application. Unlike traditional undo systems that copy entire state objects for each change, Travels stores only the differences (JSON Patches), making history much smaller to keep in memory and persist when updates touch a small part of a large state tree.

Works with React, Vue, Zustand, or vanilla JavaScript.

## Table of Contents

- [Why Travels? Performance That Scales](#why-travels-performance-that-scales)
- [Choosing the Right Undo Strategy](#choosing-the-right-undo-strategy)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
  - [createTravels](#createtravelsinitialstate-options)
  - [Instance Methods](#instance-methods)
  - [maxHistory option](#maxhistory-option)
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

| Priority                                                                   | Travels fit              | Trade-off                                                                                           |
| -------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| Minimize serialized history size                                           | Strong                   | Patch history is compact for small changes to large state                                           |
| Persist history to localStorage, IndexedDB, worker messages, or cloud sync | Strong                   | You still need a storage and migration strategy                                                     |
| Lowest setState/undo/redo latency for tiny state                           | Usually not the best fit | Patch generation and patch application add overhead                                                 |
| Large replace-everything updates                                           | Scenario-dependent       | Large patches can approach snapshot costs                                                           |
| Framework integration                                                      | Strong                   | Use immutable mode by default; use mutable mode for reactive stores that require identity stability |

For current benchmark numbers and caveats, see [`benchmarks/README.md`](benchmarks/README.md). The benchmark results intentionally separate hot-path latency from persistence costs because those trade-offs decide whether patch-based history is the right tool.

## Installation

```bash
npm install travels mutative
# or
pnpm add travels mutative
```

#### Integrations

- Zustand: [zustand-travel](https://github.com/mutativejs/zustand-travel) - A powerful and high-performance time-travel middleware for Zustand
- React: [use-travel](https://github.com/mutativejs/use-travel) - A React hook for state time travel with undo, redo, reset and archive functionalities.

## Quick Start

```typescript
import { createTravels } from 'travels';

// Create a travels instance with initial state
const travels = createTravels({ count: 0 });

// Subscribe to state changes
const unsubscribe = travels.subscribe((state, patches, position) => {
  console.log('State:', state);
  console.log('Position:', position);
});

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

For persistence-safe history, keep state **JSON-compatible**: plain objects, arrays, strings, numbers, booleans, and `null`. Map/Set have limited runtime support in immutable mode, but need a custom codec for JSON persistence. Complex types like Date, class instances, DOM nodes, refs, and functions are not supported as durable state. See [State Requirements](#state-requirements-and-compatibility) for details.

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

**Parameters:**

| Parameter                | Type           | Description                                                                                                                                                                                                                              | Default                          |
| ------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `initialState`           | S              | Your application's starting state (see [state compatibility](#state-requirements-and-compatibility))                                                                                                                                     | (required)                       |
| `maxHistory`             | number         | Maximum number of history entries to keep. Older entries are dropped. Must be a non-negative integer (`NaN`, `Infinity`, decimals are rejected).                                                                                         | 10                               |
| `initialPatches`         | TravelPatches  | Restore saved patches when loading from storage                                                                                                                                                                                          | {patches: [],inversePatches: []} |
| `strictInitialPatches`   | boolean        | Whether invalid `initialPatches` should throw. When `false`, invalid patches are discarded and history starts empty                                                                                                                      | false                            |
| `initialPosition`        | number         | Restore position when loading from storage                                                                                                                                                                                               | 0                                |
| `history`                | TravelsHistory | Restore validated history returned by `Travels.deserialize(...)`; overrides `initialPatches` and `initialPosition`                                                                                                                       | undefined                        |
| `autoArchive`            | boolean        | Automatically save each change to history (see [Archive Mode](#archive-mode-control-when-changes-are-saved))                                                                                                                             | true                             |
| `mutable`                | boolean        | Whether to mutate the state in place (for observable state like MobX, Vue, Pinia)                                                                                                                                                        | false                            |
| `warnOnUnsupportedState` | boolean        | Development warning for state values with weak patch/persistence semantics                                                                                                                                                               | true in development              |
| `onError`                | function       | Receives typed `TravelsError` failures from core helper APIs                                                                                                                                                                             | undefined                        |
| `onBranchDiscard`        | function       | Called when a new edit after undo discards redo entries                                                                                                                                                                                  | undefined                        |
| `onObserverError`        | function       | Receives errors thrown by listeners, devtools, and lifecycle hooks after the transition has committed                                                                                                                                    | undefined                        |
| `devtools`               | function       | Receives timeline events for external devtools integrations                                                                                                                                                                              | undefined                        |
| `patchesOptions`         | PatchesOptions | Customize JSON Patch format. Supports `{ pathAsArray: boolean }` to control path format. Patches are always enabled and cannot be set to `false`. See [Mutative patches docs](https://mutative.js.org/docs/api-reference/create#patches) | `{}`                             |
| `enableAutoFreeze`       | boolean        | Prevent accidental state mutations outside setState ([learn more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options))                                                                                        | false                            |
| `strict`                 | boolean        | Enable stricter immutability checks ([learn more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options))                                                                                                        | false                            |
| `mark`                   | Mark<O, F>[]   | Mark certain objects as immutable ([learn more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options))                                                                                                          | () => void                       |

**Returns:** `Travels<S, F, A>` - A Travels instance

### Instance Methods

#### `getState(): S`

Get the current state.

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

#### `subscribe(listener: (state, patches, position) => void): () => void`

Subscribe to state changes. Returns an unsubscribe function.

The `patches` argument is a shared per-event snapshot. It is materialized lazily,
so state-only subscribers do not copy the complete history on every update.
Treat it as read-only; mutating it can affect other listeners or devtools hooks
handling the same event. Once accessed, the snapshot remains stable even after
later history updates.

Notifications run only after state, position, and history have committed. An
observer exception is isolated from other observers and is reported through
`onObserverError` when configured. Synchronous calls to mutating Travels APIs
from an observer are rejected to prevent nested transitions from mixing event
versions; schedule a later task if a follow-up update is required.
Observer promises are not awaited, but rejected promises are isolated and
reported through `onObserverError` with the same source information.

**Parameters:**

- `listener`: Callback function called on state changes
  - `state`: The new state
  - `patches`: The current patches history
  - `position`: The current position in history

#### `back(amount?: number): void`

Undo one or more changes by moving back in history. Defaults to 1 step.

#### `forward(amount?: number): void`

Redo one or more changes by moving forward in history. Defaults to 1 step.

#### `go(position: number): void`

Jump to a specific position in the history timeline.

#### `reset(): void`

Reset to the initial state and clear all history.

#### `rebase(): void`

Remove all past and future history and make the current state as the new initial state.

> [!WARNING]
> This is a **destructive operation**. All previous and future history entries are discarded, and the current state (including any unarchived temp patches) becomes the new baseline (position 0). Any subsequent `reset()` calls will return to this new baseline, not the original initial state.

#### `getHistory(): readonly S[]`

Returns the complete history of states as an array.

> **IMPORTANT**: Treat the returned array and every state entry as read-only. They are cached internally.
> In development mode, only the array container is frozen; the state entries are shared cached snapshots and are not deep-frozen.
> In production mode, modifying the array or any entry will corrupt the cache.

#### `getPosition(): number`

Returns the current position in the history timeline.

#### `getPatches(): TravelPatches`

Returns the stored patches (the differences between states).

#### `getMetadata(): Array<TravelMetadata | undefined>`

Returns metadata aligned with `getPatches()` entries, including the pending manual archive entry when one exists.

#### `getHistoryEntries(): TravelHistoryEntry[]`

Returns patch entries with inverse patches and optional metadata, using the same entry set as `getPatches()`. Use this for undo menus, devtools timelines, and audit views.

#### `serialize(): TravelsSerializedHistory`

Returns a versioned persistence snapshot containing the current state, patch history, and position. The returned state and patches are cloned so callers can safely pass the value to `JSON.stringify`, storage adapters, or compression.

#### `Travels.deserialize(snapshot, options?): TravelsSerializedHistory`

Validates and normalizes a persisted snapshot before restoring it with `createTravels(..., { history })`. Accepts either a parsed object or a JSON string. Validation replays every entry from the stored position in both directions and rejects patches that cannot be applied or reversed. Invalid input throws `TravelsPersistenceError` unless a `fallback` is supplied.

#### `canBack(): boolean`

Returns `true` if undo is possible (not at the beginning of history).

#### `canForward(): boolean`

Returns `true` if redo is possible (not at the end of history).

#### `archive(metadata?): void` (Manual archive mode only)

Saves the current state to history. Only available when `autoArchive: false`. Accepts optional metadata. If omitted, Travels uses the latest metadata supplied to pending `setState(...)` calls.

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

#### `pauseTracking(): void` / `resumeTracking(): void`

Temporarily apply state updates without creating history entries. Paused updates become the new baseline so later undo/redo cannot replay patches against mismatched state.

#### `replaceStateWithoutHistory(updater): void`

Replace or mutate state without creating a history entry, then clear history and use the result as the new baseline. This is useful for loading server state, applying remote snapshots, or resetting external store data.

#### `getControls(): RebasableTravelsControls | RebasableManualTravelsControls`

Returns a controls object containing all navigation methods and current state, including `rebase()`. Useful for passing to UI components without exposing the entire Travels instance. The controls object is cached and should be treated as read-only (it is frozen in development).

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

**Example: Understanding the history window**

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

## Mutable Mode: Keep Reactive State In Place

`mutable: true` lets Travels mutate the same object reference you hand in. This is crucial for observable stores (MobX, Vue/Pinia, custom proxies) that depend on identity stability to trigger reactions. Under the hood, Travels still generates JSON Patches but applies them back to the live object via Mutative's `apply(..., { mutable: true })`, so undo/redo continues to work without allocating new objects.

### When to Enable It

- You pass a reactive store into `createTravels` and swapping the reference would break your observers.
- You expect subscribers (`travels.subscribe`) to always receive the exact same object instance.
- You batch multiple mutations with `autoArchive: false` but still need the UI to reflect every intermediate change.

Stick with the default immutable mode for reducer-driven stores (Redux, Zustand) where replacing the root object is the norm.

### Behavior at a Glance

- `setState` keeps the reference stable as long as the current state root is an object. Primitive roots (number, string, `null`) trigger an automatic immutable fallback plus a dev warning.
- Function updaters that return a brand-new root (root replacement) also fall back to immutable assignment in mutable mode, with a dev warning.
- No-op updates (producing empty patches) are optimized away and won't create history entries or notify subscribers.
- `back`, `forward`, and `go` also mutate in place unless the history entry performs a root-level replacement (patch path `[]`). Those rare steps reassign the reference to keep history correct.
- Root array time-travel in mutable mode can have ordering limitations; if you rely on array root navigation, prefer immutable mode or wrap the array in an object.
- `reset` replays a diff from the original initial state, so the observable reference survives a reset.
- `archive` (manual mode) merges temporary patches and still mutates the live object before saving history.
- `getHistory()` reconstructs and caches snapshots from the stored patches. Treat the returned array and every entry as read-only; they are not reactive proxies.
- `subscribe` listeners always receive the live mutable object, so `state === travels.getState()` stays true.

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

### Limitations & Tips

**Compatibility Requirements:**

Mutable mode has the same durable-state requirements as immutable mode, plus a stricter rule for Map/Set: Map and Set are not supported in mutable mode because in-place patch application cannot reliably preserve their reactive semantics. See [State Requirements and Compatibility](#state-requirements-and-compatibility) for the full matrix.

**Other Tips:**

- If you often replace the entire root object (e.g., `setState(() => newState)`) the library has to fall back to immutable jumps when navigating history. Prefer mutating the provided draft to keep reference sharing.
- You can inspect `travels.mutable` at runtime to verify which mode is active.
- See [`docs/mutable-mode.md`](docs/mutable-mode.md) for a deep dive, integration checklists, and troubleshooting tips.

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

## State Requirements and Compatibility

Travels works best when state is durable data: plain objects, arrays, strings, numbers, booleans, and `null`. The patch engine can clone some richer JavaScript values, but JSON persistence and cross-environment replay only have predictable semantics for JSON-compatible data.

| Value                                   | Immutable runtime                  | Mutable runtime                                | JSON persistence                  | Recommendation                   |
| --------------------------------------- | ---------------------------------- | ---------------------------------------------- | --------------------------------- | -------------------------------- |
| Plain object                            | Supported                          | Supported                                      | Supported                         | Preferred                        |
| Array                                   | Supported                          | Supported, except sparse root array edge cases | Supported                         | Preferred                        |
| string, number, boolean, `null`         | Supported                          | Falls back to immutable for primitive roots    | Supported                         | Preferred                        |
| `undefined`                             | Patchable in memory                | Patchable in memory                            | Removed from JSON objects         | Use `null`                       |
| `Date`                                  | Cloneable, but not durable         | Cloneable, but not durable                     | Restored as a string through JSON | Store timestamp or ISO string    |
| `Map` / `Set`                           | Runtime support in immutable mode  | Not supported                                  | Requires custom codec             | Store arrays, or provide a codec |
| Class instance / custom prototype       | Not durable                        | Not durable                                    | Loses prototype/methods           | Store plain data or IDs          |
| Function                                | Not supported                      | Not supported                                  | Dropped by JSON                   | Keep behavior outside state      |
| Circular reference                      | Not supported for JSON persistence | Not supported for JSON persistence             | `JSON.stringify` fails            | Normalize graph to IDs           |
| DOM node, ref, observable instance body | Not supported as durable state     | Not supported as durable state                 | Not serializable                  | Store outside Travels state      |
| WeakMap / WeakSet                       | Not supported                      | Not supported                                  | Not serializable                  | Store outside Travels state      |

TypeScript helpers are exported for users who want to enforce the durable subset in their own app code:

```ts
import { createTravels, type JsonValue, type PatchableState } from 'travels';

const initialDocumentState = {
  title: 'Draft',
  blocks: [] as Array<{ id: string; text: string }>,
} satisfies JsonValue;

const travels = createTravels(initialDocumentState);

function createHistoryFor<S extends PatchableState>(state: S) {
  return createTravels(state);
}
```

In development, Travels scans initial state and changed state for known compatibility hazards and logs warnings once per path. Disable those warnings with `warnOnUnsupportedState: false` when you intentionally provide custom codecs or non-persistent runtime-only values.

## Framework Integration

Runnable and copyable integration examples live in [`examples/`](examples/):

- [`examples/zustand.ts`](examples/zustand.ts)
- [`examples/vue.ts`](examples/vue.ts)
- [`examples/pinia.ts`](examples/pinia.ts)
- [`examples/mobx.ts`](examples/mobx.ts)
- [`examples/form-builder.ts`](examples/form-builder.ts)
- [`examples/canvas-editor.ts`](examples/canvas-editor.ts)
- [`examples/local-first-persistence.ts`](examples/local-first-persistence.ts)

### React Integration

```jsx
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

### External Form Manager Integration

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

### Zustand Integration

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
travels.subscribe((state) => {
  useStore.setState(state);
});
```

### Vue Integration

```typescript
import { ref, readonly } from 'vue';
import { createTravels } from 'travels';

export function useTravel(initialState, options) {
  const travels = createTravels(initialState, options);
  const state = ref(travels.getState());

  travels.subscribe((newState) => {
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

## Persistence: Saving History to Storage

To persist state across browser sessions or page reloads, use the versioned snapshot API. A snapshot contains the current state, patch history, position, and schema version.

```typescript
import { createTravels, Travels, TravelsPersistenceError } from 'travels';

function saveToStorage(travels) {
  localStorage.setItem('travels:document', JSON.stringify(travels.serialize()));
}

function loadFromStorage() {
  const stored = localStorage.getItem('travels:document');
  if (!stored) return createTravels(defaultState);

  const history = Travels.deserialize(stored, {
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

  return createTravels(history.state, {
    history,
    maxHistory: 50,
    strictInitialPatches: true,
  });
}
```

`Travels.deserialize(...)` validates:

- schema version
- snapshot shape
- patch array shape
- JSON Patch operation names and paths
- position bounds
- semantic replay from the stored position to both ends of history
- forward/inverse reversibility for every reachable entry

It throws `TravelsPersistenceError` with a stable `code` such as `PARSE_ERROR`, `UNSUPPORTED_VERSION`, `INVALID_SCHEMA`, `INVALID_PATCHES`, `INVALID_HISTORY`, `MIGRATION_FAILED`, or `FALLBACK_FAILED`. Semantic failures also expose `entryIndex` and `direction` (`forward` or `inverse`). Provide `fallback` when detected parsing, migration, or validation failures should recover to a known-safe snapshot instead of failing startup. Fallback snapshots pass through the same structural and semantic validation; a throwing or invalid fallback reports `FALLBACK_FAILED`.

If history was recorded with custom Mutative replay behavior, provide the same
settings during validation:

```typescript
const history = Travels.deserialize(stored, {
  replayOptions: {
    strict: true,
    mark: customMark,
  },
});
```

Semantic validation never enables auto-freeze because freezing does not change
patch interpretation. `Travels.deserialize(...)` therefore does not freeze
caller-owned snapshot objects; configure auto-freeze on the restored Travels
instance instead.

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

Use `migrate` to upgrade older snapshots before validation:

```typescript
const history = Travels.deserialize(stored, {
  migrate(snapshot) {
    if (snapshot && typeof snapshot === 'object' && snapshot.version === 0) {
      return {
        version: 1,
        state: snapshot.state,
        patches: snapshot.history,
        position: snapshot.cursor,
      };
    }

    return snapshot;
  },
});
```

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
