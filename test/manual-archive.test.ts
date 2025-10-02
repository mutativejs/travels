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
