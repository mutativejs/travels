import { describe, expect, test } from 'vitest';
import { nextTick, reactive, watchEffect } from 'vue';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { action, autorun, makeAutoObservable, runInAction } from 'mobx';
import { createTravels } from '../src/index';

describe('Mutable mode framework integrations', () => {
  test('keeps a Pinia/Vue store reactive while history controls run', async () => {
    setActivePinia(createPinia());

    const useTodosStore = defineStore('todosMutableIntegration', () => {
      const state = reactive({
        items: [] as Array<{ text: string; done: boolean }>,
      });
      const travels = createTravels(state, { mutable: true });
      const controls = travels.getControls();

      const addTodo = (text: string) => {
        travels.setState((draft) => {
          draft.items.push({ text, done: false });
        });
      };

      const toggleTodo = (index: number) => {
        travels.setState((draft) => {
          draft.items[index].done = !draft.items[index].done;
        });
      };

      return { state, addTodo, toggleTodo, travels, controls };
    });

    const store = useTodosStore();
    const snapshots: Array<Array<{ text: string; done: boolean }>> = [];

    const stop = watchEffect(() => {
      snapshots.push(
        store.state.items.map((item) => ({ text: item.text, done: item.done }))
      );
    });

    await nextTick();
    expect(snapshots).toEqual([[]]);
    expect(store.state).toBe(store.travels.getState());

    store.addTodo('Walk dog');
    await nextTick();

    store.addTodo('Cook dinner');
    await nextTick();

    store.toggleTodo(0);
    await nextTick();

    store.controls.back(); // undo toggle
    await nextTick();

    store.travels.reset(); // back to original initial state
    await nextTick();

    stop();

    expect(snapshots).toEqual([
      [],
      [{ text: 'Walk dog', done: false }],
      [
        { text: 'Walk dog', done: false },
        { text: 'Cook dinner', done: false },
      ],
      [
        { text: 'Walk dog', done: true },
        { text: 'Cook dinner', done: false },
      ],
      [
        { text: 'Walk dog', done: false },
        { text: 'Cook dinner', done: false },
      ],
      [],
    ]);

    expect(store.state).toBe(store.travels.getState());
  });

  test('MobX stores stay observable when travels mutates in place', () => {
    const mobxStore = makeAutoObservable({
      todos: [] as Array<{ text: string; done: boolean }>,
    });

    const travels = createTravels(mobxStore, { mutable: true });
    const controls = travels.getControls();

    const snapshots: Array<Array<{ text: string; done: boolean }>> = [];
    const dispose = autorun(() => {
      snapshots.push(
        mobxStore.todos.map((todo) => ({ text: todo.text, done: todo.done }))
      );
    });

    const addTodo = action('addTodo', (text: string) => {
      travels.setState((draft) => {
        draft.todos.push({ text, done: false });
      });
    });

    const toggleTodo = action('toggleTodo', (index: number) => {
      travels.setState((draft) => {
        draft.todos[index].done = !draft.todos[index].done;
      });
    });

    addTodo('Walk dog');
    addTodo('Cook dinner');
    toggleTodo(0);
    runInAction(() => controls.back()); // undo toggle
    runInAction(() => controls.back()); // undo "Cook dinner"
    runInAction(() => controls.forward()); // redo "Cook dinner"
    runInAction(() => travels.reset()); // replay diff from initial state

    dispose();

    expect(snapshots).toEqual([
      [],
      [{ text: 'Walk dog', done: false }],
      [
        { text: 'Walk dog', done: false },
        { text: 'Cook dinner', done: false },
      ],
      [
        { text: 'Walk dog', done: true },
        { text: 'Cook dinner', done: false },
      ],
      [
        { text: 'Walk dog', done: false },
        { text: 'Cook dinner', done: false },
      ],
      [{ text: 'Walk dog', done: false }],
      [
        { text: 'Walk dog', done: false },
        { text: 'Cook dinner', done: false },
      ],
      [],
    ]);

    expect(mobxStore).toBe(travels.getState());
  });
});
