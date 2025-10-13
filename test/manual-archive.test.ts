import { expect, describe, test, beforeEach } from 'vitest';
import { createTravels, Travels } from '../src/index';

/**
 * Test suite for manual-archive.ts example
 * This tests the manual archive mode demonstrated in examples/manual-archive.ts
 */
describe('Manual Archive Example - Batch Operations', () => {
  interface TodoState {
    todos: Array<{
      id: number;
      text: string;
      completed: boolean;
    }>;
  }

  let travels: Travels<TodoState, false, false>;

  beforeEach(() => {
    travels = createTravels<TodoState, false>(
      { todos: [] },
      { autoArchive: false, maxHistory: 20 }
    );
  });

  test('should batch multiple operations without archiving', () => {
    travels.setState((draft) => {
      draft.todos.push({ id: 1, text: 'Buy milk', completed: false });
    });

    travels.setState((draft) => {
      draft.todos.push({ id: 2, text: 'Walk dog', completed: false });
    });

    travels.setState((draft) => {
      draft.todos.push({ id: 3, text: 'Write code', completed: false });
    });

    expect(travels.getState().todos).toHaveLength(3);
    expect(travels.canArchive()).toBe(true);
  });

  test('should archive all changes as a single history entry', () => {
    travels.setState((draft) => {
      draft.todos.push({ id: 1, text: 'Buy milk', completed: false });
    });

    travels.setState((draft) => {
      draft.todos.push({ id: 2, text: 'Walk dog', completed: false });
    });

    travels.setState((draft) => {
      draft.todos.push({ id: 3, text: 'Write code', completed: false });
    });

    travels.archive();

    expect(travels.canArchive()).toBe(false);
    expect(travels.getPatches().patches).toHaveLength(1);
  });

  test('should undo to empty state after batched operations', () => {
    travels.setState((draft) => {
      draft.todos.push({ id: 1, text: 'Buy milk', completed: false });
    });

    travels.setState((draft) => {
      draft.todos.push({ id: 2, text: 'Walk dog', completed: false });
    });

    travels.setState((draft) => {
      draft.todos.push({ id: 3, text: 'Write code', completed: false });
    });

    travels.archive();
    travels.back();

    expect(travels.getState().todos).toHaveLength(0);
  });

  test('should redo to restore all batched todos', () => {
    travels.setState((draft) => {
      draft.todos.push({ id: 1, text: 'Buy milk', completed: false });
    });

    travels.setState((draft) => {
      draft.todos.push({ id: 2, text: 'Walk dog', completed: false });
    });

    travels.archive();
    travels.back();
    travels.forward();

    expect(travels.getState().todos).toHaveLength(2);
  });

  test('should support multiple archive cycles', () => {
    // First cycle
    travels.setState((draft) => {
      draft.todos.push({ id: 1, text: 'Task 1', completed: false });
    });
    travels.setState((draft) => {
      draft.todos.push({ id: 2, text: 'Task 2', completed: false });
    });
    travels.archive();

    // Second cycle
    travels.setState((draft) => {
      draft.todos[0].completed = true;
    });
    travels.setState((draft) => {
      draft.todos[1].completed = true;
    });
    travels.archive();

    // Third cycle
    travels.setState((draft) => {
      draft.todos.splice(1, 1);
    });
    travels.archive();

    expect(travels.getPatches().patches).toHaveLength(3);
  });

  test('should undo step by step through archive cycles', () => {
    // First cycle: Add todos
    travels.setState((draft) => {
      draft.todos.push({ id: 1, text: 'Task 1', completed: false });
      draft.todos.push({ id: 2, text: 'Task 2', completed: false });
    });
    travels.archive();

    // Second cycle: Complete todos
    travels.setState((draft) => {
      draft.todos[0].completed = true;
      draft.todos[1].completed = true;
    });
    travels.archive();

    // Third cycle: Delete one todo
    travels.setState((draft) => {
      draft.todos.splice(1, 1);
    });
    travels.archive();

    // Undo step by step
    travels.back();
    expect(travels.getState().todos).toHaveLength(2);

    travels.back();
    expect(travels.getState().todos[0].completed).toBe(false);

    travels.back();
    expect(travels.getState().todos).toHaveLength(0);
  });

  test('should auto-archive on navigation with pending changes', () => {
    travels.setState((draft) => {
      draft.todos.push({ id: 1, text: 'Task 1', completed: false });
    });
    travels.archive();

    travels.setState((draft) => {
      draft.todos.push({ id: 2, text: 'Task 2', completed: false });
    });

    expect(travels.canArchive()).toBe(true);

    // Navigation should auto-archive pending changes
    travels.back();

    expect(travels.canArchive()).toBe(false);
    expect(travels.getState().todos).toHaveLength(1);
  });

  test('should clear future history on new action after undo', () => {
    travels.setState((draft) => {
      draft.todos.push({ id: 1, text: 'Task 1', completed: false });
    });
    travels.archive();

    travels.setState((draft) => {
      draft.todos.push({ id: 2, text: 'Task 2', completed: false });
    });
    travels.archive();

    travels.back();

    travels.setState((draft) => {
      draft.todos.push({ id: 3, text: 'Task 3', completed: false });
    });
    travels.archive();

    expect(travels.canForward()).toBe(false);
    expect(travels.getPatches().patches).toHaveLength(2);
  });

  test('should handle complex todo operations', () => {
    // Add multiple todos
    travels.setState((draft) => {
      draft.todos.push({ id: 1, text: 'Buy milk', completed: false });
    });
    travels.setState((draft) => {
      draft.todos.push({ id: 2, text: 'Walk dog', completed: false });
    });
    travels.setState((draft) => {
      draft.todos.push({ id: 3, text: 'Write code', completed: false });
    });
    travels.archive();

    // Add another todo
    travels.setState((draft) => {
      draft.todos.push({ id: 4, text: 'Read book', completed: false });
    });
    travels.archive();

    // Mark multiple as completed
    travels.setState((draft) => {
      draft.todos[0].completed = true;
    });
    travels.setState((draft) => {
      draft.todos[1].completed = true;
    });
    travels.archive();

    // Delete a todo
    travels.setState((draft) => {
      draft.todos.splice(2, 1);
    });
    travels.archive();

    expect(travels.getPatches().patches).toHaveLength(4);

    const history = travels.getHistory();
    expect(history[0].todos).toHaveLength(0);
    expect(history[1].todos).toHaveLength(3);
    expect(history[2].todos).toHaveLength(4);
    expect(history[3].todos[0].completed).toBe(true);
    expect(history[4].todos).toHaveLength(3);
  });
});

