# How Travels Works (/docs/concepts/how-it-works)

Travels turns each effective update into an immutable state transition plus two patch groups: one that moves forward and one that restores the previous state. The retained sequence of those transitions is the history.

## The five core terms [#the-five-core-terms]

| Term | Meaning |
| --- | --- |
| **State** | The application data at the current timeline position. |
| **Draft** | The mutation-friendly draft passed to a `setState()` recipe. |
| **Patches** | JSON Patch operations describing a transition, plus their inverse. |
| **Position** | The cursor in the retained history window; `0` is its baseline. |
| **Archive** | The act of committing pending changes as a history entry. |

## One edit, two directions [#one-edit-two-directions]

Consider this state and update:

```ts
const travels = createTravels({ title: 'Draft', views: 0 });

travels.setState((draft) => {
  draft.title = 'Published';
  draft.views += 1;
});
```

Conceptually, Travels retains a forward entry like this:

```json
[
  { "op": "replace", "path": "/title", "value": "Published" },
  { "op": "replace", "path": "/views", "value": 1 }
]
```

It also retains the inverse entry needed to restore `{ title: 'Draft', views: 0 }`. `back()` applies inverse operations; `forward()` reapplies forward operations. You do not write either patch group yourself when using `setState()`.

```text
Baseline ── edit A ── edit B ── edit C
   0          1          2          3
                         ▲
                      position
```

Moving back changes the cursor and state; it does not destroy future entries until a new committed edit creates a branch.

## Immutable mode by default [#immutable-mode-by-default]

In the default mode, Travels produces a new immutable state through Mutative. Unchanged branches can be structurally shared. Treat values returned by `getState()`, `getHistory()`, and observer events as read-only: direct writes bypass patch recording and can also modify objects retained by patch values.

Use `enableAutoFreeze: true` in immutable mode when you want accidental writes to fail during development. For a caller-owned history array, use `getHistorySnapshot()` rather than modifying the shared `getHistory()` cache.

## Mutable mode for identity-stable stores [#mutable-mode-for-identity-stable-stores]

With `mutable: true`, Travels applies patches back to the original object so MobX, Vue, Pinia, or custom proxies can keep observing the same reference. It still generates forward and inverse patches for navigation and persistence.

Root replacements and primitive roots can require an immutable fallback. `enableAutoFreeze` cannot be combined with mutable mode. The [Mutable Mode Guide](/docs/guides/mutable-mode) explains every operation’s identity behavior.

## Automatic and manual history [#automatic-and-manual-history]

With `autoArchive: true`, every effective `setState()` creates an entry. With `autoArchive: false`, state updates remain pending until `archive()` or an operation that implicitly archives them.

```ts
const travels = createTravels({ x: 0, y: 0 }, { autoArchive: false });

travels.setState((draft) => { draft.x = 10; });
travels.setState((draft) => { draft.y = 20; });
travels.archive({ label: 'Move object' }); // One undo step
```

A root `transaction()` also groups updates, but additionally hides provisional states from Travels observers and rolls back Travels-tracked changes on failure.

## Branches and the redo boundary [#branches-and-the-redo-boundary]

```text
Initial ── A ── B ── C
              ▲
             back()
              │
              └── D   // A committed D discards redo entry C
```

`onBranchDiscard` receives the entries removed by this transition. Transactions report only redo entries visible before the root transaction, not branches created and discarded entirely inside provisional work.

## Retained window versus true baseline [#retained-window-versus-true-baseline]

`maxHistory` drops old patches as the timeline advances. The cursor is relative to the retained window, so it remains capped at that limit. `reset()` can still restore the instance’s true baseline even after older entries are trimmed.

`rebase()` is different: it intentionally discards all past and future history and makes current state the new baseline. See [History Lifecycle](/docs/concepts/history-lifecycle).

## What persistence stores [#what-persistence-stores]

`serialize()` creates one versioned value containing:

- current state;
- forward and inverse patch groups;
- current position;
- optional history metadata;
- the Travels history schema version.

`Travels.deserialize()` validates that value, and `restoreTravels()` creates a timeline from it atomically. No separate state/history alignment step is required.
