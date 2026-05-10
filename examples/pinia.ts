/**
 * Pinia setup-store integration example.
 *
 * `mutable: true` keeps the reactive state identity stable while Travels
 * records patches for undo/redo.
 */

import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { createTravels } from '../src/index';

type TodoState = {
  todos: Array<{ id: string; text: string; done: boolean }>;
  filter: 'all' | 'active' | 'done';
};

export const useTodosStore = defineStore('todos', () => {
  const state = reactive<TodoState>({
    todos: [],
    filter: 'all',
  });

  const travels = createTravels(state, {
    mutable: true,
    maxHistory: 100,
  });

  function addTodo(text: string) {
    travels.setState((draft) => {
      draft.todos.push({
        id: crypto.randomUUID(),
        text,
        done: false,
      });
    });
  }

  function toggleTodo(id: string) {
    travels.setState((draft) => {
      const todo = draft.todos.find((item) => item.id === id);
      if (todo) {
        todo.done = !todo.done;
      }
    });
  }

  return {
    state,
    addTodo,
    toggleTodo,
    history: travels.getControls(),
  };
});
