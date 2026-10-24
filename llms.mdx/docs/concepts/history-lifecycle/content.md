# History Lifecycle (/docs/concepts/history-lifecycle)

A Travels timeline has two related but different ideas: the **retained history window** used by navigation, and the **instance baseline** used by `reset()`. Understanding their lifecycle prevents subtle undo/redo bugs.

## Positions and entries [#positions-and-entries]

Position `0` is the start of the current retained window. Each patch entry represents a transition to the next position. If three entries are retained, four states can be reconstructed: the window baseline plus three transitions.

```ts
const travels = createTravels({ count: 0 }, { maxHistory: 3 });

for (let index = 0; index < 5; index += 1) {
  travels.setState((draft) => { draft.count += 1; });
}

travels.getState();        // { count: 5 }
travels.getPosition();     // 3
travels.getHistory().map((state) => state.count); // [2, 3, 4, 5]
```

The oldest transitions were trimmed, but the current state remains `5` and the retained window starts at `2`.

## `maxHistory` [#maxhistory]

`maxHistory` must be a non-negative integer. Invalid values such as decimals, `NaN`, and `Infinity` are rejected immediately.

- It counts patch entries, not states.
- Old entries are dropped automatically.
- The position is relative to the retained window and capped at the limit.
- `reset()` can still restore the original instance baseline.
- Use a deliberate limit; “unlimited” history is not a safe persistence strategy by default.

`onWarning` can report `HISTORY_TRIMMED` when the application needs diagnostics. Do not infer overflow solely by comparing positions across every operation; navigation and rebase also change positions.

## `reset()` [#reset]

`reset()` restores the baseline captured when the instance was created or restored, then clears the timeline back to that baseline.

```ts
travels.reset();
console.log(travels.getPosition()); // 0
```

For a restored instance, the baseline is the validated starting timeline captured by the restore operation. Subsequent baseline-changing operations—such as `rebase()`, `replaceStateWithoutHistory()`, or updates while tracking is paused—affect what later resets return to.

## `rebase()` [#rebase]

`rebase()` makes current state the new initial baseline and discards all retained past and future entries.

```ts
travels.rebase();
// reset() now returns to this new baseline.
```

<Callout type="warn" title="Rebase is destructive">
Use `rebase()` only when the old timeline should become unreachable, such as after accepting a server snapshot or deliberately starting a new editing session. It is not the same as undoing to position `0`.
</Callout>

## Creating a new branch [#creating-a-new-branch]

After `back()`, future entries remain available through `forward()` until a new edit commits. That edit discards the redo branch and appends a new entry at the current position.

```ts
const travels = createTravels({ value: 'A' });
travels.setState({ value: 'B' });
travels.setState({ value: 'C' });
travels.back();                  // B, C is redoable
travels.setState({ value: 'D' }); // C is discarded

travels.canForward(); // false
```

Use `onBranchDiscard({ position, discarded })` for auditing or cleanup. The hook runs after the committed transition and cannot veto it.

## Loading state without history [#loading-state-without-history]

`replaceStateWithoutHistory(updater)` applies an update, clears history, and makes the result the new baseline. It is useful for accepting an authoritative remote snapshot or replacing a document without letting users undo into the previous document.

`pauseTracking()` and `resumeTracking()` instead form a scope for updates that should become the new baseline while ordinary timeline operations continue afterward. See [Tracking and Replacement](/docs/guides/tracking-and-replacement).

## Reading history safely [#reading-history-safely]

- `getHistory()` returns a shared, cached, read-only array of read-only state views. Use it while rendering or measuring the current timeline.
- `getHistorySnapshot()` returns detached, caller-owned states. Use it when retaining, sorting, posting to a worker, or mutating the result.
- `getPatches()` returns a detached retained patch snapshot.
- `getControls().patches` is a cached read-only view whose identity remains stable until history changes.

Mutable timelines can share the live object with history entries, so an old `getHistory()` result can reflect later in-place updates. Detached snapshots are the correct tool when historical values must remain fixed.
