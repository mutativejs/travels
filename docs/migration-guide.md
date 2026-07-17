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

## From Map/Set State

Travels no longer supports Map or Set in either immutable or mutable state. Normalize collections before creating or updating a Travels instance:

```ts
type Item = { id: string; title: string };

type LegacyState = {
  itemsById: Map<string, Item>;
  selectedIds: Set<string>;
};

type TravelsState = {
  itemsById: Record<string, Item>;
  selectedIds: string[];
};

declare const legacyState: LegacyState;

const normalizeState = (state: LegacyState): TravelsState => ({
  itemsById: Object.fromEntries(state.itemsById),
  selectedIds: Array.from(state.selectedIds),
});

const travels = createTravels(normalizeState(legacyState));
```

Use stable string IDs before converting Maps with non-string or object keys. Keep any Map/Set view required by the application outside Travels and derive it from the normalized state.

Do not replay old patch history generated from Map/Set mutations. Such history can contain collection-specific values or non-JSON path locators whose reference identity cannot be migrated reliably. Decode the legacy record outside Travels, materialize its authoritative current state, normalize that state, and create a new history baseline. A persistence codec may convert between application-domain collections and storage, but its output passed to Travels must remain in the supported JSON-shaped contract.

## Persistence Migration

Older hand-rolled persistence usually saved `{ state, patches, position }`. Convert it with `migrate`:

Migration and function-valued fallback callbacks must return synchronously.
Complete asynchronous storage or network work before calling
`Travels.deserialize(...)`; Promise-like callback results are rejected as
`MIGRATION_FAILED` or `FALLBACK_FAILED` without leaking an unhandled rejection.

```ts
type CurrentSnapshot = TravelsSerializedHistory<TravelsState>;

const history = Travels.deserialize<TravelsState>(stored, {
  validation: 'semantic',
  migrate(snapshot) {
    if (snapshot && typeof snapshot === 'object' && !('version' in snapshot)) {
      const legacy = snapshot as Omit<CurrentSnapshot, 'version'>;

      return {
        version: 1,
        state: legacy.state,
        patches: legacy.patches,
        position: legacy.position,
      };
    }

    return snapshot as CurrentSnapshot;
  },
});
```
