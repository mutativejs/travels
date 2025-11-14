# Travels

![Node CI](https://github.com/mutativejs/travels/workflows/Node%20CI/badge.svg)
[![npm](https://img.shields.io/npm/v/travels.svg)](https://www.npmjs.com/package/travels)
![license](https://img.shields.io/npm/l/travels)

**A fast, framework-agnostic undo/redo library that stores only changes, not full snapshots.**

Travels gives your users the power to undo and redo their actions—essential for text editors, drawing apps, form builders, and any interactive application. Unlike traditional undo systems that copy entire state objects for each change, Travels stores only the differences (JSON Patches), making it **10x faster and far more memory-efficient**.

Works with React, Vue, Zustand, or vanilla JavaScript.

## Table of Contents

- [Why Travels? Performance That Scales](#why-travels-performance-that-scales)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
  - [createTravels](#createtravelsinitialstate-options)
  - [Instance Methods](#instance-methods)
  - [maxHistory option](#maxhistory-option)
- [Mutable Mode: Keep Reactive State In Place](#mutable-mode-keep-reactive-state-in-place)
- [Archive Mode: Control When Changes Are Saved](#archive-mode-control-when-changes-are-saved)
- [State Requirements: JSON-Serializable Only](#state-requirements-json-serializable-only)
- [Framework Integration](#framework-integration)
- [Persistence: Saving History to Storage](#persistence-saving-history-to-storage)
- [TypeScript Support](#typescript-support)
- [Advanced: Extending Travels with Custom Logic](#advanced-extending-travels-with-custom-logic)
- [Related Projects](#related-projects)
- [License](#license)

## Why Travels? Performance That Scales

Traditional undo systems clone your entire state object for each change. If your state is 1MB and the user makes 100 edits, that's 100MB of memory. Travels stores only the differences between states (JSON Patches following [RFC 6902](https://jsonpatch.com/)), so that same 1MB object with 100 small edits might use just a few kilobytes.

**Two key advantages:**

- **Memory-efficient history storage** - Stores only differences (patches), not full snapshots. Changing one field in a large object stores only a few bytes.

- **Fast immutable updates** - Built on [Mutative](https://github.com/unadlib/mutative), which is [10x faster than Immer](https://mutative.js.org/docs/getting-started/performance). Write simple mutation code like `draft.count++` while maintaining immutability.

**Framework-agnostic** - Works with React, Vue, Zustand, MobX, Pinia, or vanilla JavaScript.

## Installation

```bash
npm install travels mutative
# or
yarn add travels mutative
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

Your state must be **JSON-serializable** (plain objects, arrays, strings, numbers, booleans, null) or Map/Set(Supported only in immutable mode; not supported in mutable mode.). Complex types like Date, class instances, and functions are not supported and may cause unexpected behavior. See [State Requirements](#state-requirements-json-serializable-only) for details.

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

| Parameter          | Type                      | Description                                                                                                                                                                     | Default                          |
| ------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `initialState`     | S                         | Your application's starting state (must be [JSON-serializable](#state-requirements-json-serializable-only))                                                                     | (required)                       |
| `maxHistory`       | number                    | Maximum number of history entries to keep. Older entries are dropped.                                                                                                           | 10                               |
| `initialPatches`   | TravelPatches             | Restore saved patches when loading from storage                                                                                                                                 | {patches: [],inversePatches: []} |
| `initialPosition`  | number                    | Restore position when loading from storage                                                                                                                                      | 0                                |
| `autoArchive`      | boolean                   | Automatically save each change to history (see [Archive Mode](#archive-mode-control-when-changes-are-saved))                                                                    | true                             |
| `mutable`          | boolean                   | Whether to mutate the state in place (for observable state like MobX, Vue, Pinia)                                                                                               | false                            |
| `patchesOptions`   | boolean ｜ PatchesOptions | Customize JSON Patch format. Supports `{ pathAsArray: boolean }` to control path format. See [Mutative patches docs](https://mutative.js.org/docs/api-reference/create#patches) | `true` (enable patches)          |
| `enableAutoFreeze` | boolean                   | Prevent accidental state mutations outside setState ([learn more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options))                               | false                            |
| `strict`           | boolean                   | Enable stricter immutability checks ([learn more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options))                                               | false                            |
| `mark`             | Mark<O, F>[]              | Mark certain objects as immutable ([learn more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options))                                                 | () => void                       |

**Returns:** `Travels<S, F, A>` - A Travels instance

### Instance Methods

#### `getState(): S`

Get the current state.

#### `setState(updater: S | (() => S) | ((draft: Draft<S>) => void)): void`

Update the state. Supports three styles:

- **Direct value:** `setState({ count: 1 })` - Replace state with a new object
- **Function returning value:** `setState(() => ({ count: 1 }))` - Compute new state
- **Draft mutation (recommended):** `setState((draft) => { draft.count = 1 })` - Mutate a draft copy

#### `subscribe(listener: (state, patches, position) => void): () => void`

Subscribe to state changes. Returns an unsubscribe function.

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

#### `getHistory(): S[]`

Returns the complete history of states as an array.

#### `getPosition(): number`

Returns the current position in the history timeline.

#### `getPatches(): TravelPatches`

Returns the stored patches (the differences between states).

#### `canBack(): boolean`

Returns `true` if undo is possible (not at the beginning of history).

#### `canForward(): boolean`

Returns `true` if redo is possible (not at the end of history).

#### `archive(): void` (Manual archive mode only)

Saves the current state to history. Only available when `autoArchive: false`.

#### `canArchive(): boolean` (Manual archive mode only)

Returns `true` if there are unsaved changes that can be archived.

#### `mutable: boolean`

Returns whether mutable mode is enabled.

#### `getControls(): TravelsControls | ManualTravelsControls`

Returns a controls object containing all navigation methods and current state. Useful for passing to UI components without exposing the entire Travels instance.

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
- `back`, `forward`, and `go` also mutate in place unless the history entry performs a root-level replacement (patch path `[]`). Those rare steps reassign the reference to keep history correct.
- `reset` replays a diff from the original initial state, so the observable reference survives a reset.
- `archive` (manual mode) merges temporary patches and still mutates the live object before saving history.
- `getHistory()` reconstructs new objects from the stored patches. Treat them as read-only snapshots—they are not reactive proxies.
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

**JSON Serialization Requirements:**

The state must stay JSON-serializable because `reset()` relies on `deepClone(initialState)` for mutable mode. This has important implications:

- ❌ **Date objects** → Converted to ISO strings (not restored as Date)

  ```ts
  {
    createdAt: new Date();
  } // Becomes: { createdAt: "2025-01-15T..." }
  ```

- ❌ **Map and Set** → Lost entirely (empty objects)

  ```ts
  {
    tags: new Set(['a', 'b']);
  } // Becomes: { tags: {} }
  ```

- ❌ **undefined values** → Removed from objects

  ```ts
  { name: 'Alice', age: undefined }  // Becomes: { name: 'Alice' }
  ```

- ❌ **Sparse arrays** → Holes become `null`

  ```ts
  [1, , 3]; // Becomes: [1, null, 3]
  ```

- ❌ **Functions** → Lost entirely

  ```ts
  {
    handler: () => {};
  } // Becomes: { handler: undefined } → removed
  ```

- ❌ **Circular references** → Causes JSON.stringify error

  ```ts
  const obj = { self: null };
  obj.self = obj; // ❌ TypeError: Converting circular structure to JSON
  ```

- ❌ **Class instances** → Converted to plain objects (lose methods/prototype)
  ```ts
  class User {
    getName() {}
  }
  {
    user: new User();
  } // Becomes plain object without methods
  ```

**Workarounds:**

- Store timestamps as numbers: `{ createdAt: Date.now() }`
- Store Set/Map as arrays: `{ tags: ['a', 'b'] }`
- Avoid undefined—use `null` instead
- Serialize class instances before storing
- Break circular references or use a custom serialization strategy

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
travels.setState({ count: 1 }); // History: [0, 1]
travels.setState({ count: 2 }); // History: [0, 1, 2]
travels.setState({ count: 3 }); // History: [0, 1, 2, 3]

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

## State Requirements: JSON-Serializable Only

Travels stores and persists state using `deepClone(...)` internally. This makes reset and persistence fast and reliable, but **only JSON-serializable values are preserved**.

**What works:** Objects, arrays, numbers, strings, booleans,`null`, and `Map`/`Set`(Supported only in immutable mode; not supported in mutable mode.).

**What doesn't work:** `Date`, class instances, functions, or custom prototypes. These will either be converted (Date becomes an ISO string) or dropped entirely when history is reset or persisted.

**Solution:** Convert complex types to simple representations before storing. For example, store timestamps as numbers instead of Date objects, or store IDs that reference external data instead of storing class instances directly.

This limitation applies even with the `mutable: true` option.

## Framework Integration

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

To persist state across browser sessions or page reloads, save the current state, patches, and position. When reloading, pass these values as `initialState`, `initialPatches`, and `initialPosition`:

```typescript
// Save to localStorage
function saveToStorage(travels) {
  localStorage.setItem('state', JSON.stringify(travels.getState()));
  localStorage.setItem('patches', JSON.stringify(travels.getPatches()));
  localStorage.setItem('position', JSON.stringify(travels.getPosition()));
}

// Load from localStorage
function loadFromStorage() {
  const initialState = JSON.parse(localStorage.getItem('state') || '{}');
  const initialPatches = JSON.parse(
    localStorage.getItem('patches') || '{"patches":[],"inversePatches":[]}'
  );
  const initialPosition = JSON.parse(localStorage.getItem('position') || '0');

  return createTravels(initialState, {
    initialPatches,
    initialPosition,
  });
}
```

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

## Related Projects

- [use-travel](https://github.com/mutativejs/use-travel) - React hook for time travel
- [zustand-travel](https://github.com/mutativejs/zustand-travel) - Zustand middleware for time travel
- [mutative](https://github.com/unadlib/mutative) - Efficient immutable updates

## License

MIT