describe('Manual archive with maxHistory parity with useTravel', () => {
  const createParityTravels = () =>
    createTravels(0, { maxHistory: 3, autoArchive: false });

  test('should mirror useTravel maxHistory scenario', () => {
    const travels = createParityTravels();

    const assertSnapshot = (
      expectedState: number,
      expectedPosition: number,
      expectedHistory: number[],
      extras: {
        canBack?: boolean;
        canForward?: boolean;
        canArchive?: boolean;
      } = {}
    ) => {
      expect(travels.getState()).toBe(expectedState);
      expect(travels.getPosition()).toBe(expectedPosition);
      expect(travels.getHistory()).toEqual(expectedHistory);

      if (extras.canBack !== undefined) {
        expect(travels.canBack()).toBe(extras.canBack);
      }

      if (extras.canForward !== undefined) {
        expect(travels.canForward()).toBe(extras.canForward);
      }

      if (extras.canArchive !== undefined) {
        expect(travels.canArchive()).toBe(extras.canArchive);
      }
    };

    assertSnapshot(0, 0, [0]);

    travels.setState(() => 1);
    assertSnapshot(1, 1, [0, 1]);

    travels.archive();
    assertSnapshot(1, 1, [0, 1], { canBack: true, canForward: false });

    travels.setState(2);
    assertSnapshot(2, 2, [0, 1, 2]);

    travels.archive();
    assertSnapshot(2, 2, [0, 1, 2], { canBack: true, canForward: false });

    travels.setState(3);
    assertSnapshot(3, 3, [0, 1, 2, 3]);

    travels.archive();
    assertSnapshot(3, 3, [0, 1, 2, 3], { canBack: true, canForward: false });

    travels.setState(4);
    assertSnapshot(4, 3, [1, 2, 3, 4], {
      canBack: true,
      canForward: false,
      canArchive: true,
    });

    travels.archive();
    assertSnapshot(4, 3, [1, 2, 3, 4], { canBack: true, canForward: false });

    travels.setState(5);
    assertSnapshot(5, 3, [2, 3, 4, 5], {
      canBack: true,
      canForward: false,
      canArchive: true,
    });

    travels.archive();
    assertSnapshot(5, 3, [2, 3, 4, 5], { canBack: true, canForward: false });

    travels.archive();
    assertSnapshot(5, 3, [2, 3, 4, 5], { canBack: true, canForward: false });

    travels.setState(6);
    assertSnapshot(6, 3, [3, 4, 5, 6], {
      canBack: true,
      canForward: false,
      canArchive: true,
    });

    travels.archive();
    assertSnapshot(6, 3, [3, 4, 5, 6], { canBack: true, canForward: false });

    travels.back();
    assertSnapshot(5, 2, [3, 4, 5, 6], { canBack: true, canForward: true });

    travels.back();
    assertSnapshot(4, 1, [3, 4, 5, 6], { canBack: true, canForward: true });

    travels.back();
    assertSnapshot(3, 0, [3, 4, 5, 6], { canBack: false, canForward: true });

    travels.back();
    assertSnapshot(3, 0, [3, 4, 5, 6], { canBack: false, canForward: true });

    travels.forward();
    assertSnapshot(4, 1, [3, 4, 5, 6], { canBack: true, canForward: true });

    travels.forward();
    assertSnapshot(5, 2, [3, 4, 5, 6], { canBack: true, canForward: true });

    travels.forward();
    assertSnapshot(6, 3, [3, 4, 5, 6], { canBack: true, canForward: false });

    travels.forward();
    assertSnapshot(6, 3, [3, 4, 5, 6], { canBack: true, canForward: false });

    travels.back();
    assertSnapshot(5, 2, [3, 4, 5, 6], { canBack: true, canForward: true });

    const basePatches = travels.getControls().patches;
    expect(basePatches).toMatchInlineSnapshot(`
      {
        "inversePatches": [
          [
            {
              "op": "replace",
              "path": [],
              "value": 3,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 4,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 5,
            },
          ],
        ],
        "patches": [
          [
            {
              "op": "replace",
              "path": [],
              "value": 4,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 5,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 6,
            },
          ],
        ],
      }
    `);

    const rehydrated = createTravels(travels.getState(), {
      maxHistory: 3,
      autoArchive: false,
      initialPatches: basePatches,
      initialPosition: travels.getPosition(),
    });

    rehydrated.back();
    expect(rehydrated.getState()).toBe(4);
    expect(rehydrated.getPosition()).toBe(1);
    expect(rehydrated.getHistory()).toEqual([3, 4, 5, 6]);
    expect(rehydrated.canBack()).toBe(true);
    expect(rehydrated.canForward()).toBe(true);

    rehydrated.reset();
    expect(rehydrated.getState()).toBe(5);
    expect(rehydrated.getPosition()).toBe(2);
    expect(rehydrated.getHistory()).toEqual([3, 4, 5, 6]);
    expect(rehydrated.canBack()).toBe(true);
    expect(rehydrated.canForward()).toBe(true);
    expect(rehydrated.getControls().patches).toMatchInlineSnapshot(`
      {
        "inversePatches": [
          [
            {
              "op": "replace",
              "path": [],
              "value": 3,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 4,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 5,
            },
          ],
        ],
        "patches": [
          [
            {
              "op": "replace",
              "path": [],
              "value": 4,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 5,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 6,
            },
          ],
        ],
      }
    `);

    rehydrated.setState(() => 7);
    expect(rehydrated.getState()).toBe(7);
    expect(rehydrated.getPosition()).toBe(3);
    expect(rehydrated.getHistory()).toEqual([3, 4, 5, 7]);
    expect(rehydrated.canBack()).toBe(true);
    expect(rehydrated.canForward()).toBe(false);
    expect(rehydrated.getControls().patches).toMatchInlineSnapshot(`
      {
        "inversePatches": [
          [
            {
              "op": "replace",
              "path": [],
              "value": 3,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 4,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 5,
            },
          ],
        ],
        "patches": [
          [
            {
              "op": "replace",
              "path": [],
              "value": 4,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 5,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 7,
            },
          ],
        ],
      }
    `);

    rehydrated.setState(() => 8);
    expect(rehydrated.getState()).toBe(8);
    expect(rehydrated.getPosition()).toBe(3);
    expect(rehydrated.getHistory()).toEqual([3, 4, 5, 8]);
    expect(rehydrated.canBack()).toBe(true);
    expect(rehydrated.canForward()).toBe(false);
    expect(rehydrated.getControls().patches).toMatchInlineSnapshot(`
      {
        "inversePatches": [
          [
            {
              "op": "replace",
              "path": [],
              "value": 3,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 4,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 7,
            },
            {
              "op": "replace",
              "path": [],
              "value": 5,
            },
          ],
        ],
        "patches": [
          [
            {
              "op": "replace",
              "path": [],
              "value": 4,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 5,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 7,
            },
            {
              "op": "replace",
              "path": [],
              "value": 8,
            },
          ],
        ],
      }
    `);

    rehydrated.archive();
    expect(rehydrated.getState()).toBe(8);
    expect(rehydrated.getPosition()).toBe(3);
    expect(rehydrated.getHistory()).toEqual([3, 4, 5, 8]);
    expect(rehydrated.canBack()).toBe(true);
    expect(rehydrated.canForward()).toBe(false);
    expect(rehydrated.getControls().patches).toMatchInlineSnapshot(`
      {
        "inversePatches": [
          [
            {
              "op": "replace",
              "path": [],
              "value": 3,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 4,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 5,
            },
          ],
        ],
        "patches": [
          [
            {
              "op": "replace",
              "path": [],
              "value": 4,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 5,
            },
          ],
          [
            {
              "op": "replace",
              "path": [],
              "value": 8,
            },
          ],
        ],
      }
    `);
  });

  test('should handle boundary conditions with maxHistory limit', () => {
    const travels = createParityTravels();

    for (let i = 1; i <= 4; i++) {
      travels.setState(i);
      travels.archive();
    }

    expect(travels.getPosition()).toBe(3);
    expect(travels.getPatches().patches.length).toBe(3);
    expect(travels.getHistory()).toEqual([1, 2, 3, 4]);
    expect(travels.canBack()).toBe(true);
    expect(travels.canForward()).toBe(false);

    travels.setState(5);

    expect(travels.getPosition()).toBe(3);
    expect(travels.getPatches().patches.length).toBe(4);
    expect(travels.getHistory()).toEqual([2, 3, 4, 5]);
    expect(travels.canBack()).toBe(true);
    expect(travels.canForward()).toBe(false);
    expect(travels.canArchive()).toBe(true);
  });
});
