/**
 * Mutable Mode Tests
 *
 * Tests for mutable mode support for observable state libraries (MobX, Vue, Pinia)
 */

import { describe, test, expect } from 'vitest';
import { createTravels } from '../src/index';

describe('Mutable mode for observable state', () => {
  test('setState with mutable: true preserves reference', () => {
    const state = { count: 0 };
    const travels = createTravels(state, { mutable: true });
    const originalRef = travels.getState();

    travels.setState((draft) => {
      draft.count = 1;
    });

    // ✅ Reference preserved
    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState().count).toBe(1);
  });

  test('setState with direct value and mutable: true preserves reference', () => {
    const state = { count: 0, name: 'test' };
    const travels = createTravels(state, { mutable: true });
    const originalRef = travels.getState();

    travels.setState({ count: 5, name: 'updated' });

    // ✅ Reference preserved
    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState().count).toBe(5);
    expect(travels.getState().name).toBe('updated');
  });

  test('back() with mutable: true preserves reference', () => {
    const state = { count: 0 };
    const travels = createTravels(state, { mutable: true });
    const originalRef = travels.getState();

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.back();

    // ✅ Reference preserved
    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState().count).toBe(1);
  });

  test('forward() with mutable: true preserves reference', () => {
    const state = { count: 0 };
    const travels = createTravels(state, { mutable: true });
    const originalRef = travels.getState();

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.back();
    travels.forward();

    // ✅ Reference preserved
    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState().count).toBe(2);
  });

  test('go() with mutable: true preserves reference', () => {
    const state = { count: 0 };
    const travels = createTravels(state, { mutable: true });
    const originalRef = travels.getState();

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.setState({ count: 3 });
    travels.go(1); // Go to position 1 (count: 1)

    // ✅ Reference preserved
    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState().count).toBe(1);
  });

  test('reset() with mutable: true preserves reference', () => {
    const state = { count: 0, items: [] as number[] };
    const travels = createTravels(state, { mutable: true });
    const originalRef = travels.getState();

    travels.setState({ count: 5, items: [1, 2, 3] });
    travels.reset();

    // ✅ Reference preserved
    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState()).toEqual({ count: 0, items: [] });
  });

  test('complex nested state with mutable: true', () => {
    const state = {
      user: { name: 'Alice', age: 30 },
      todos: [
        { id: 1, text: 'Task 1', completed: false },
        { id: 2, text: 'Task 2', completed: false },
      ],
    };
    const travels = createTravels(state, { mutable: true });
    const originalRef = travels.getState();

    // Update nested state
    travels.setState((draft) => {
      draft.user.age = 31;
      draft.todos[0].completed = true;
      draft.todos.push({ id: 3, text: 'Task 3', completed: false });
    });

    // ✅ Reference preserved
    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState().user.age).toBe(31);
    expect(travels.getState().todos[0].completed).toBe(true);
    expect(travels.getState().todos.length).toBe(3);

    // Undo
    travels.back();

    // ✅ Reference still preserved
    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState().user.age).toBe(30);
    expect(travels.getState().todos[0].completed).toBe(false);
    expect(travels.getState().todos.length).toBe(2);
  });

  test('manual archive mode with mutable: true', () => {
    const state = { count: 0 };
    const travels = createTravels(state, {
      mutable: true,
      autoArchive: false,
    });
    const originalRef = travels.getState();

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });

    // Before archive
    expect(travels.canArchive()).toBe(true);

    // Archive
    travels.archive();

    // ✅ Reference preserved
    expect(travels.getState()).toBe(originalRef);
    expect(travels.canArchive()).toBe(false);

    // Can undo
    travels.back();
    expect(travels.getState().count).toBe(0);
  });

  test('subscribe callback receives mutated state', () => {
    const state = { count: 0 };
    const travels = createTravels(state, { mutable: true });
    const originalRef = travels.getState();

    const stateSnapshots: any[] = [];
    const references: any[] = [];

    travels.subscribe((currentState) => {
      stateSnapshots.push({ ...currentState });
      references.push(currentState);
    });

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.back();

    // ✅ All callbacks receive the same reference
    expect(references[0]).toBe(originalRef);
    expect(references[1]).toBe(originalRef);
    expect(references[2]).toBe(originalRef);

    // ✅ But the values are correct snapshots
    expect(stateSnapshots[0]).toEqual({ count: 1 });
    expect(stateSnapshots[1]).toEqual({ count: 2 });
    expect(stateSnapshots[2]).toEqual({ count: 1 });
  });

  test('comparison: immutable mode creates new references', () => {
    const state = { count: 0 };
    const travels = createTravels(state, { mutable: false }); // Default
    const originalRef = travels.getState();

    travels.setState({ count: 1 });

    // ❌ Reference changed (expected for immutable mode)
    expect(travels.getState()).not.toBe(originalRef);
    expect(travels.getState().count).toBe(1);
  });

  test('maxHistory with mutable mode', () => {
    const state = { count: 0 };
    const travels = createTravels(state, { mutable: true, maxHistory: 3 });
    const originalRef = travels.getState();

    // Add more states than maxHistory
    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.setState({ count: 3 });
    travels.setState({ count: 4 });
    travels.setState({ count: 5 });

    // ✅ Reference still preserved
    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState().count).toBe(5);

    // ✅ Can only go back 3 steps
    expect(travels.getPosition()).toBe(3);

    // Go back to position 0
    // Note: With maxHistory: 3, the history window is [2, 3, 4, 5]
    // Position 0 is the window start (count: 2), not the original initial state
    travels.go(0);
    expect(travels.getState().count).toBe(2); // Back to window start

    // ✅ Reference still preserved even after navigation
    expect(travels.getState()).toBe(originalRef);

    // ✅ Can still reset to true initial state
    travels.reset();
    expect(travels.getState().count).toBe(0);
    expect(travels.getState()).toBe(originalRef); // Reference preserved
  });

  test('getHistory with mutable mode', () => {
    const state = { count: 0 };
    const travels = createTravels(state, { mutable: true });

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.back(); // At count: 1

    const history = travels.getHistory();

    // ✅ History reconstructed correctly
    expect(history).toEqual([{ count: 0 }, { count: 1 }, { count: 2 }]);

    // Note: History entries are new objects (reconstructed from patches)
    // Only this.state maintains the same reference
  });
});

