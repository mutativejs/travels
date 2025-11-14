# Advanced Patterns: Extending Travels with Custom Logic

You can enhance Travels by wrapping its methods to add validation, permissions, logging, or other custom behavior.

## Table of Contents

- [Intercepting and Modifying Operations](#intercepting-and-modifying-operations)
- [Adding Permission Checks](#adding-permission-checks)
- [Automatically Adding Metadata](#automatically-adding-metadata-to-state-changes)
- [Implementing Operation Logging and Auditing](#implementing-operation-logging-and-auditing)
- [Implementing Rate Limiting and Throttling](#implementing-rate-limiting-and-throttling)
- [Composing Multiple Wrappers](#composing-multiple-wrappers)
- [Detecting History Overflow](#detecting-history-overflow)
- [Common Patterns](#common-patterns)

## Intercepting and Modifying Operations

While `subscribe()` lets you observe state changes, it cannot prevent or modify operations. To add validation, permissions, or transform data before execution, wrap the Travels methods:

### Adding validation:

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

## Adding Permission Checks

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

## Automatically Adding Metadata to State Changes

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

## Implementing Operation Logging and Auditing

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

## Implementing Rate Limiting and Throttling

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

## Composing Multiple Wrappers

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

## Detecting History Overflow

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

## Common Patterns

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

## Back to Main Documentation

See the [main README](../README.md) for basic usage, API reference, and getting started guide.
