# Controlled Journal Guide

`createTravelJournal()` is the adapter API for a runtime that already owns and
commits state. It lets that runtime hand an existing forward/inverse patch pair
to Travels without rerunning the update recipe or routing navigation around the
owner's validation and subscription pipeline.

Use `createTravels()` instead when Travels itself should own state updates.

## Data flow

An external commit has one authoritative path:

1. The owner produces `nextState`, `patches`, and `inversePatches` for one
   transition.
2. The owner commits `nextState` through its normal state path.
3. In the same synchronous commit boundary, the adapter calls
   `journal.recordPatches(nextState, { patches, inversePatches, metadata })`.
4. Travels detaches the patch pair and metadata, updates its cursor and retained
   history, then publishes one `recordPatches` event.

`recordPatches()` requires a non-empty patch pair when the supplied state
reference changes. It validates patch structure and supported patch values, but
does not replay the pair to prove that it transforms the previous state into
the supplied state. That relationship is the adapter's responsibility; replay
validation here would duplicate the external runtime's work and defeat the
single-generation integration path.

Patch groups and metadata are cloned before Travels retains them. The supplied
state remains the external owner's state reference and is not cloned.

## Navigation contract

`back()`, `forward()`, and `go()` compose the necessary retained patches and
invoke the required `apply` callback:

```ts
const journal = createTravelJournal(authoritativeState, {
  apply(transition) {
    authoritativeState = commitThroughOwner(transition.patches);
    return authoritativeState;
  },
});
```

The callback receives:

- `state`: the state Travels knew before navigation;
- `patches`: the composed forward transition to commit;
- `inversePatches`: the composed rollback transition;
- `fromPosition` and `toPosition`: the cursor movement.

Treat the transition and its nested patch values as read-only. `apply` must
finish synchronously and return the state actually committed by the owner.
Travels advances its own state and cursor only after that return. A thrown error
or Promise-like result leaves the journal state, cursor, and history unchanged.

The owner must suppress normal commit recording while applying delegated
navigation. Feeding an undo or redo back into `recordPatches()` would create a
new entry instead of moving the existing cursor.

## Public surface

The returned `TravelJournal` exposes only journal-safe operations:

- external commit ingress: `recordPatches()`;
- navigation: `back()`, `forward()`, `go()`, `canBack()`, and `canForward()`;
- reads: `getState()`, `getHistory()`, `getPosition()`, `getPatches()`,
  `getMetadata()`, `getHistoryEntries()`, and `serialize()`;
- lifecycle: `subscribe()` and `rebase()`.

State-owning operations (`setState()`, `reset()`, transactions,
`replaceStateWithoutHistory()`, archive/tracking controls, and `getControls()`)
are absent from the public type and rejected at runtime. `rebase()` is the safe
way to clear retained history because it changes only the journal baseline and
cursor, not the external state.

## Failure boundaries

Travels makes each journal mutation internally atomic: invalid patches,
unsupported values, metadata cloning failures, and controlled navigation
failures do not partially change journal state or history.

The external owner and Travels are still two components. If the owner has
already published a commit and `recordPatches()` then fails, Travels cannot
roll that external commit back automatically. Generate patches through a
trusted producer, keep metadata cloneable, and call `recordPatches()` before
publishing external notifications when the owner supports that ordering. An
adapter that cannot roll back should recover explicitly, for example by
rebasing the journal at the authoritative state or switching to its documented
compatibility fallback.

Observer failures happen after a successful journal commit and follow the
normal `onObserverError` contract; they do not roll the transition back.

## Event compatibility

A successful external commit emits `TravelsEvent` with type `recordPatches`.
Navigation emits `go`, including calls made through `back()` or `forward()`.
The event patch groups describe only that event's transition.

Adding `recordPatches` extends the public `TravelsEvent['type']` union. Existing
applications using only `createTravels()` do not receive the event at runtime,
but TypeScript consumers with an exhaustive `switch` and a `never` assertion
must add a branch when upgrading.
