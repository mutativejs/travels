# Mutable Mode Guide

Mutable mode makes Travels play nicely with observable state libraries (MobX, Vue's `reactive`, Pinia stores, etc.) that rely on **stable object references** to notify subscribers. Instead of replacing the entire state object on every update, Travels mutates the original object in place while still recording JSON Patches for undo/redo.

Use this guide to decide when to enable `mutable: true`, understand how it works internally, and apply it safely in production apps.

## When You Should Enable Mutable Mode

- You hand Travels the same object that your UI library observes and you cannot replace that reference without breaking reactivity (MobX stores, Vue/Pinia stores, custom proxies).
- You want undo/redo without extra `setState({...state})` copies or garbage-collection churn.
- You batch updates with `autoArchive: false` but still expect the live store reference to update immediately.

Stick with the default immutable mode when you already replace references (React/Redux style reducers, Zustand, etc.) or when you prefer structural sharing for diffing.

## Enabling Mutable Mode

```ts
import { createTravels } from 'travels';

const store = reactive({ count: 0 }); // Vue/Pinia example
const travels = createTravels(store, { mutable: true });

travels.setState((draft) => {
  draft.count += 1; // Mutates `store` in place
});
```

`travels.getState()` now always returns the same reference (`store`), but every mutation still produces patches so undo/redo keeps working.

## How It Works Under the Hood

1. `createTravels` deep clones the initial state once (via `deepClone(initialState)`) to keep a pristine copy for `reset()`.
2. Each `setState` call runs through Mutative's `create(...)` to generate patches/inverse patches. Those patches are immediately applied back to the live object via `apply(..., { mutable: true })`, so the reference never changes.
3. Navigation commands (`back`, `forward`, `go`) reuse the stored patches. `reset()` instead computes a fresh diff back to the JSON-cloned initial snapshot so it can restore the original data shape without replaying every history step.
4. If a history step replaces the entire root (patch path `[]` with `op: 'replace'`), Travels falls back to immutable assignment for that jump to guarantee correctness.

The full implementation lives in `src/travels.ts` and is exercised by `test/mutable-mode.test.ts` and `test/primitive-edge-cases.test.ts`.

## Behavior by Operation

| Operation            | Reference preserved?                                       | Notes                                                                                 |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `setState`           | Yes, as long as current state root is an object            | Non-object roots (numbers, strings, `null`) trigger an automatic immutable fallback   |
| `back` / `forward`   | Yes, unless the step applies a root-level replacement      | Happens when you undo a change that swapped the entire state object or type           |
| `go(position)`       | Same as `back/forward`                                     | Travels checks for root-replace patches before deciding whether it can mutate in place|
| `archive` (manual)   | Yes                                                        | Temporary patches are merged and applied to the same live object                      |
| `reset`              | Usually                                                    | Mutates in place only when both the current state and the stored initial snapshot are objects; otherwise it reassigns the root |
| `getHistory`         | Mixed                                                      | Includes the live state for the current position and cloned values for past/future steps |
| `subscribe`          | Receives the live (mutated) reference                      | Subscribers can safely compare by reference; values reflect the current undo position |

## Fallback & Safety Rails

- **Non-object roots**: If the current state is a primitive or `null`, Travels logs a dev warning and behaves immutably for that update. Undo/redo still works—it just cannot mutate a primitive in place.
- **Root replacements in history**: Navigating to a step that replaces the entire root (e.g., switching from `{...}` to `[]` or a primitive) forces a new reference for that jump only.
- **JSON-only data**: Travels clones the initial state via `deepClone(initialState)` the moment you call `createTravels`. Any non-JSON values are therefore lost up front, and `reset()` simply copies from that sanitized snapshot. The same constraint applies regardless of mutable mode.
- **Draft best practices**: Prefer mutating the provided draft (`draft.count++`) instead of returning a brand new object. Mutating drafts lets Travels keep using in-place patches during navigation.

## Integration Patterns

### MobX (simplified observable)

```ts
const mobxStore = makeAutoObservable({ todos: [] });
const travels = createTravels(mobxStore, { mutable: true });

autorun(() => {
  // mobxStore reference never changes
  console.log(mobxStore.todos.length);
});

function addTodo(title: string) {
  travels.setState((draft) => {
    draft.todos.push({ id: nanoid(), title, done: false });
  });
}
```

### Vue / Pinia

```ts
export const useTodosStore = defineStore('todos', () => {
  const state = reactive({ items: [] });
  const travels = createTravels(state, { mutable: true });

  const controls = travels.getControls();

  function addTodo(text: string) {
    travels.setState((draft) => {
      draft.items.push({ id: crypto.randomUUID(), text, done: false });
    });
  }

  return { state, addTodo, travels, controls };
});
```

The reactive `state` reference is the same object that Vue components bind to, so they instantly see mutations while retaining undo/redo controls.

### Manual Archive + Mutable

```ts
const travels = createTravels(store, { mutable: true, autoArchive: false });

function commitTransaction(cb: () => void) {
  cb();            // Run multiple travels.setState calls
  travels.archive(); // Save them as one undoable step
}
```

Because the state is mutated in place, your UI keeps updating during the transaction, but history only grows when you call `archive()`.

## Performance & Testing Notes

- Mutable mode still generates JSON patches, so you can persist or inspect diffs just like immutable mode.
- The dedicated `test/mutable-mode.test.ts` suite verifies reference stability across `setState`, `back`, `forward`, `go`, `reset`, `archive`, and `subscribe`.
- `test/bug-fixes.test.ts` and `test/coverage-improvements.test.ts` include regression tests for resetting nested objects, deleting extra properties, and handling sparse arrays (mutable value updates fall back to immutable to preserve holes).

## Troubleshooting Checklist

1. **Did the root reference change unexpectedly?** Check whether that history step replaced the entire state (e.g., `setState(() => newState)` returning a fresh object). Prefer draft mutations to avoid this.
2. **Not seeing updates in manual archive mode?** Remember that `travels.setState` still mutates the object immediately; `archive()` merely decides what becomes undoable.
3. **Seeing a warning about primitives?** Ensure your root state is an object. You can wrap primitives (`{ value: 0 }`) if you need mutable semantics.
4. **Need to confirm mode at runtime?** Inspect `travels.mutable`. It returns the current mode, which is handy for writing integration tests.

## Summary

Mutable mode gives Travels the ergonomics of reactive stores without giving up its patch-based history. Enable it when you need reference stability, follow the JSON-only constraint, and prefer draft mutations to keep undo/redo fast and predictable.
