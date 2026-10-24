# MobX and Pinia (/docs/integrations/mobx-pinia)

MobX and Pinia commonly observe a stable object rather than expecting immutable root replacement. Create Travels with `mutable: true` and pass the same object your components observe.

## MobX [#mobx]

```ts
import { autorun, makeAutoObservable } from 'mobx';
import { createTravels } from 'travels';

type Todo = { id: string; title: string; done: boolean };

const store = makeAutoObservable({
  todos: [] as Todo[],
});

const travels = createTravels(store, { mutable: true });

const dispose = autorun(() => {
  console.log('Visible todos:', store.todos.length);
});

function addTodo(title: string) {
  travels.setState((draft) => {
    draft.todos.push({ id: crypto.randomUUID(), title, done: false });
  });
}

function toggleTodo(id: string) {
  travels.setState((draft) => {
    const todo = draft.todos.find((item) => item.id === id);
    if (todo) todo.done = !todo.done;
  }, { label: 'Toggle Todo' });
}
```

`store` and `travels.getState()` remain the same reference for ordinary draft updates. `back()` and `forward()` apply patches to that object so MobX reactions continue to run.

## Pinia setup store [#pinia-setup-store]

```ts
import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { createTravels } from 'travels';

export const useTodosStore = defineStore('todos', () => {
  const state = reactive({
    items: [] as Array<{ id: string; text: string; done: boolean }>,
  });

  const travels = createTravels(state, {
    mutable: true,
    maxHistory: 100,
  });
  const controls = travels.getControls();

  function addTodo(text: string) {
    travels.setState((draft) => {
      draft.items.push({ id: crypto.randomUUID(), text, done: false });
    });
  }

  function undo() {
    if (travels.canBack()) travels.back();
  }

  function redo() {
    if (travels.canForward()) travels.forward();
  }

  return { state, addTodo, undo, redo, travels, controls };
});
```

Expose actions rather than inviting components to assign directly to `state`. Direct Pinia or MobX writes can be appropriate for non-history fields, but they are invisible to undo and transaction rollback.

## Restore into the live store [#restore-into-the-live-store]

```ts
const snapshot = Travels.deserialize<typeof state>(stored, {
  validation: 'semantic',
});

const restored = restoreTravels(snapshot, {
  mutable: true,
  target: state,
});
```

The restore target is overwritten in place with detached snapshot state. The snapshot remains reusable and is never used as the live store object itself.

## Identity and root replacement [#identity-and-root-replacement]

Prefer localized draft mutations. Primitive roots, explicit root replacements, and some reset/navigation cases can require immutable fallback. Review the [Mutable Mode operation table](/docs/guides/mutable-mode#behavior-by-operation) if your integration depends on strict reference equality.

Do not enable `enableAutoFreeze` with mutable mode. Map and Set remain unsupported even when MobX or Vue can observe them; normalize collections before passing them to Travels.

## Transactions and observers [#transactions-and-observers]

A transaction only journals writes made through Travels. Direct `store` mutations survive rollback. Framework observers attached directly to the object can see provisional changes, whereas Travels listeners see one settled root event. Keep side effects and direct writes outside the atomic document update or give them a separate recovery strategy.