describe('Mutable mode: Real-world scenarios', () => {
  test('Simulated MobX observable', () => {
    // Simulate MobX observable (simplified)
    const createObservable = <T extends object>(obj: T) => {
      const listeners = new Set<() => void>();
      return new Proxy(obj, {
        set(target, prop, value) {
          (target as any)[prop] = value;
          listeners.forEach((fn) => fn());
          return true;
        },
      });
    };

    const state = createObservable({ count: 0 });
    const travels = createTravels(state, { mutable: true });
    const originalRef = travels.getState();

    let notificationCount = 0;
    travels.subscribe(() => {
      notificationCount++;
    });

    // Update via travels
    travels.setState({ count: 5 });

    // ✅ Reference preserved (important for MobX)
    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState().count).toBe(5);
    expect(notificationCount).toBe(1);
  });

  test('Simulated Vue reactive (array operations)', () => {
    const state = {
      todos: [] as Array<{ id: number; text: string }>,
    };

    const travels = createTravels(state, { mutable: true });
    const originalRef = travels.getState();

    // Add items
    travels.setState((draft) => {
      draft.todos.push({ id: 1, text: 'Todo 1' });
      draft.todos.push({ id: 2, text: 'Todo 2' });
    });

    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState().todos.length).toBe(2);

    // Remove item
    travels.setState((draft) => {
      draft.todos.splice(0, 1);
    });

    expect(travels.getState().todos.length).toBe(1);
    expect(travels.getState().todos[0].text).toBe('Todo 2');

    // Undo
    travels.back();
    expect(travels.getState().todos.length).toBe(2);

    // Undo again
    travels.back();
    expect(travels.getState().todos.length).toBe(0);
  });

  test('Simulated Pinia store state', () => {
    const state = {
      user: { name: '', email: '' },
      isLoggedIn: false,
      cart: [] as Array<{ id: number; quantity: number }>,
    };

    const travels = createTravels(state, { mutable: true });
    const originalRef = travels.getState();

    // Login action
    travels.setState((draft) => {
      draft.user = { name: 'Alice', email: 'alice@example.com' };
      draft.isLoggedIn = true;
    });

    // Add to cart action
    travels.setState((draft) => {
      draft.cart.push({ id: 101, quantity: 2 });
      draft.cart.push({ id: 102, quantity: 1 });
    });

    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState().isLoggedIn).toBe(true);
    expect(travels.getState().cart.length).toBe(2);

    // Undo cart addition
    travels.back();
    expect(travels.getState().cart.length).toBe(0);

    // Undo login
    travels.back();
    expect(travels.getState().isLoggedIn).toBe(false);
    expect(travels.getState().user.name).toBe('');
  });

  test('Performance: mutable vs immutable mode', () => {
    const createLargeState = () => ({
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
      })),
    });

    // Immutable mode
    const immutableState = createLargeState();
    const immutableTravels = createTravels(immutableState, { mutable: false });

    const immutableStart = performance.now();
    for (let i = 0; i < 100; i++) {
      immutableTravels.setState((draft) => {
        draft.items[0].value = `updated-${i}`;
      });
    }
    const immutableTime = performance.now() - immutableStart;

    // Mutable mode
    const mutableState = createLargeState();
    const mutableTravels = createTravels(mutableState, { mutable: true });

    const mutableStart = performance.now();
    for (let i = 0; i < 100; i++) {
      mutableTravels.setState((draft) => {
        draft.items[0].value = `updated-${i}`;
      });
    }
    const mutableTime = performance.now() - mutableStart;

    console.log(`Immutable mode: ${immutableTime.toFixed(2)}ms`);
    console.log(`Mutable mode: ${mutableTime.toFixed(2)}ms`);

    // Note: Actual performance depends on the JavaScript engine
    // Both modes should be performant, but mutable may have slight edge
    // for large state objects with observable frameworks
  });
});
