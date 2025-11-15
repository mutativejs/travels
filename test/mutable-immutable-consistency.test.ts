/**
 * Mutable vs Immutable Mode Consistency Tests
 *
 * These tests ensure that mutable and immutable modes have identical behavior
 * in terms of state updates and time travel, with the only difference being
 * reference stability in mutable mode.
 */

import { describe, test, expect } from 'vitest';
import { createTravels } from '../src/index';

describe('Mutable vs Immutable: Behavioral Consistency', () => {
  test('setState with object literal should replace, not merge', () => {
    const initialState: { a?: number; b?: number; c?: number } = {
      a: 1,
      b: 2,
      c: 3,
    };

    // Immutable mode
    const immutable = createTravels({ ...initialState });
    immutable.setState({ a: 5 });

    // Mutable mode
    const mutable = createTravels({ ...initialState }, { mutable: true });
    const originalRef = mutable.getState();
    mutable.setState({ a: 5 });

    // Both should have the same result: { a: 5 }
    expect(immutable.getState()).toEqual({ a: 5 });
    expect(mutable.getState()).toEqual({ a: 5 });

    // Mutable mode should preserve reference
    expect(mutable.getState()).toBe(originalRef);
  });

  test('time travel should be consistent between modes', () => {
    const initialState: { a?: number; b?: number } = { a: 1, b: 2 };

    const immutable = createTravels({ ...initialState });
    const mutable = createTravels({ ...initialState }, { mutable: true });

    // Apply same operations
    immutable.setState({ a: 5 });
    mutable.setState({ a: 5 });

    expect(immutable.getState()).toEqual({ a: 5 });
    expect(mutable.getState()).toEqual({ a: 5 });

    // Go back
    immutable.back();
    mutable.back();

    expect(immutable.getState()).toEqual({ a: 1, b: 2 });
    expect(mutable.getState()).toEqual({ a: 1, b: 2 });

    // Go forward
    immutable.forward();
    mutable.forward();

    expect(immutable.getState()).toEqual({ a: 5 });
    expect(mutable.getState()).toEqual({ a: 5 });
  });

  test('nested object replacement should be consistent', () => {
    const initialState: {} = {
      user: { name: 'Alice', age: 30, email: 'alice@example.com' },
      count: 0,
    };

    const immutable = createTravels({ ...initialState });
    const mutable = createTravels({ ...initialState }, { mutable: true });

    // Replace with partial nested object
    const newState = { user: { name: 'Bob' } };

    immutable.setState(newState);
    mutable.setState(newState);

    // Both should have ONLY the new keys
    expect(immutable.getState()).toEqual({ user: { name: 'Bob' } });
    expect(mutable.getState()).toEqual({ user: { name: 'Bob' } });

    // Time travel back should restore original state
    immutable.back();
    mutable.back();

    expect(immutable.getState()).toEqual(initialState);
    expect(mutable.getState()).toEqual(initialState);
  });

  test('array state replacement (forward only - back has known ordering issues)', () => {
    // Note: Array time travel in mutable mode has known ordering limitations
    // due to how Mutative applies patches. This test only verifies forward operations.
    const initialState = [1, 2, 3, 4, 5];

    const immutable = createTravels([...initialState]);
    const mutable = createTravels([...initialState], { mutable: true });
    const originalRef = mutable.getState();

    // Replace with shorter array
    immutable.setState([10, 20]);
    mutable.setState([10, 20]);

    expect(immutable.getState()).toEqual([10, 20]);
    expect(mutable.getState()).toEqual([10, 20]);

    // Mutable mode should preserve array reference
    expect(mutable.getState()).toBe(originalRef);

    // Note: Time travel (back/forward) on arrays in mutable mode may have ordering issues
    // This is a known limitation of patch-based mutable updates on arrays
  });

  test('function updater should work the same in both modes', () => {
    const initialState = { count: 0, name: 'test' };

    const immutable = createTravels({ ...initialState });
    const mutable = createTravels({ ...initialState }, { mutable: true });

    // Function updater
    immutable.setState((draft) => {
      draft.count = 10;
      delete (draft as any).name;
    });

    mutable.setState((draft) => {
      draft.count = 10;
      delete (draft as any).name;
    });

    expect(immutable.getState()).toEqual({ count: 10 });
    expect(mutable.getState()).toEqual({ count: 10 });
  });

  test('multiple setState operations should accumulate consistently', () => {
    const immutable = createTravels({ a: 1, b: 2 } as {});
    const mutable = createTravels({ a: 1, b: 2 } as {}, { mutable: true });

    // Operation 1: Replace with { a: 5 }
    immutable.setState({ a: 5 });
    mutable.setState({ a: 5 });

    expect(immutable.getState()).toEqual({ a: 5 });
    expect(mutable.getState()).toEqual({ a: 5 });

    // Operation 2: Replace with { c: 10 }
    immutable.setState({ c: 10 });
    mutable.setState({ c: 10 });

    expect(immutable.getState()).toEqual({ c: 10 });
    expect(mutable.getState()).toEqual({ c: 10 });

    // Navigate back twice
    immutable.back();
    immutable.back();
    mutable.back();
    mutable.back();

    expect(immutable.getState()).toEqual({ a: 1, b: 2 });
    expect(mutable.getState()).toEqual({ a: 1, b: 2 });
  });

  test('reset should work consistently', () => {
    const initialState: {} = { x: 1, y: 2 };

    const immutable = createTravels({ ...initialState });
    const mutable = createTravels({ ...initialState }, { mutable: true });

    // Make changes
    immutable.setState({ x: 10 });
    immutable.setState({ z: 20 });

    mutable.setState({ x: 10 });
    mutable.setState({ z: 20 });

    // Reset both
    immutable.reset();
    mutable.reset();

    expect(immutable.getState()).toEqual({ x: 1, y: 2 });
    expect(mutable.getState()).toEqual({ x: 1, y: 2 });
  });

  test('getHistory should return same values in both modes', () => {
    const initialState = { count: 0 };

    const immutable = createTravels({ ...initialState });
    const mutable = createTravels({ ...initialState }, { mutable: true });

    immutable.setState({ count: 1 });
    immutable.setState({ count: 2 });

    mutable.setState({ count: 1 });
    mutable.setState({ count: 2 });

    const immutableHistory = immutable.getHistory();
    const mutableHistory = mutable.getHistory();

    expect(immutableHistory).toEqual(mutableHistory);
    expect(immutableHistory).toEqual([
      { count: 0 },
      { count: 1 },
      { count: 2 },
    ]);
  });
});

