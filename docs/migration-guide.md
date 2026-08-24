# Migration Guide

## From 2.x to 3.0

Travels 3 separates state ownership, external journals, shared views, and
persistence restoration into distinct public capabilities.

### Create timelines through factories

`Travels` is no longer constructible. It remains the namespace for
`Travels.deserialize()`.

```ts
// 2.x
const travels = new Travels(initialState, options);

// 3.0
const travels = createTravels(initialState, options);
```

Use `createPatchableTravels()` when the initial state should be constrained to
the durable JSON-shaped state contract at compile time and checked immediately
at runtime.

### Choose one state owner

A state-owning timeline created with `createTravels()` exposes state updates
but no `recordPatches()`. An externally owned timeline created with
`createTravelJournal()` exposes `recordPatches()` and navigation, but none of
the state-owning methods.

```ts
const journal = createTravelJournal(authoritativeState, {
  apply(transition) {
    authoritativeState = commitThroughOwner(transition.patches);
    return authoritativeState;
  },
});

journal.recordPatches(nextState, {
  patches,
  inversePatches,
  metadata: { label: 'External edit' },
});
```

Remove `controlledApply` from ordinary `TravelsOptions`. State-only methods are
absent from the returned journal object instead of existing as methods that
throw when called.

### Treat shared views as read-only

`getHistory()` now returns `readonly ReadonlyState<S>[]` through both the
instance and controls surfaces, so both the shared array and its entries are
read-only in TypeScript. `TravelsControls` properties and methods are read-only
and the controls object is frozen in every build. Observer events expose
`ReadonlyTravelPatches`; their lazily materialized patch containers, groups,
operations, and array paths are also frozen.

```ts
const visible = travels.getControls().getHistory(); // readonly ReadonlyState<State>[]
const owned = travels.getHistorySnapshot(); // State[]; detached and mutable
```

Patch operation values can contain nested objects, so observers should still
treat the complete event as read-only. Use `getPatches()` for a detached,
caller-owned retained-history snapshot.

### Restore through one validated path

Remove the state-less `TravelsHistory` input type plus `history`,
`initialPatches`, `initialPosition`, and `strictInitialPatches`. Decode stored
input with `Travels.deserialize()` and restore the complete snapshot atomically:

```ts
const history = Travels.deserialize<State>(stored, {
  validation: 'semantic',
  fallback: emptySnapshot,
});

const travels = restoreTravels(history);
```

Malformed snapshots now throw rather than being discarded. Use
`Travels.deserialize(..., { fallback })` when recovery is intentional.

### Update observer and runtime compatibility

Use `TravelsEvent` for both subscribers and devtools. The deprecated
`TravelsDevtoolsEvent` alias and the listener-arity-based
`LEGACY_SUBSCRIBER` warning have been removed. Positional listeners must be
rewritten to accept the single event object.

Travels 3 requires Node.js 22 or newer and is tested on Node.js 22 and 24.

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
4. Use `Travels.deserialize(...)` and `restoreTravels(...)` for persisted history.

See [`examples/zustand.ts`](../examples/zustand.ts).

## From use-travel

`use-travel` is a React hook wrapper. Use Travels directly when you need framework-agnostic control, persistence adapters, metadata, or custom store integration.

1. Create `const travels = createTravels(initialState)`.
2. Subscribe with `useSyncExternalStore`.
3. Expose `travels.getControls()` to components.
4. Use `serialize()` / `Travels.deserialize()` for reloads.

See [`examples/react-integration.tsx`](../examples/react-integration.tsx).

## From Positional Subscribe Callbacks

Subscribers now receive the same `TravelsEvent` object as the `devtools` hook.
Replace positional callback parameters with event destructuring:

```ts
// Before
travels.subscribe((state, patches, position, historyLength) => {
  render(state, position);
});

// After
travels.subscribe(
  ({ type, state, patches, position, historyLength, metadata }) => {
    render(state, position);
  }
);
```

One shallow-frozen event object is shared by all observers for a notification.
Its `patches` property remains an event-local delta and is materialized lazily;
the patch containers, groups, operations, and array paths are frozen. Top-level
metadata is cloned and frozen on first access. Nested patch values and metadata
are event-local but shared by its observers; treat them as read-only. Call
`travels.getPatches()` when full retained history is required.
`TravelsDevtoolsEvent` was a deprecated alias in 2.x and is removed in 3.0.
Callbacks that ignore their arguments, such as external store invalidation
functions, can remain unchanged.

## From Map/Set State

Travels no longer supports Map or Set in either immutable or mutable state. Initial state and updates fail fast, and restored state or patch payloads containing collections are rejected during structural validation. Normalize collections before creating or updating a Travels instance:

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

Travels 3 has one restore path. Pass the complete result of
`Travels.deserialize(...)` to `restoreTravels()`; the former `history`,
`initialPatches`, `initialPosition`, and `strictInitialPatches` options no
longer exist. Malformed snapshots throw instead of silently starting with an
empty timeline.

```ts
const history = Travels.deserialize<State>(stored, {
  validation: 'semantic',
});

const travels = restoreTravels(history);
```

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
