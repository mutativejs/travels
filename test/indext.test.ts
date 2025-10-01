import { expect, describe, test, beforeEach, vi } from 'vitest';
import { createTravels, Travels } from '../src/index';

describe('Travels - Auto Archive Mode', () => {
  test('should create travels instance with initial state', () => {
    const travels = createTravels({ count: 0 });
    expect(travels.getState()).toEqual({ count: 0 });
    expect(travels.getPosition()).toBe(0);
  });

  test('should update state with direct value', () => {
    const travels = createTravels({ count: 0 });
    travels.setState({ count: 1 });
    expect(travels.getState()).toEqual({ count: 1 });
    expect(travels.getPosition()).toBe(1);
  });

  test('should update state with draft mutation', () => {
    const travels = createTravels({ count: 0 });
    travels.setState((draft) => {
      draft.count += 5;
    });
    expect(travels.getState()).toEqual({ count: 5 });
  });

  test('should support undo (back)', () => {
    const travels = createTravels({ count: 0 });
    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    expect(travels.getState()).toEqual({ count: 2 });

    travels.back();
    expect(travels.getState()).toEqual({ count: 1 });
    expect(travels.getPosition()).toBe(1);
  });

  test('should support redo (forward)', () => {
    const travels = createTravels({ count: 0 });
    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.back();

    expect(travels.getState()).toEqual({ count: 1 });

    travels.forward();
    expect(travels.getState()).toEqual({ count: 2 });
    expect(travels.getPosition()).toBe(2);
  });

  test('should support back with amount', () => {
    const travels = createTravels({ count: 0 });
    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.setState({ count: 3 });

    travels.back(2);
    expect(travels.getState()).toEqual({ count: 1 });
    expect(travels.getPosition()).toBe(1);
  });

  test('should support forward with amount', () => {
    const travels = createTravels({ count: 0 });
    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.setState({ count: 3 });
    travels.back(3);

    travels.forward(2);
    expect(travels.getState()).toEqual({ count: 2 });
    expect(travels.getPosition()).toBe(2);
  });

  test('should support go to specific position', () => {
    const travels = createTravels({ count: 0 });
    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.setState({ count: 3 });

    travels.go(1);
    expect(travels.getState()).toEqual({ count: 1 });
    expect(travels.getPosition()).toBe(1);
  });

  test('should support reset', () => {
    const travels = createTravels({ count: 0 });
    travels.setState({ count: 1 });
    travels.setState({ count: 2 });

    travels.reset();
    expect(travels.getState()).toEqual({ count: 0 });
    expect(travels.getPosition()).toBe(0);
    expect(travels.getPatches().patches).toEqual([]);
  });

  test('should check canBack and canForward', () => {
    const travels = createTravels({ count: 0 });
    expect(travels.canBack()).toBe(false);
    expect(travels.canForward()).toBe(false);

    travels.setState({ count: 1 });
    expect(travels.canBack()).toBe(true);
    expect(travels.canForward()).toBe(false);

    travels.back();
    expect(travels.canBack()).toBe(false);
    expect(travels.canForward()).toBe(true);
  });

  test('should respect maxHistory limit', () => {
    const travels = createTravels({ count: 0 }, { maxHistory: 3 });

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.setState({ count: 3 });
    travels.setState({ count: 4 });

    expect(travels.getPatches().patches.length).toBe(3);
    expect(travels.getPosition()).toBe(3);
  });

  test('should get history', () => {
    const travels = createTravels({ count: 0 });
    travels.setState({ count: 1 });
    travels.setState({ count: 2 });

    const history = travels.getHistory();
    expect(history).toEqual([{ count: 0 }, { count: 1 }, { count: 2 }]);
  });

  test('should clear future history on new action', () => {
    const travels = createTravels({ count: 0 });
    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.back();

    expect(travels.getState()).toEqual({ count: 1 });

    travels.setState({ count: 3 });
    expect(travels.canForward()).toBe(false);

    const history = travels.getHistory();
    expect(history).toEqual([{ count: 0 }, { count: 1 }, { count: 3 }]);
  });

  test('should subscribe to state changes', () => {
    const travels = createTravels({ count: 0 });
    const states: any[] = [];
    const positions: number[] = [];

    const unsubscribe = travels.subscribe((state, patches, position) => {
      states.push(state);
      positions.push(position);
    });

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.back();

    expect(states).toEqual([{ count: 1 }, { count: 2 }, { count: 1 }]);
    expect(positions).toEqual([1, 2, 1]);

    unsubscribe();

    travels.setState({ count: 3 });
    expect(states.length).toBe(3); // No new state after unsubscribe
  });

  test('should support initial patches and position', () => {
    const travels1 = createTravels({ count: 0 });
    travels1.setState({ count: 1 });
    travels1.setState({ count: 2 });

    const patches = travels1.getPatches();
    const position = travels1.getPosition();
    const state = travels1.getState();

    // Create new instance with persisted data
    const travels2 = createTravels(state, {
      initialPatches: patches,
      initialPosition: position,
    });

    expect(travels2.getState()).toEqual({ count: 2 });
    expect(travels2.getPosition()).toBe(2);

    travels2.back();
    expect(travels2.getState()).toEqual({ count: 1 });
  });

  test('should work with complex nested objects', () => {
    interface State {
      user: { name: string; age: number };
      todos: Array<{ id: number; text: string; done: boolean }>;
    }

    const travels = createTravels<State>({
      user: { name: 'Alice', age: 25 },
      todos: [],
    });

    travels.setState((draft) => {
      draft.todos.push({ id: 1, text: 'Buy milk', done: false });
    });

    travels.setState((draft) => {
      draft.todos[0].done = true;
      draft.user.age = 26;
    });

    expect(travels.getState().todos[0].done).toBe(true);
    expect(travels.getState().user.age).toBe(26);

    travels.back();
    expect(travels.getState().todos[0].done).toBe(false);
    expect(travels.getState().user.age).toBe(25);
  });

  test('should get controls object', () => {
    const travels = createTravels({ count: 0 });
    const controls = travels.getControls();

    expect(typeof controls.back).toBe('function');
    expect(typeof controls.forward).toBe('function');
    expect(typeof controls.go).toBe('function');
    expect(typeof controls.reset).toBe('function');
    expect(typeof controls.canBack).toBe('function');
    expect(typeof controls.canForward).toBe('function');
    expect(typeof controls.getHistory).toBe('function');
    expect(controls.position).toBe(0);
  });
});