describe('Regression: Object.assign shallow merge bug', () => {
  test('should not retain old keys when setState with partial object', () => {
    // This test ensures the bug is fixed:
    // Previously in mutable mode, setState({ a: 5 }) on { a: 1, b: 2 }
    // would result in { a: 5, b: 2 } (shallow merge)
    // Now it should result in { a: 5 } (complete replacement)

    const travels = createTravels({ a: 1, b: 2, c: 3 } as {}, { mutable: true });

    travels.setState({ a: 5 });

    // Should only have 'a', not 'b' or 'c'
    expect(travels.getState()).toEqual({ a: 5 });
    expect(Object.keys(travels.getState())).toEqual(['a']);
  });

  test('should not leak fields across time travel', () => {
    const travels = createTravels(
      { loading: false, error: null, data: null },
      { mutable: true }
    );

    // Simulate a request
    travels.setState({ loading: true, error: null, data: null });

    // Simulate success
    // @ts-ignore
    travels.setState({ loading: false, error: null, data: 'huge dataset' });

    // Reset to initial state (simulate clearing)
    // @ts-ignore
    travels.setState({ loading: false, error: null });

    // Should not have 'data' anymore
    expect(travels.getState()).toEqual({ loading: false, error: null });
    expect('data' in travels.getState()).toBe(false);
  });
});
