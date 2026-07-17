# Migration Guide

## From Redux-undo

Redux-undo stores whole state snapshots. Travels stores JSON Patch entries.

1. Keep your existing reducer or state updater as the source of state changes.
2. Create a Travels instance with the reducer state.
3. Replace `UNDO` / `REDO` dispatches with `travels.back()` / `travels.forward()`.
4. Use `metadata` labels for undo menu text.
5. Persist with `travels.serialize()` instead of storing the whole Redux-undo history object.

Snapshot stacks can still be better for small state and short local-only history. Travels is strongest when serialized history size matters.

## From Zundo

Zundo integrates directly with Zustand stores. Travels can be used as a separate history engine:

1. Keep Zustand as the UI store.
2. Call `travels.setState(...)` inside store actions.
3. Sync `travels.getState()` back into Zustand after state changes.
4. Use `Travels.deserialize(...)` and the `history` option for persisted history.

See [`examples/zustand.ts`](../examples/zustand.ts).

## From use-travel

`use-travel` is a React hook wrapper. Use Travels directly when you need framework-agnostic control, persistence adapters, metadata, or custom store integration.

1. Create `const travels = createTravels(initialState)`.
2. Subscribe with `useSyncExternalStore`.
3. Expose `travels.getControls()` to components.
4. Use `serialize()` / `Travels.deserialize()` for reloads.

See [`examples/react-integration.tsx`](../examples/react-integration.tsx).

## Persistence Migration

Older hand-rolled persistence usually saved `{ state, patches, position }`. Convert it with `migrate`:

```ts
const history = Travels.deserialize(stored, {
  validation: 'semantic',
  migrate(snapshot) {
    if (snapshot && typeof snapshot === 'object' && !('version' in snapshot)) {
      return {
        version: 1,
        state: snapshot.state,
        patches: snapshot.patches,
        position: snapshot.position,
      };
    }

    return snapshot;
  },
});
```
