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

| Parameter          | Type          | Description                                                                                                              | Default                          |
| ------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `initialState`     | S             | Your application's starting state (must be JSON-serializable)                                                           | (required)                       |
| `maxHistory`       | number        | Maximum number of history entries to keep. Older entries are dropped.                                                   | 10                               |
| `initialPatches`   | TravelPatches | Restore saved patches when loading from storage                                                                         | {patches: [],inversePatches: []} |
| `initialPosition`  | number        | Restore position when loading from storage                                                                               | 0                                |
| `autoArchive`      | boolean       | Automatically save each change to history (see [Archive Mode](#archive-mode-control-when-changes-are-saved))            | true                             |
| `enableAutoFreeze` | boolean       | Prevent accidental state mutations outside setState ([learn more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options)) | false                            |
| `strict`           | boolean       | Enable stricter immutability checks ([learn more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options))           | false                            |
| `mark`             | Mark<O, F>[]  | Mark certain objects as immutable ([learn more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options))           | () => void                       |

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

When you set `maxHistory`, the history window is limited to the last `maxHistory` states.

For example, if you set `maxHistory` to 3, the history window is [2, 3, 4, 5].

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

// With maxHistory: 3, we can go back up to 3 steps
// Position is capped at maxHistory (3), so we're at position 3 with count 5
// Due to how travels manages patches with maxHistory, the history window is [2, 3, 4, 5]
controls.back();
expect(travels.getPosition()).toBe(2);
expect(travels.getState().count).toBe(4);

controls.back();
expect(travels.getPosition()).toBe(1);
expect(travels.getState().count).toBe(3);

controls.back();
expect(travels.getPosition()).toBe(0);
expect(travels.getState().count).toBe(2); // Can only go back to the window start, not initial state

expect(controls.canBack()).toBe(false); // Can't go further back

// However, reset() can still return to the true initial state
controls.reset();
expect(travels.getState().count).toBe(0);
```

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

Travels stores and persists state using `JSON.parse(JSON.stringify(...))` internally. This makes reset and persistence fast and reliable, but **only JSON-serializable values are preserved**.

**What works:** Objects, arrays, numbers, strings, booleans, and `null`.

**What doesn't work:** `Date`, `Map`, `Set`, class instances, functions, or custom prototypes. These will either be converted (Date becomes an ISO string) or dropped entirely when history is reset or persisted.

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

You can enhance Travels by wrapping its methods to add validation, permissions, logging, or other custom behavior.

### Intercepting and modifying operations

While `subscribe()` lets you observe state changes, it cannot prevent or modify operations. To add validation, permissions, or transform data before execution, wrap the Travels methods:

**Adding validation:**

```typescript
const travels = createTravels({ count: 0 });

// Save the original method
const originalSetState = travels.setState.bind(travels);

// Wrap setState with validation
travels.setState = function (updater: any) {
  // Only validate direct values (not functions)
  if (typeof updater === 'object' && updater !== null) {
    // Validate
    if (updater.count > 10) {
      console.error('Count cannot exceed 10!');
      return; // Prevent execution
    }

    // Modify input - add metadata
    updater = {
      ...updater,
      count: Math.min(updater.count, 10),
      timestamp: Date.now(),
    };
  }

  // For mutation functions, wrap to validate after execution
  if (typeof updater === 'function') {
    const wrappedUpdater = (draft: any) => {
      // Execute the original mutation
      updater(draft);

      // Validate after mutation
      if (draft.count > 10) {
        draft.count = 10; // Fix invalid state
        console.warn('Count was capped at 10');
      }

      // Add metadata
      draft.timestamp = Date.now();
    };

    originalSetState(wrappedUpdater);
    return;
  }

  // Execute for direct values
  originalSetState(updater);
} as any;

travels.setState({ count: 5 }); // ✅ Works
travels.setState({ count: 100 }); // ❌ Blocked, capped at 10

// Also works with mutation functions
travels.setState((draft) => {
  draft.count = 100; // Will be capped at 10
});
```

### Adding permission checks

Wrap methods to verify permissions before allowing execution:

```typescript
const currentUser = { role: 'viewer' }; // Read-only user

// Prevent undo/redo for viewers
const originalBack = travels.back.bind(travels);
travels.back = function (amount?: number) {
  if (currentUser.role === 'viewer') {
    throw new Error('Permission denied: viewers cannot undo');
  }
  return originalBack(amount);
} as any;

// Same for other methods
const originalForward = travels.forward.bind(travels);
travels.forward = function (amount?: number) {
  if (currentUser.role === 'viewer') {
    throw new Error('Permission denied: viewers cannot redo');
  }
  return originalForward(amount);
} as any;
```

### Automatically adding metadata to state changes

Wrap `setState` to inject metadata like timestamps or user IDs:

```typescript
const travels = createTravels<any>({ items: [] });
const currentUser = { id: 'user123' };

const originalSetState = travels.setState.bind(travels);

travels.setState = function (updater: any) {
  // Handle direct value
  if (typeof updater === 'object' && updater !== null) {
    if (updater.items) {
      updater = {
        ...updater,
        items: updater.items.map((item: any) => ({
          ...item,
          timestamp: Date.now(),
          userId: currentUser.id,
          version: (item.version || 0) + 1,
        })),
      };
    }
    return originalSetState(updater);
  }

  // Handle mutation function
  if (typeof updater === 'function') {
    const wrappedUpdater = (draft: any) => {
      updater(draft); // Execute original mutation

      // Add metadata after mutation
      if (draft.items) {
        draft.items.forEach((item: any) => {
          if (!item.timestamp) {
            item.timestamp = Date.now();
            item.userId = currentUser.id;
            item.version = (item.version || 0) + 1;
          }
        });
      }
    };
    return originalSetState(wrappedUpdater);
  }

  return originalSetState(updater);
} as any;

// Works with direct value
travels.setState({ items: [{ name: 'Task 1' }] });
// Result: { items: [{ name: 'Task 1', timestamp: ..., userId: ..., version: 1 }] }

// Also works with mutation
travels.setState((draft) => {
  draft.items.push({ name: 'Task 2' });
  // Metadata will be added automatically
});
```

### Implementing operation logging and auditing

Wrap methods to record all operations before and after execution:

```typescript
const auditLog: any[] = [];

const originalSetState = travels.setState.bind(travels);

travels.setState = function (updater: any) {
  // Log before
  auditLog.push({
    type: 'setState',
    timestamp: Date.now(),
    user: currentUser.id,
    before: travels.getState(),
  });

  // Execute
  const result = originalSetState(updater);

  // Log after
  auditLog.push({
    type: 'setState',
    timestamp: Date.now(),
    user: currentUser.id,
    after: travels.getState(),
  });

  return result;
} as any;
```

### Implementing rate limiting and throttling

Wrap methods to control how frequently they can be called:

```typescript
let lastCallTime = 0;
const throttleInterval = 100; // ms

const originalSetState = travels.setState.bind(travels);

travels.setState = function (updater: any) {
  const now = Date.now();
  if (now - lastCallTime < throttleInterval) {
    console.warn('Too many updates, throttled');
    return;
  }
  lastCallTime = now;
  return originalSetState(updater);
} as any;
```

### Composing multiple wrappers

Create a reusable function that applies multiple enhancements:

```typescript
const currentUser = { id: 'user123', role: 'admin' };

// Helper function to wrap travels with multiple enhancers
function enhanceTravels<S>(
  travels: Travels<S>,
  config: {
    validation?: (state: any, draft?: any) => boolean | string;
    permissions?: (action: string) => boolean;
    logging?: boolean;
    metadata?: boolean;
  }
) {
  // Wrap setState
  if (config.validation || config.metadata || config.logging) {
    const original = travels.setState.bind(travels);
    travels.setState = function (updater: any) {
      // Logging - before
      if (config.logging) {
        console.log('[setState] before:', travels.getState());
      }

      // Handle direct value
      if (typeof updater === 'object' && updater !== null) {
        // Validation for direct values
        if (config.validation) {
          const result = config.validation(updater);
          if (result !== true) {
            throw new Error(
              typeof result === 'string' ? result : 'Validation failed'
            );
          }
        }

        // Add metadata for direct values
        if (config.metadata) {
          updater = {
            ...updater,
            _meta: { timestamp: Date.now(), user: currentUser.id },
          };
        }

        const res = original(updater);

        // Logging - after
        if (config.logging) {
          console.log('[setState] after:', travels.getState());
        }

        return res;
      }

      // Handle mutation function
      if (typeof updater === 'function') {
        const wrappedUpdater = (draft: any) => {
          updater(draft);

          // Validation for mutations
          if (config.validation) {
            const result = config.validation(travels.getState(), draft);
            if (result !== true) {
              throw new Error(
                typeof result === 'string' ? result : 'Validation failed'
              );
            }
          }

          // Add metadata for mutations
          if (config.metadata) {
            draft._meta = { timestamp: Date.now(), user: currentUser.id };
          }
        };

        const res = original(wrappedUpdater);

        // Logging - after
        if (config.logging) {
          console.log('[setState] after:', travels.getState());
        }

        return res;
      }

      return original(updater);
    } as any;
  }

  // Wrap navigation methods with permissions
  if (config.permissions) {
    ['back', 'forward', 'reset', 'archive'].forEach((method) => {
      const original = (travels as any)[method]?.bind(travels);
      if (original) {
        (travels as any)[method] = function (...args: any[]) {
          if (!config.permissions!(method)) {
            throw new Error(`Permission denied: ${method}`);
          }
          return original(...args);
        };
      }
    });
  }

  return travels;
}

// Usage
const travels = createTravels({ count: 0 });
const enhanced = enhanceTravels(travels, {
  validation: (state, draft) => {
    const target = draft || state;
    if (target.count < 0) return 'Count cannot be negative';
    if (target.count > 100) return 'Count cannot exceed 100';
    return true;
  },
  permissions: (action) => {
    return currentUser.role !== 'viewer' || action === 'setState';
  },
  logging: true,
  metadata: true,
});

// Now works with both styles
enhanced.setState({ count: 50 }); // ✅ Direct value
enhanced.setState((draft) => {
  draft.count = 75;
}); // ✅ Mutation
```

### Detecting history overflow

Use `subscribe()` to detect when history reaches the maximum limit:

```typescript
const travels = createTravels({ count: 0 }, { maxHistory: 5 });
const archive: any[] = [];

let lastPosition = 0;

travels.subscribe((state, patches, position) => {
  // Detect overflow: position stops growing
  if (position === lastPosition && position >= 5) {
    // Archive to external storage
    archive.push({
      state: travels.getState(),
      patches: travels.getPatches(),
      timestamp: Date.now(),
    });

    // You can save to localStorage, IndexedDB, or API
    localStorage.setItem('archive', JSON.stringify(archive));
  }

  lastPosition = position;
});
```

### Common Patterns

Here are some reusable wrapper patterns:

```typescript
// Pattern 1: Validation wrapper
function withValidation<S>(
  travels: Travels<S>,
  validator: (state: any, draft?: any) => boolean | string
) {
  const original = travels.setState.bind(travels);
  travels.setState = function (updater: any) {
    // Handle direct value
    if (typeof updater === 'object' && updater !== null) {
      const result = validator(updater);
      if (result !== true) {
        throw new Error(
          typeof result === 'string' ? result : 'Validation failed'
        );
      }
      return original(updater);
    }

    // Handle mutation function
    if (typeof updater === 'function') {
      const wrapped = (draft: any) => {
        updater(draft);
        const result = validator(travels.getState(), draft);
        if (result !== true) {
          throw new Error(
            typeof result === 'string' ? result : 'Validation failed'
          );
        }
      };
      return original(wrapped);
    }

    return original(updater);
  } as any;
  return travels;
}

// Pattern 2: Logging wrapper
function withLogging<S>(travels: Travels<S>) {
  const methods = ['setState', 'back', 'forward', 'reset', 'archive'];
  methods.forEach((method) => {
    const original = (travels as any)[method]?.bind(travels);
    if (original) {
      (travels as any)[method] = function (...args: any[]) {
        console.log(`[${method}] called with:`, args);
        const result = original(...args);
        console.log(`[${method}] result:`, travels.getState());
        return result;
      };
    }
  });
  return travels;
}

// Pattern 3: Permissions wrapper
function withPermissions<S>(
  travels: Travels<S>,
  checkPermission: (action: string) => boolean
) {
  const methods = ['setState', 'back', 'forward', 'reset', 'archive'];
  methods.forEach((method) => {
    const original = (travels as any)[method]?.bind(travels);
    if (original) {
      (travels as any)[method] = function (...args: any[]) {
        if (!checkPermission(method)) {
          throw new Error(`Permission denied: ${method}`);
        }
        return original(...args);
      };
    }
  });
  return travels;
}

// Compose all wrappers
const travels = createTravels({ count: 0 });

withValidation(
  travels,
  (state) => state.count >= 0 || 'Count must be non-negative'
);
withLogging(travels);
withPermissions(travels, (action) => currentUser.role === 'admin');
```

## Related Projects

- [use-travel](https://github.com/mutativejs/use-travel) - React hook for time travel
- [zustand-travel](https://github.com/mutativejs/zustand-travel) - Zustand middleware for time travel
- [mutative](https://github.com/unadlib/mutative) - Efficient immutable updates

## License

MIT
