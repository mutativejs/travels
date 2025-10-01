/**
 * Middleware vs Subscribe Comparison Tests
 *
 * Exploring: Can Subscribe replace Middleware?
 */

import { describe, test, expect, vi } from 'vitest';
import { createTravels } from '../src/index';

describe('Middleware vs Subscribe: Capability Comparison', () => {
  test('Subscribe capability: Post-execution notification', () => {
    const travels = createTravels({ count: 0 });
    const log: string[] = [];

    travels.subscribe((state, patches, position) => {
      // ✅ Can do: Observe state changes
      log.push(`State changed to: ${state.count}`);

      // ✅ Can do: Trigger side effects
      if (state.count > 5) {
        console.log('Warning: count is too high!');
      }

      // ✅ Can do: Sync data
      localStorage.setItem('state', JSON.stringify(state));
    });

    travels.setState({ count: 1 });
    travels.setState({ count: 6 });

    expect(log).toEqual(['State changed to: 1', 'State changed to: 6']);

    // ✅ Subscribe is ideal for: "Observer" pattern
  });

  test('Middleware capability 1: Intercept and modify', () => {
    /**
     * Scenario: I want to intercept operations and modify or prevent them
     *
     * Examples:
     * - Limit maximum value of count
     * - Log operations
     * - Permission checks
     */

    // ❌ Subscribe cannot do this
    const travels = createTravels({ count: 0 });

    travels.subscribe((state) => {
      // ❌ Cannot prevent state update here
      // ❌ Cannot modify the value being updated
      if (state.count > 10) {
        // Too late! State is already updated
        console.error('Count exceeded limit!');
      }
    });

    travels.setState({ count: 100 }); // Will still update

    expect(travels.getState().count).toBe(100); // ❌ Cannot prevent

    // ✅ With method wrapping, you can do:
    /*
    const original = travels.setState.bind(travels);
    travels.setState = function(updater: any) {
      if (typeof updater === 'object' && updater.count > 10) {
        console.error('Count exceeded limit!');
        return; // Prevent execution
      }
      return original(updater);
    } as any;
    */
  });

  test('Middleware capability 2: Chain processing', () => {
    /**
     * Scenario: I want to process operations in a chain
     *
     * Example:
     * - Logging → Permission check → Validation → Execute → Notify
     */

    // ❌ Subscribe only executes at the end
    const travels = createTravels({ count: 0 });
    const executionOrder: string[] = [];

    travels.subscribe(() => {
      executionOrder.push('subscribe1');
    });

    travels.subscribe(() => {
      executionOrder.push('subscribe2');
    });

    travels.setState({ count: 1 });

    // All subscribers execute after state update
    expect(executionOrder).toEqual(['subscribe1', 'subscribe2']);

    // ✅ With middleware system, execution order could be:
    /*
    logging → validation → setState → notify
       ↓           ↓           ↓          ↓
    before      before      actual     after
    */
  });

  test('Middleware capability 3: Enhance operations', () => {
    /**
     * Scenario: I want to add extra information to operations
     *
     * Examples:
     * - Auto-add timestamp
     * - Auto-add user info
     * - Auto-add operation source
     */

    // ❌ Subscribe can only observe results, cannot modify input
    const travels = createTravels<any>({ items: [] });

    travels.subscribe((state) => {
      // ❌ Cannot modify setState's input here
      // State is already updated, cannot add timestamp to each item
    });

    travels.setState({ items: [{ name: 'item1' }] });

    // ❌ items don't have timestamp
    expect(travels.getState().items[0]).not.toHaveProperty('timestamp');

    // ✅ With method wrapping, you can auto-enhance:
    /*
    const original = travels.setState.bind(travels);
    travels.setState = function(updater: any) {
      if (typeof updater === 'object' && updater.items) {
        updater = {
          ...updater,
          items: updater.items.map(item => ({
            ...item,
            timestamp: Date.now()
          }))
        };
      }
      return original(updater);
    } as any;
    */
  });

  test('Key discovery: Method wrapping can achieve partial capabilities', () => {
    /**
     * Key insight: Wrapping setState can implement some middleware functionality
     */

    const originalTravels = createTravels({ count: 0 });

    // ✅ Wrap setState
    const originalSetState = originalTravels.setState.bind(originalTravels);

    const travels = Object.create(originalTravels);
    travels.setState = (updater: any) => {
      // 🎯 Can intercept here!

      // 1. Validation
      if (typeof updater === 'object' && updater !== null && updater.count > 10) {
        console.error('Count limit exceeded!');
        return; // Prevent execution
      }

      // 2. Modification
      if (typeof updater === 'object' && updater !== null) {
        updater = {
          ...updater,
          count: Math.min(updater.count, 10), // Limit max value
        };
      }

      // 3. Logging
      console.log('Before setState:', originalTravels.getState());

      // 4. Execute
      originalSetState(updater);

      // 5. Logging
      console.log('After setState:', originalTravels.getState());
    };

    travels.setState({ count: 5 });
    expect(travels.getState().count).toBe(5); // ✅

    travels.setState({ count: 100 });
    expect(travels.getState().count).toBe(5); // ✅ Limited!
  });

  test('Deep analysis: Wrapping vs Middleware system', () => {
    /**
     * Pros and cons of wrapping approach
     */

    const travels = createTravels({ count: 0 });
    const logs: string[] = [];

    // ✅ Pro 1: Simple, no need to modify core code
    const originalSetState = travels.setState.bind(travels);
    travels.setState = function (updater: any) {
      logs.push('wrapped setState called');
      return originalSetState(updater);
    } as any;

    travels.setState({ count: 1 });

    expect(logs).toContain('wrapped setState called');

    // ❌ Con 1: Can only wrap once, cannot compose multiple "middlewares" easily
    // If multiple wrapping needs, code becomes messy

    // ❌ Con 2: Need to manually bind this
    // ❌ Con 3: TypeScript type support is not good
    // ❌ Con 4: Cannot intercept other methods (back, forward, reset, etc) uniformly
  });

  test('Wrapping composition problem', () => {
    const travels = createTravels({ count: 0 });

    // Requirements: Add 3 "middlewares"
    // 1. Logging
    // 2. Validation
    // 3. Performance monitoring

    const original = travels.setState.bind(travels);

    // First layer: Logging
    let setState1 = function (updater: any) {
      console.log('Log: setState called');
      return original(updater);
    };

    // Second layer: Validation
    let setState2 = function (updater: any) {
      if (typeof updater === 'object' && updater !== null && updater.count < 0) {
        console.error('Validation: count cannot be negative');
        return;
      }
      return setState1(updater);
    };

    // Third layer: Performance monitoring
    travels.setState = function (updater: any) {
      const start = performance.now();
      const result = setState2(updater);
      const end = performance.now();
      console.log(`Performance: ${end - start}ms`);
      return result;
    } as any;

    // ❌ Problems:
    // 1. Code nesting is messy
    // 2. Cannot dynamically add/remove
    // 3. Execution order is unclear
    // 4. Hard to maintain

    travels.setState({ count: 5 });
    expect(travels.getState().count).toBe(5);
  });

  test('Middleware system advantage: Composability', () => {
    /**
     * With a middleware system, it would look like this:
     */

    interface MiddlewareAction {
      type: 'setState' | 'back' | 'forward' | 'reset';
      payload?: any;
    }

    type Middleware<S> = (
      action: MiddlewareAction,
      next: (action: MiddlewareAction) => void
    ) => void;

    // Middleware 1: Logging
    const loggingMiddleware: Middleware<any> = (action, next) => {
      console.log('Before:', action.type);
      next(action);
      console.log('After:', action.type);
    };

    // Middleware 2: Validation
    const validationMiddleware: Middleware<any> = (action, next) => {
      if (action.type === 'setState') {
        const state = action.payload;
        if (state?.count < 0) {
          console.error('Validation failed');
          return; // Prevent execution
        }
      }
      next(action);
    };

    // Middleware 3: Performance monitoring
    const performanceMiddleware: Middleware<any> = (action, next) => {
      const start = performance.now();
      next(action);
      const end = performance.now();
      console.log(`${action.type} took ${end - start}ms`);
    };

    // ✅ Advantages:
    // 1. Each middleware is independent
    // 2. Can be composed
    // 3. Can dynamically add/remove
    // 4. Execution order is clear
    // 5. Easy to test

    const middlewares = [
      loggingMiddleware,
      validationMiddleware,
      performanceMiddleware,
    ];

    // This is pseudo-code to show the concept
    // const travels = createTravels(state, { middlewares });
  });

  test('Key question: Does travels really need to intercept all operations?', () => {
    /**
     * Analysis: Which operations need interception?
     */

    const travels = createTravels({ count: 0 });

    // Operation 1: setState
    // Need interception? Probably (validation, modification)

    // Operation 2: back / forward / go
    // Need interception? Probably (permission checks, logging)

    // Operation 3: reset
    // Need interception? Probably (confirmation dialog)

    // Operation 4: archive
    // Need interception? Probably (validation, logging)

    // Conclusion: Yes, there seem to be needs
  });

  test('Alternative: Use composition pattern', () => {
    /**
     * Instead of modifying Travels, create an enhanced wrapper
     */

    class EnhancedTravels<S> {
      constructor(
        private travels: ReturnType<typeof createTravels<S>>,
        private interceptors: {
          beforeSetState?: (state: any) => any;
          afterSetState?: (state: any) => void;
        } = {}
      ) {}

      getState() {
        return this.travels.getState();
      }

      setState(updater: any) {
        // Interception point
        if (this.interceptors.beforeSetState) {
          updater = this.interceptors.beforeSetState(updater);
          if (updater === null) return; // Prevent
        }

        this.travels.setState(updater);

        if (this.interceptors.afterSetState) {
          this.interceptors.afterSetState(this.travels.getState());
        }
      }

      subscribe(listener: any) {
        return this.travels.subscribe(listener);
      }

      // ... wrap other methods
    }

    // Usage
    const baseTravels = createTravels({ count: 0 });
    const enhanced = new EnhancedTravels(baseTravels, {
      beforeSetState: (state) => {
        if (state.count > 10) {
          return { count: 10 }; // Limit
        }
        return state;
      },
      afterSetState: (state) => {
        console.log('State changed:', state);
      },
    });

    enhanced.setState({ count: 5 });
    expect(enhanced.getState().count).toBe(5);

    enhanced.setState({ count: 100 });
    expect(enhanced.getState().count).toBe(10); // ✅ Limited

    // ✅ This approach:
    // 1. No need to modify core code
    // 2. Composable
    // 3. Type safe
    // 4. Flexible
  });

  test('Real-world scenarios: When middleware is actually needed', () => {
    /**
     * Scenario 1: Permission system
     * Some users cannot undo/redo
     */
    const travels = createTravels({ count: 0 });
    const currentUser = { role: 'viewer' }; // Read-only user

    // ❌ Subscribe cannot prevent
    travels.subscribe(() => {
      if (currentUser.role === 'viewer') {
        console.error('No permission!');
        // But too late, state is already changed
      }
    });

    // ✅ Wrapping can prevent
    const originalBack = travels.back.bind(travels);
    travels.back = function () {
      if (currentUser.role === 'viewer') {
        throw new Error('Permission denied');
      }
      return originalBack();
    } as any;

    expect(() => travels.back()).toThrow('Permission denied');

    /**
     * Scenario 2: Audit logging
     * Record who did what and when
     */
    const auditLog: any[] = [];

    const originalSetState = travels.setState.bind(travels);
    travels.setState = function (updater: any) {
      auditLog.push({
        type: 'setState',
        user: currentUser,
        timestamp: Date.now(),
        before: travels.getState(),
      });
      const result = originalSetState(updater);
      auditLog.push({
        type: 'setState',
        user: currentUser,
        timestamp: Date.now(),
        after: travels.getState(),
      });
      return result;
    } as any;

    travels.setState({ count: 5 });

    expect(auditLog.length).toBe(2); // before + after

    /**
     * Scenario 3: Debounce/Throttle
     * Limit operation frequency
     */
    // Subscribe can do this, but not elegantly

    /**
     * Conclusion: These scenarios can all be implemented by wrapping setState
     * But if you need to wrap all methods (setState, back, forward, reset, archive),
     * the code becomes repetitive and verbose
     */
  });

  test('Final comparison: Middleware system vs Wrapping approach', () => {
    /**
     * Middleware system advantages:
     * ✅ 1. Unified interception point
     * ✅ 2. Compose multiple middlewares
     * ✅ 3. Can intercept all operations (setState, back, forward, etc)
     * ✅ 4. Clear execution order
     * ✅ 5. Easy to test and maintain
     *
     * Wrapping approach advantages:
     * ✅ 1. No need to modify core code
     * ✅ 2. Simple and direct
     * ✅ 3. Users can implement themselves
     * ✅ 4. Flexible (can wrap any method)
     *
     * Middleware system disadvantages:
     * ❌ 1. Increases core complexity
     * ❌ 2. Increases API surface
     * ❌ 3. May affect performance
     * ❌ 4. Learning curve
     *
     * Wrapping approach disadvantages:
     * ❌ 1. Users need to implement themselves
     * ❌ 2. Composing multiple wrappers is tedious
     * ❌ 3. TypeScript types may not be good
     */

    // Conclusion: Depends on use case and priorities
  });
});

