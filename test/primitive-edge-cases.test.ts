/**
 * Edge cases for primitive types with mutable mode
 */

import { describe, test, expect } from 'vitest';
import { createTravels } from '../src/index';

describe('Primitive types edge cases with mutable mode', () => {
  test('getHistory() with primitive types', () => {
    const travels = createTravels<number>(0, { mutable: true });

    travels.setState(() => 1);
    travels.setState(() => 2);
    travels.setState(() => 3);

    const history = travels.getHistory();
    expect(history).toEqual([0, 1, 2, 3]);
  });

  test('go() back and forward with primitive types', () => {
    const travels = createTravels<number>(10, { mutable: true });

    travels.setState(() => 20);
    travels.setState(() => 30);
    travels.setState(() => 40);

    // Go back to beginning
    travels.go(0);
    expect(travels.getState()).toBe(10);

    // Go to middle
    travels.go(2);
    expect(travels.getState()).toBe(30);

    // Go to end
    travels.go(3);
    expect(travels.getState()).toBe(40);
  });

  test('string primitive with mutable mode', () => {
    const travels = createTravels<string>('hello', { mutable: true });

    travels.setState(() => 'world');
    expect(travels.getState()).toBe('world');

    travels.back();
    expect(travels.getState()).toBe('hello');

    travels.forward();
    expect(travels.getState()).toBe('world');

    const history = travels.getHistory();
    expect(history).toEqual(['hello', 'world']);
  });

  test('boolean primitive with mutable mode', () => {
    const travels = createTravels<boolean>(false, { mutable: true });

    travels.setState(() => true);
    expect(travels.getState()).toBe(true);

    travels.back();
    expect(travels.getState()).toBe(false);

    const history = travels.getHistory();
    expect(history).toEqual([false, true]);
  });

  test('null value with mutable mode', () => {
    const travels = createTravels<number | null>(null, { mutable: true });

    travels.setState(() => 42);
    expect(travels.getState()).toBe(42);

    travels.back();
    expect(travels.getState()).toBe(null);

    travels.forward();
    expect(travels.getState()).toBe(42);
  });

  test('manual archive mode with primitive types', () => {
    const travels = createTravels<number>(0, {
      mutable: true,
      autoArchive: false,
    });

    travels.setState(() => 1);
    travels.setState(() => 2);

    expect(travels.canArchive()).toBe(true);
    travels.archive();
    expect(travels.canArchive()).toBe(false);

    travels.back();
    expect(travels.getState()).toBe(0);
  });

  test('maxHistory with primitive types', () => {
    const travels = createTravels<number>(0, {
      mutable: true,
      maxHistory: 3,
    });

    // Add 5 states
    travels.setState(() => 1);
    travels.setState(() => 2);
    travels.setState(() => 3);
    travels.setState(() => 4);
    travels.setState(() => 5);

    // Should only keep last 3
    expect(travels.getPosition()).toBe(3);

    travels.go(0);
    expect(travels.getState()).toBe(2); // Window is [2, 3, 4, 5]

    const history = travels.getHistory();
    expect(history).toEqual([2, 3, 4, 5]);
  });

  test('reset with primitive types', () => {
    const travels = createTravels<number>(100, { mutable: true });

    travels.setState(() => 200);
    travels.setState(() => 300);

    travels.reset();
    expect(travels.getState()).toBe(100);
    expect(travels.getPosition()).toBe(0);
  });

  test('transition from primitive to object throws no errors', () => {
    const travels = createTravels<number | { count: number }>(0, {
      mutable: true,
    });

    travels.setState(() => 1);
    travels.setState(() => 2);

    // Transition to object - this should work but use immutable mode
    travels.setState(() => ({ count: 3 }));
    expect(travels.getState()).toEqual({ count: 3 });

    travels.back();
    expect(travels.getState()).toBe(2);
  });

  test('patches are correctly tracked for primitives', () => {
    const travels = createTravels<number>(0, { mutable: true });

    travels.setState(() => 1);
    travels.setState(() => 2);

    const patches = travels.getPatches();
    expect(patches.patches.length).toBe(2);
    expect(patches.inversePatches.length).toBe(2);
  });

  test('subscribe receives correct primitive values', () => {
    const travels = createTravels<number>(0, { mutable: true });
    const values: number[] = [];

    travels.subscribe((state) => {
      values.push(state);
    });

    travels.setState(() => 10);
    travels.setState(() => 20);
    travels.back();

    expect(values).toEqual([10, 20, 10]);
  });

  test('controls work correctly with primitives', () => {
    const travels = createTravels<string>('start', { mutable: true });
    const controls = travels.getControls();

    travels.setState(() => 'middle');
    travels.setState(() => 'end');

    expect(controls.position).toBe(2);
    expect(controls.canBack()).toBe(true);
    expect(controls.canForward()).toBe(false);

    controls.back();
    expect(travels.getState()).toBe('middle');

    controls.forward();
    expect(travels.getState()).toBe('end');

    // Before reset, check history
    const historyBeforeReset = controls.getHistory();
    expect(historyBeforeReset).toEqual(['start', 'middle', 'end']);

    controls.reset();
    expect(travels.getState()).toBe('start');

    // After reset, history is cleared
    const historyAfterReset = controls.getHistory();
    expect(historyAfterReset).toEqual(['start']);
  });
});