describe('Travels - Manual Archive Mode', () => {
  test('should not archive automatically', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });

    expect(travels.getState()).toEqual({ count: 2 });
    expect(travels.canArchive()).toBe(true);
    expect(travels.getPosition()).toBe(1);
  });

  test('should archive manually', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.archive();

    expect(travels.canArchive()).toBe(false);
    expect(travels.getPatches().patches.length).toBe(1);
  });

  test('should batch multiple changes into one history entry', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.setState({ count: 3 });
    travels.archive();

    travels.back();
    expect(travels.getState()).toEqual({ count: 0 });
    expect(travels.getPosition()).toBe(0);
  });

  test('should support multiple archive cycles', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });

    // First cycle
    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.archive();

    // Second cycle
    travels.setState({ count: 3 });
    travels.setState({ count: 4 });
    travels.archive();

    expect(travels.getPatches().patches.length).toBe(2);

    travels.back();
    expect(travels.getState()).toEqual({ count: 2 });

    travels.back();
    expect(travels.getState()).toEqual({ count: 0 });
  });

  test('should auto-archive before navigation if needed', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });

    // Should auto-archive before going back
    travels.back();

    expect(travels.canArchive()).toBe(false);
    expect(travels.getState()).toEqual({ count: 0 });
  });

  test('manual archive mode controls should have archive method', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });
    const controls = travels.getControls() as any;

    expect(typeof controls.archive).toBe('function');
    expect(typeof controls.canArchive).toBe('function');
  });

  test('should clear future history on new action after archive', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });

    travels.setState({ count: 1 });
    travels.archive();

    travels.setState({ count: 2 });
    travels.archive();

    travels.back();
    expect(travels.getState()).toEqual({ count: 1 });

    travels.setState({ count: 3 });
    travels.archive();

    expect(travels.canForward()).toBe(false);
    expect(travels.getPatches().patches.length).toBe(2);
  });
});

describe('Travels - Edge Cases', () => {
  test('should handle empty history navigation', () => {
    const travels = createTravels({ count: 0 });

    travels.back();
    expect(travels.getState()).toEqual({ count: 0 });
    expect(travels.getPosition()).toBe(0);

    travels.forward();
    expect(travels.getState()).toEqual({ count: 0 });
    expect(travels.getPosition()).toBe(0);
  });

  test('should handle go beyond boundaries', () => {
    const travels = createTravels({ count: 0 });
    travels.setState({ count: 1 });

    travels.go(100);
    expect(travels.getPosition()).toBe(1);

    travels.go(-100);
    expect(travels.getPosition()).toBe(0);
  });

  test('should handle setState with function returning value', () => {
    const travels = createTravels({ count: 0 });
    travels.setState(() => ({ count: 5 }));
    expect(travels.getState()).toEqual({ count: 5 });
  });

  test('should support multiple subscribers', () => {
    const travels = createTravels({ count: 0 });

    const calls1: any[] = [];
    const calls2: any[] = [];

    const unsub1 = travels.subscribe((state) => calls1.push(state));
    const unsub2 = travels.subscribe((state) => calls2.push(state));

    travels.setState({ count: 1 });

    expect(calls1).toEqual([{ count: 1 }]);
    expect(calls2).toEqual([{ count: 1 }]);

    unsub1();
    travels.setState({ count: 2 });

    expect(calls1).toEqual([{ count: 1 }]);
    expect(calls2).toEqual([{ count: 1 }, { count: 2 }]);

    unsub2();
  });

  test('should not call archive in auto mode', () => {
    const travels = createTravels({ count: 0 });
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    travels.archive();

    expect(consoleSpy).toHaveBeenCalledWith('Auto archive is enabled, no need to archive manually');
    consoleSpy.mockRestore();
  });
});
