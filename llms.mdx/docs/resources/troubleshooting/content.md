# Troubleshooting (/docs/resources/troubleshooting)

Use the sections below to isolate whether a problem belongs to state ownership, history recording, replay, persistence, or the UI binding. Stable error and warning codes are listed in [Error Handling](/docs/guides/error-handling).

## An update does not appear in history [#an-update-does-not-appear-in-history]

Check these conditions in order:

1. **Did the value actually change?** No-op patch groups create no entry and no event.
2. **Is `autoArchive: false` enabled?** Pending updates need `archive()` or an operation that implicitly archives them.
3. **Is tracking paused?** Resume it in a `finally` block.
4. **Are you writing through Travels?** Direct assignments to `getState()`, a MobX/Vue store, or another owner are not recorded.
5. **Are you using a controlled journal?** Call `recordPatches()` with the owner’s exact patch pair; journals intentionally omit `setState()`.
6. **Did an updater throw or return a Promise?** Keep callbacks synchronous and await data before calling them.

Use `getRevision()` to verify whether a committed event occurred and `subscribe()` to inspect the event type.

## Undo or redo buttons stay stale [#undo-or-redo-buttons-stay-stale]

State identity is not enough to invalidate controls. `archive()` and `rebase()` can change the timeline without replacing state.

- In React, subscribe with `useSyncExternalStore(travels.subscribe, travels.getRevision)`.
- In another store, mirror `getRevision()` or relevant controls after every committed event.
- Confirm the subscription was not disposed prematurely.
- Do not create a new timeline on every component render.

See [Navigation and Controls](/docs/guides/navigation-and-controls).

## `instanceof Travels` fails or throws [#instanceof-travels-fails-or-throws]

The exported `Travels` value is a persistence namespace, not a constructor in Travels 3. Create instances with `createTravels()` and detect them with `isTravels(value)`. Controlled journals are not state-owning Travels instances and return `false` from that guard.

## A restored snapshot throws [#a-restored-snapshot-throws]

- Parse storage before assuming its shape; `Travels.deserialize()` accepts JSON strings or parsed objects.
- Use `validation: 'semantic'` for unverified input so invalid replay is detected at restore.
- Match `strict` and `mark` through `replayOptions` when they were customized during recording.
- Migrate older application and history shapes before validation.
- Check `TravelsPersistenceError.code`, plus `entryIndex` and `direction` when present.
- Supply a known-safe `fallback` for intentional startup recovery.

Do not pass separate `history`, `initialPatches`, or `initialPosition` options in v3. Pass one complete snapshot to `restoreTravels()`.

## JSON persistence loses values [#json-persistence-loses-values]

JSON does not preserve `undefined`, `bigint`, `NaN`, infinities, `-0`, prototypes, Map/Set, circular references, or shared object identity. Some values throw; others are silently converted or dropped.

Run:

```ts
travels.assertPersistenceCompatible();
const snapshot = travels.serialize({ strict: true });
```

Then inspect the reported path and normalize the value according to [State Requirements](/docs/concepts/state-requirements). Remember that an incompatible value can remain in an old patch after leaving current state.

## A mutable store loses or unexpectedly changes its root reference [#a-mutable-store-loses-or-unexpectedly-changes-its-root-reference]

Check whether the operation replaced the root, used a primitive root, or navigated through a root-replacement patch. Prefer localized draft mutations. For restore, pass the observed object as `target` with `mutable: true`:

```ts
restoreTravels(snapshot, { mutable: true, target: store });
```

Do not combine mutable mode with `enableAutoFreeze`. Read the complete [operation identity table](/docs/guides/mutable-mode#behavior-by-operation).

## A transaction did not roll everything back [#a-transaction-did-not-roll-everything-back]

Travels rolls back writes made through its own APIs. It cannot roll back direct mutable-store assignments, network requests, DOM changes, storage writes, or other external side effects.

Move every undoable state write into `setState()`, keep the callback synchronous, and manage external side effects after successful commit or with a separate compensation strategy. Framework observers attached directly to mutable state can also see provisional writes even though Travels observers cannot.

## Observer errors or reentrant mutations [#observer-errors-or-reentrant-mutations]

Observers run after commit. They cannot veto or safely mutate the same transition. Schedule follow-up work in a later task and avoid cycles. Use `onObserverError` to isolate listener/devtools failures; an observer exception does not roll back the state that already committed.

## Controlled journal history diverges from the owner [#controlled-journal-history-diverges-from-the-owner]

- Record the exact post-commit state and exact forward/inverse pair from the same transition.
- Do not rerun the recipe inside Travels.
- Do not record navigation triggered by `apply` as a new edit.
- Make `apply` synchronous and return the state actually committed.
- Handle root replacement explicitly when applying patches in place.
- Preflight with `assertTravelHistoryEntryRecordable()` when the owner cannot roll back a published commit.

Travels validates patch structure but deliberately does not regenerate patches to prove the owner’s transition. That relationship belongs to the adapter.

## The website needs a Markdown or LLM version [#the-website-needs-a-markdown-or-llm-version]

Every documentation page exposes Markdown through the page’s copy/view controls. The site also exports `/llms.txt` and `/llms-full.txt` for documentation discovery and full-text consumption. These routes describe the documentation site; they do not change Travels runtime behavior.

## Still stuck? [#still-stuck]

Compare against a runnable [Example](/docs/resources/examples), then open a [GitHub issue](https://github.com/mutativejs/travels/issues) with a minimal reproduction, the Travels and Mutative versions, runtime/browser details, stable error code, and the smallest state/patch payload that demonstrates the problem. Remove secrets and private user data first.
