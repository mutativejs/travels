# Travels

![Node CI](https://github.com/mutativejs/travels/workflows/Node%20CI/badge.svg)
[![npm](https://img.shields.io/npm/v/travels.svg)](https://www.npmjs.com/package/travels)
![license](https://img.shields.io/npm/l/travels)

A fast, framework-agnostic undo/redo core library powered by Mutative JSON Patch.

## Motivation

`travels` is a small and high-performance library for implementing undo/redo functionality. It's built on [Mutative](https://github.com/unadlib/mutative) to leverage two key performance advantages:

- **Efficient History Storage with JSON Patches**: Instead of storing full state snapshots for each history entry, `travels` uses [JSON Patch](https://jsonpatch.com/) (RFC 6902) to store only the differences between states. This dramatically reduces memory usage, especially for large state objects with small changes. For example, changing a single field in a 1MB object only stores a few bytes in history.

- **High-Performance Immutable Updates**: Mutative is [10x faster than Immer](https://mutative.js.org/docs/getting-started/performance) and provides a mutation-based API for updating immutable data structures. This means you can write mutation update code (`draft.count++`) while maintaining immutability guarantees, with minimal performance overhead.

`travels` is designed to be framework-agnostic and can be integrated with React, Vue, Zustand, MobX, Pinia, and other libraries. It's suitable for building time travel features in any JavaScript application.

## Features

- ✨ Framework-agnostic core library
- 🔄 Undo/Redo/Reset/Go/Archive functionalities
- 🎯 Subscribe to state changes
- 💪 Mutations update immutable data via Mutative
- 📦 Small size with efficient JSON Patch history
- ⚙️ Customizable history size and initial patches
- 🚀 High performance
- 🔧 Mark function for custom immutability
- 🌟 Supports both auto archive and manual archive modes
- 🔥 Supports both immutable and mutable state

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

// Create a travels instance
const travels = createTravels({ count: 0 });

// Subscribe to state changes
const unsubscribe = travels.subscribe((state, patches, position) => {
  console.log('State:', state);
  console.log('Position:', position);
});

// Update state using mutation
travels.setState((draft) => {
  draft.count += 1;
});

// Or set state directly
travels.setState({ count: 2 });

// Undo
travels.back();

// Redo
travels.forward();

// Get current state
console.log(travels.getState()); // { count: 1 }

// Cleanup
unsubscribe();
```

## Online Examples

- [Travels Counter Demo](https://codesandbox.io/p/sandbox/travels-vanilla-ts-wzdd62)

## API Reference

### `createTravels(initialState, options?)`

Creates a new Travels instance.

**Parameters:**

| Parameter          | Type          | Description                                                                                                              | Default                          |
| ------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `initialState`     | S             | The initial state                                                                                                        | -                                |
| `maxHistory`       | number        | The maximum number of history to keep                                                                                    | 10                               |
| `initialPatches`   | TravelPatches | The initial patches                                                                                                      | {patches: [],inversePatches: []} |
| `initialPosition`  | number        | The initial position of the state                                                                                        | 0                                |
| `autoArchive`      | boolean       | Auto archive the state (see [Archive Mode](#archive-mode) for details)                                                   | true                             |
| `enableAutoFreeze` | boolean       | Enable auto freeze the state, [view more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options) | false                            |
| `strict`           | boolean       | Enable strict mode, [view more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options)           | false                            |
| `mark`             | Mark<O, F>[]  | The mark function , [view more](https://github.com/unadlib/mutative?tab=readme-ov-file#createstate-fn-options)           | () => void                       |

**Returns:** `Travels<S, F, A>` - A Travels instance

### Instance Methods

#### `getState(): S`

Get the current state.

#### `setState(updater: S | (() => S) | ((draft: Draft<S>) => void)): void`

Update the state. Supports:

- Direct value: `setState({ count: 1 })`
- Function returning value: `setState(() => ({ count: 1 }))`
- Draft mutation: `setState((draft) => { draft.count = 1 })`

#### `subscribe(listener: (state, patches, position) => void): () => void`

Subscribe to state changes. Returns an unsubscribe function.

**Parameters:**

- `listener`: Callback function called on state changes
  - `state`: The new state
  - `patches`: The current patches history
  - `position`: The current position in history

#### `back(amount?: number): void`

Go back in the history. Default amount is 1.

#### `forward(amount?: number): void`

Go forward in the history. Default amount is 1.

#### `go(position: number): void`

Go to a specific position in the history.

#### `reset(): void`

Reset the state to the initial state and clear history.

#### `getHistory(): S[]`

Get the complete history of states as an array.

#### `getPosition(): number`

Get the current position in the history.

#### `getPatches(): TravelPatches`

Get the patches history.

#### `canBack(): boolean`

Check if it's possible to go back.

#### `canForward(): boolean`

Check if it's possible to go forward.

#### `archive(): void` (Manual archive mode only)

Archive the current state. Only available when `autoArchive: false`.

#### `canArchive(): boolean` (Manual archive mode only)

Check if it's possible to archive the current state.

#### `mutable: boolean`

Get the mutable mode.

#### `getControls(): TravelsControls | ManualTravelsControls`

Get a controls object with all navigation methods. Useful for passing controls to UI components.

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

## Archive Mode

`travels` provides two archive modes to control how state changes are recorded in history:

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

## Integration Examples

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

## Persistence

If you want to persist the state, you can use `state`/`patches`/`position` to save the travel history. Then, read the persistent data as `initialState`, `initialPatches`, and `initialPosition` when initializing:

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

## Advanced Usage: Extending Travels

### Q: Can I intercept and modify operations before they execute?

**A: Yes! You can wrap any method to add custom behavior.**

While `subscribe()` is great for observing state changes, it cannot intercept or prevent operations. However, you can wrap Travels methods to add validation, logging, permissions, and more.

#### Example: Adding Validation

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

### Q: How do I add permission checks?

**A: Wrap methods to check permissions before executing.**

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

### Q: Can I automatically add metadata to every state change?

**A: Yes! Wrap `setState` to enhance the data.**

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

### Q: How do I implement operation logging/auditing?

**A: Wrap methods to log before and after execution.**

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

### Q: Can I implement rate limiting/throttling?

**A: Yes! Wrap methods to control execution frequency.**

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

### Q: How do I compose multiple wrappers?

**A: Create a composable wrapper function.**

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

### Q: What about detecting history overflow?

**A: Use `subscribe()` to detect when history reaches `maxHistory`.**

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