describe('Core question: Capabilities Subscribe cannot replace', () => {
  test('Capability 1: Intercept and prevent operations', () => {
    /**
     * Subscribe: ❌ Can only observe after the fact
     * Middleware: ✅ Can intercept beforehand
     */

    const travels = createTravels({ count: 0 });

    // Subscribe cannot prevent
    travels.subscribe((state) => {
      if (state.count > 10) {
        // Too late!
      }
    });

    travels.setState({ count: 100 });
    expect(travels.getState().count).toBe(100); // ❌ Cannot prevent

    // But wrapping can
    const original = travels.setState.bind(travels);
    travels.setState = function (updater: any) {
      if (typeof updater === 'object' && updater !== null && updater.count > 10) {
        return; // Prevent
      }
      return original(updater);
    } as any;

    travels.setState({ count: 5 });
    expect(travels.getState().count).toBe(5); // ✅

    travels.setState({ count: 200 });
    expect(travels.getState().count).toBe(5); // ✅ Prevented

    /**
     * Conclusion: Subscribe cannot prevent, but wrapping can!
     * Doesn't necessarily need a middleware system
     */
  });

  test('Capability 2: Modify input', () => {
    /**
     * Subscribe: ❌ Can only see output
     * Middleware: ✅ Can modify input
     */

    const travels = createTravels<any>({ items: [] });

    // Subscribe cannot modify input
    travels.subscribe((state) => {
      // Cannot modify setState's parameters
    });

    // But wrapping can
    const original = travels.setState.bind(travels);
    travels.setState = function (updater: any) {
      if (typeof updater === 'object' && updater !== null && updater.items) {
        // ✅ Auto-add timestamp
        updater = {
          ...updater,
          items: updater.items.map((item: any) => ({
            ...item,
            timestamp: Date.now(),
          })),
        };
      }
      return original(updater);
    } as any;

    travels.setState({ items: [{ name: 'item1' }] });

    expect(travels.getState().items[0]).toHaveProperty('timestamp');

    /**
     * Conclusion: Subscribe cannot modify input, but wrapping can!
     */
  });

  test('Capability 3: Chain processing and order control', () => {
    /**
     * Subscribe: ❌ Unordered execution, cannot control flow
     * Middleware: ✅ Ordered execution, can control flow
     */

    const travels = createTravels({ count: 0 });
    const executionOrder: string[] = [];

    // Subscribe cannot guarantee execution order's effect on operations
    travels.subscribe(() => {
      executionOrder.push('subscriber1');
    });

    travels.subscribe(() => {
      executionOrder.push('subscriber2');
    });

    travels.setState({ count: 1 });

    // All execute after operation, cannot affect operation itself
    expect(executionOrder).toEqual(['subscriber1', 'subscriber2']);

    /**
     * With middleware:
     * middleware1 (before) → middleware2 (before) → operation → middleware2 (after) → middleware1 (after)
     */

    // But nested wrapping can also achieve this
    const original = travels.setState.bind(travels);

    let wrapped1 = function (updater: any) {
      executionOrder.push('wrapper1-before');
      const result = original(updater);
      executionOrder.push('wrapper1-after');
      return result;
    };

    travels.setState = function (updater: any) {
      executionOrder.push('wrapper2-before');
      const result = wrapped1(updater);
      executionOrder.push('wrapper2-after');
      return result;
    } as any;

    executionOrder.length = 0;
    travels.setState({ count: 2 });

    expect(executionOrder).toEqual([
      'wrapper2-before',
      'wrapper1-before',
      'subscriber1',
      'subscriber2',
      'wrapper1-after',
      'wrapper2-after',
    ]);

    /**
     * Conclusion: Wrapping can achieve chain processing!
     */
  });

  test('Enhanced wrapping: Handling mutation functions', () => {
    /**
     * When wrapping setState, must handle three cases:
     * 1. Direct value: setState({ count: 1 })
     * 2. Function returning value: setState(() => ({ count: 1 }))
     * 3. Mutation function: setState((draft) => { draft.count = 1 })
     */

    const travels = createTravels<any>({ count: 0, items: [] });
    const logs: string[] = [];

    const original = travels.setState.bind(travels);
    travels.setState = function (updater: any) {
      // Handle direct value
      if (typeof updater === 'object' && updater !== null) {
        logs.push('direct-value');
        if (updater.count !== undefined && updater.count > 10) {
          return; // Validation: prevent
        }
        if (updater.items) {
          // Add metadata to items
          updater = {
            ...updater,
            items: updater.items.map((item: any) => ({
              ...item,
              timestamp: Date.now(),
            })),
          };
        }
        return original(updater);
      }

      // Handle mutation function
      if (typeof updater === 'function') {
        logs.push('mutation-function');
        const wrappedUpdater = (draft: any) => {
          updater(draft); // Execute original mutation

          // Add logic after mutation
          if (draft.count !== undefined && draft.count > 10) {
            draft.count = 10; // Fix after mutation
          }
          if (draft.items) {
            draft.items.forEach((item: any) => {
              if (!item.timestamp) {
                item.timestamp = Date.now();
              }
            });
          }
        };
        return original(wrappedUpdater);
      }

      return original(updater);
    } as any;

    // Test direct value
    travels.setState({ count: 5 });
    expect(logs).toContain('direct-value');
    expect(travels.getState().count).toBe(5);

    // Test validation
    travels.setState({ count: 100 });
    expect(travels.getState().count).toBe(5); // Prevented

    // Test mutation function
    travels.setState((draft) => {
      draft.count = 8;
    });
    expect(logs).toContain('mutation-function');
    expect(travels.getState().count).toBe(8);

    // Test mutation function with validation
    travels.setState((draft) => {
      draft.count = 200;
    });
    expect(travels.getState().count).toBe(10); // Fixed to 10

    // Test metadata injection with direct value
    travels.setState({ items: [{ name: 'item1' }] });
    expect(travels.getState().items[0]).toHaveProperty('timestamp');

    // Test metadata injection with mutation function
    travels.setState((draft) => {
      draft.items.push({ name: 'item2' });
    });
    expect(travels.getState().items[1]).toHaveProperty('timestamp');
  });

  test('Key discovery: Wrapping can achieve almost all middleware capabilities', () => {
    /**
     * Scenarios where Subscribe cannot replace Middleware:
     * 1. ✅ Intercept and prevent - But wrapping can
     * 2. ✅ Modify input - But wrapping can
     * 3. ✅ Chain processing - But wrapping can
     * 4. ✅ Order control - But wrapping can
     *
     * Conclusion: Don't necessarily need a built-in middleware system!
     * Users can achieve the same effects by wrapping setState and other methods
     */

    expect(true).toBe(true); // Symbolic assertion
  });
});
