# Mutable Mode (/docs/guides/mutable-mode)

Mutable mode makes Travels play nicely with observable state libraries (MobX, Vue's `reactive`, Pinia stores, etc.) that rely on **stable object references** to notify subscribers. Instead of replacing the entire state object on every update, Travels mutates the original object in place while still recording JSON Patches for undo/redo.

Use this guide to decide when to enable `mutable: true`, understand how it works internally, and apply it safely in production apps.

## When You Should Enable Mutable Mode [#when-you-should-enable-mutable-mode]

- You hand Travels the same object that your UI library observes and you cannot replace that reference without breaking reactivity (MobX stores, Vue/Pinia stores, custom proxies).
- You want undo/redo without extra `setState({...state})` copies or garbage-collection churn.
- You batch updates with `autoArchive: false` but still expect the live store reference to update immediately.

Stick with the default immutable mode when you already replace references (React/Redux style reducers, Zustand, etc.) or when you prefer structural sharing for diffing.

## Enabling Mutable Mode [#enabling-mutable-mode]

```ts
import { createTravels } from 'travels';

const store = reactive({ count: 0 }); // Vue/Pinia example
const travels = createTravels(store, { mutable: true });

travels.setState((draft) => {
  draft.count += 1; // Mutates `store` in place
});
```

After this ordinary draft update, `travels.getState()` still returns `store`. Effective changes still produce patches, but explicit root replacements and primitive roots can change the root reference as described below.

## How It Works Under the Hood [#how-it-works-under-the-hood]

1. `createTravels` keeps the object you pass as the live state and stores a detached baseline copy for `reset()`, using `structuredClone()` when possible and a custom deep-clone fallback otherwise.
2. Each ordinary object-root draft update runs through Mutative's `create(...)` to generate patches/inverse patches. Those patches are immediately applied back to the live object via `apply(..., { mutable: true })`, preserving its reference. Explicit root replacements instead use an immutable fallback.
3. Navigation commands (`back`, `forward`, `go`) reuse the stored patches. `reset()` instead computes a fresh diff back to that baseline copy so it can restore the original data without replaying every history step.
4. If a history step replaces the entire root (patch path `[]` with `op: 'replace'`), Travels falls back to immutable assignment for that jump to guarantee correctness.

The full implementation lives in `src/travels.ts` and is exercised by `test/mutable-mode.test.ts` and `test/primitive-edge-cases.test.ts`.

## Restoring Persisted History Into a Live Store [#restoring-persisted-history-into-a-live-store]

`restoreTravels(snapshot)` restores a detached copy of the snapshot state, which would break reactivity for a store that is already observed. Pass the observed object as `target` instead:

```ts
import { reactive } from 'vue';
import { restoreTravels, Travels } from 'travels';

const store = reactive({ count: 0 });
const snapshot = Travels.deserialize<typeof store>(stored, {
  validation: 'semantic',
});
const travels = restoreTravels(snapshot, { mutable: true, target: store });

travels.getState() === store; // true
travels.back(); // Localized patches mutate `store`; root replacements can reassign it
```

Travels overwrites `target` in place with a copy of `snapshot.state` before it records anything, so the live object and the restored patch history always start from the same data. The snapshot itself is never mutated. `target` requires `mutable: true` and must have the same root kind (plain object or array) as the snapshot state, and neither root may have an own `__proto__` key; it is rejected with `INVALID_OPTION` otherwise.

## Behavior by Operation [#behavior-by-operation]

| Operation            | Reference preserved?                                       | Notes                                                                                 |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `setState`           | Usually                                                    | Localized draft updates preserve object/array roots; primitive roots and explicit root replacements use immutable fallback |
| `back` / `forward`   | Yes, unless the step applies a root-level replacement      | Happens when you undo a change that swapped the entire state object or type           |
| `go(position)`       | Same as `back/forward`                                     | Travels checks for root-replace patches before deciding whether it can mutate in place|
| `archive` (manual)   | Yes                                                        | Temporary patches are merged and applied to the same live object                      |
| `reset`              | Usually                                                    | Mutates in place only when the current state and the stored initial snapshot are both plain objects or both arrays, neither with an own `__proto__` key; otherwise it reassigns the root |
| `getHistory`         | Mixed                                                      | Includes the live state for the current position. Past and future entries share unchanged objects with it, so in-place updates also change an array returned earlier; keep copies with `getHistorySnapshot()` |
| `subscribe`          | Receives the current live root                              | In-place operations preserve its reference; root-replacement steps can provide a new root |

## Fallback & Safety Rails [#fallback--safety-rails]

- **No auto-freeze**: `enableAutoFreeze` cannot be combined with `mutable: true`. TypeScript reports the pair when `enableAutoFreeze` is the literal `true`, and the factories reject it with `INVALID_OPTION` at runtime. Freezing each produced state would also freeze the parts it shares with the live object, so the next update that writes to them would throw.
- **Non-object roots**: If the current state is a primitive or `null`, Travels logs a dev warning and behaves immutably for that update. Undo/redo still works—it just cannot mutate a primitive in place.
- **Root replacements in history**: Navigating to a step that replaces the entire root (e.g., switching from `{...}` to `[]` or a primitive) forces a new reference for that jump only.
- **Unreplayable history**: Navigation applies retained patches to the live object in place. If one cannot be applied, as in a corrupt snapshot that passed the default structural validation, `go()` throws `HISTORY_REPLAY_FAILED` and the writes made before it remain. Inside a transaction the rollback undoes what it can and, if some change cannot be undone, throws `TRANSACTION_FAILED` with that error as its `cause`. Validate untrusted snapshots with `Travels.deserialize(snapshot, { validation: 'semantic' })` before restoring them.
- **Function updaters returning a new root**: In mutable mode, `setState(() => newState)` that replaces the root falls back to immutable assignment for that update (dev warning emitted).
- **Own `__proto__` keys at the root**: `JSON.parse` turns a `"__proto__"` member into an own key. A Mutative draft cannot receive that key by assignment, and Mutative will not apply a patch path naming it, so a value update or `reset()` whose current or new root has one replaces the root instead of overwriting it in place.
- **Reset baseline is a copy**: `reset()` returns to a copy of the state taken at creation or restore, or by the last `rebase()`, `replaceStateWithoutHistory()`, or update while tracking is paused. The copy uses `structuredClone()` when possible and a deep-clone fallback otherwise, so `Date`, `undefined`, `NaN`, `-0`, and `bigint` survive. Structured-cloneable class instances lose their prototypes; values that cannot be cloned, such as functions and unsupported runtime objects, can be retained by reference through the fallback. Both modes reset to the same data.
- **Detached history values**: Mutable timelines detach object values in their patches with structured cloning plus a fallback, so later in-place writes to cloned data cannot rewrite history. A class instance drafted through `mark` that structured cloning handles returns as a plain object when undo or redo inserts it; fallback-only values can instead retain their reference and runtime type. Edits to fields of an instance that stays in place keep the instance, and immutable timelines keep instances throughout.
- **Draft best practices**: Prefer mutating the provided draft (`draft.count++`) instead of returning a brand new object. Mutating drafts lets Travels keep using in-place patches during navigation.

## Integration Patterns [#integration-patterns]

### MobX (simplified observable) [#mobx-simplified-observable]

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

### Vue / Pinia [#vue--pinia]

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

### Manual Archive + Mutable [#manual-archive--mutable]

```ts
const travels = createTravels(store, { mutable: true, autoArchive: false });

function commitChanges(cb: () => void) {
  cb();              // Run multiple travels.setState calls
  travels.archive(); // Save them as one undoable step
}
```

Because the state is mutated in place, your UI keeps updating while the grouped changes run. This helper defines a manual archive boundary, not an atomic transaction; use `travels.transaction()` when you need rollback and one settled observer event.

### Transactions + Mutable State [#transactions--mutable-state]

`travels.transaction(...)` journals the inverse patches produced by Travels operations. If the callback fails, those recorded changes are reversed while the live state object keeps its identity. A direct write to that object does not produce a Travels patch, so it is outside the journal and survives rollback:

```ts
const store = reactive({ saved: false, connectionStatus: 'online' });
const travels = createTravels(store, { mutable: true });

try {
  travels.transaction(() => {
    travels.setState((draft) => {
      draft.saved = true; // Rolled back if the callback fails
    });
    store.connectionStatus = 'offline'; // Survives rollback
    throw new Error('cancel');
  });
} catch {
  // store.saved was restored; store.connectionStatus is still "offline".
}
```

Use `travels.setState(...)` for every mutation that must share the transaction's rollback boundary. Travels listeners and devtools publish only the settled root transaction, but MobX, Vue, Pinia, or other observers attached directly to the live object can see provisional in-place mutations as they happen.

## Performance & Testing Notes [#performance--testing-notes]

- Mutable mode still generates JSON patches, so you can persist or inspect diffs just like immutable mode.
- The dedicated `test/mutable-mode.test.ts` suite verifies reference stability across `setState`, `back`, `forward`, `go`, `reset`, `archive`, and `subscribe`.
- `test/bug-fixes.test.ts` and `test/coverage-improvements.test.ts` include regression tests for resetting nested objects, deleting extra properties, and handling sparse arrays (mutable value updates fall back to immutable to preserve holes).

## Troubleshooting Checklist [#troubleshooting-checklist]

1. **Did the root reference change unexpectedly?** Check whether that history step replaced the entire state (e.g., `setState(() => newState)` returning a fresh object). Prefer draft mutations to avoid this.
2. **Not seeing updates in manual archive mode?** Remember that `travels.setState` still mutates the object immediately; `archive()` merely decides what becomes undoable.
3. **Seeing a warning about primitives?** Ensure your root state is an object. You can wrap primitives (`{ value: 0 }`) if you need mutable semantics.
4. **Need to confirm mode at runtime?** Inspect `travels.mutable`. It returns the current mode, which is handy for writing integration tests.

## Summary [#summary]

Mutable mode gives Travels the ergonomics of reactive stores without giving up its patch-based history. Enable it when ordinary operations need reference stability, follow the durable-data contract when persisting, and prefer draft mutations. Check the operation table whenever strict root identity matters.
