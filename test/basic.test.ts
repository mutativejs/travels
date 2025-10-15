import { expect, describe, test, beforeEach } from 'vitest';
import { createTravels, Travels } from '../src/index';

/**
 * Test suite for basic.ts example
 * This tests the basic usage demonstrated in examples/basic.ts
 */
describe('Basic Example - Basic Usage', () => {
  interface AppState {
    count: number;
    text: string;
  }

  let travels: Travels<AppState>;

  beforeEach(() => {
    travels = createTravels<AppState>({
      count: 0,
      text: 'Hello',
    });
  });

  test('should initialize with default state', () => {
    expect(travels.getState()).toEqual({
      count: 0,
      text: 'Hello',
    });
    expect(travels.getPosition()).toBe(0);
  });

  test('should update state using mutation', () => {
    travels.setState((draft) => {
      draft.count = 1;
    });

    expect(travels.getState()).toEqual({
      count: 1,
      text: 'Hello',
    });
    expect(travels.getPosition()).toBe(1);
  });

  test('should track multiple state changes', () => {
    travels.setState((draft) => {
      draft.count = 1;
    });

    travels.setState((draft) => {
      draft.text = 'World';
    });

    travels.setState((draft) => {
      draft.count = 2;
      draft.text = 'Travels!';
    });

    expect(travels.getState()).toEqual({
      count: 2,
      text: 'Travels!',
    });
    expect(travels.getPosition()).toBe(3);
  });

  test('should undo operations correctly', () => {
    travels.setState((draft) => {
      draft.count = 1;
    });

    travels.setState((draft) => {
      draft.text = 'World';
    });

    travels.setState((draft) => {
      draft.count = 2;
      draft.text = 'Travels!';
    });

    // Undo 2 steps
    travels.back(2);
    expect(travels.getState()).toEqual({
      count: 1,
      text: 'Hello',
    });
  });

  test('should redo operations correctly', () => {
    travels.setState((draft) => {
      draft.count = 1;
    });

    travels.setState((draft) => {
      draft.text = 'World';
    });

    travels.back(2);

    // Redo 1 step
    travels.forward();
    expect(travels.getState()).toEqual({
      count: 1,
      text: 'Hello',
    });
  });

  test('should maintain full history', () => {
    travels.setState((draft) => {
      draft.count = 1;
    });

    travels.setState((draft) => {
      draft.text = 'World';
    });

    const history = travels.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0]).toEqual({ count: 0, text: 'Hello' });
    expect(history[1]).toEqual({ count: 1, text: 'Hello' });
    expect(history[2]).toEqual({ count: 1, text: 'World' });
  });

  test('should navigate to specific position', () => {
    travels.setState((draft) => {
      draft.count = 1;
    });

    travels.setState((draft) => {
      draft.text = 'World';
    });

    travels.setState((draft) => {
      draft.count = 2;
    });

    travels.go(0);
    expect(travels.getState()).toEqual({
      count: 0,
      text: 'Hello',
    });
    expect(travels.getPosition()).toBe(0);
  });

  test('should reset to initial state', () => {
    travels.setState((draft) => {
      draft.count = 1;
    });

    travels.setState((draft) => {
      draft.text = 'World';
    });

    travels.reset();
    expect(travels.getState()).toEqual({
      count: 0,
      text: 'Hello',
    });
    expect(travels.getPosition()).toBe(0);
  });

  test('should notify subscribers on state changes', () => {
    const states: AppState[] = [];
    const positions: number[] = [];

    const unsubscribe = travels.subscribe((state, patches, position) => {
      states.push(state);
      positions.push(position);
    });

    travels.setState((draft) => {
      draft.count = 1;
    });

    travels.setState((draft) => {
      draft.text = 'World';
    });

    expect(states).toHaveLength(2);
    expect(states[0]).toEqual({ count: 1, text: 'Hello' });
    expect(states[1]).toEqual({ count: 1, text: 'World' });
    expect(positions).toEqual([1, 2]);

    unsubscribe();

    travels.setState((draft) => {
      draft.count = 2;
    });

    // Should not receive updates after unsubscribe
    expect(states).toHaveLength(2);
  });

  test('supports destructured subscribe and getState bindings', () => {
    const capturedStates: AppState[] = [];
    const capturedPositions: number[] = [];

    const { subscribe, getState } = travels;

    // check function auto bind travel
    const unsubscribe = subscribe.call({} ,(state, _patches, position) => {
      capturedStates.push(state);
      capturedPositions.push(position);
    });

    travels.setState((draft) => {
      draft.count = 1;
    });

    expect(capturedStates).toHaveLength(1);
    expect(capturedStates[0]).toEqual({ count: 1, text: 'Hello' });
    expect(capturedPositions).toEqual([1]);
    // check function auto bind travel
    expect(getState.call({}, )).toEqual({ count: 1, text: 'Hello' });

    unsubscribe();

    travels.setState((draft) => {
      draft.count = 2;
    });

    expect(capturedStates).toHaveLength(1);
    expect(capturedPositions).toEqual([1]);
    expect(getState()).toEqual({ count: 2, text: 'Hello' });
  });

  test('should check canBack and canForward correctly', () => {
    expect(travels.canBack()).toBe(false);
    expect(travels.canForward()).toBe(false);

    travels.setState((draft) => {
      draft.count = 1;
    });

    expect(travels.canBack()).toBe(true);
    expect(travels.canForward()).toBe(false);

    travels.back();

    expect(travels.canBack()).toBe(false);
    expect(travels.canForward()).toBe(true);
  });
});
