# React Integration (/docs/integrations/react)

React works naturally with Travels’ default immutable mode. Subscribe with `useSyncExternalStore`, use `getRevision()` as the invalidation snapshot, and read current state or controls during render.

## A reusable external-store hook [#a-reusable-external-store-hook]

```tsx
import { useSyncExternalStore } from 'react';
import { createTravels, type Updater } from 'travels';

type State = { count: number };

const travels = createTravels<State>({ count: 0 });

export function useCounterTravel() {
  useSyncExternalStore(
    travels.subscribe,
    travels.getRevision,
    travels.getRevision
  );

  return {
    state: travels.getState(),
    setState: travels.setState,
    controls: travels.getControls(),
  };
}

export function Counter() {
  const { state, setState, controls } = useCounterTravel();

  return (
    <div>
      <output>Count: {state.count}</output>
      <button onClick={() => setState((draft) => { draft.count += 1; })}>
        Increment
      </button>
      <button onClick={() => controls.back()} disabled={!controls.canBack()}>
        Undo
      </button>
      <button onClick={() => controls.forward()} disabled={!controls.canForward()}>
        Redo
      </button>
    </div>
  );
}
```

`getRevision()` matters because `archive()` and `rebase()` can change timeline controls without changing the state reference. Subscribing only to object identity would leave buttons stale.

## Component-owned timelines [#component-owned-timelines]

The example above creates a module-level shared timeline. If each component instance should own a different document history, create the timeline once per mounted owner and keep it stable:

```tsx
import { useEffect, useState, useSyncExternalStore } from 'react';

function useDocumentTravels(initialState: DocumentState) {
  const [travels] = useState(() => createTravels(initialState));

  useSyncExternalStore(
    travels.subscribe,
    travels.getRevision,
    travels.getRevision
  );

  useEffect(() => {
    return () => {
      // Flush persistence or release owner-level resources here.
    };
  }, [travels]);

  return travels;
}
```

Do not call `createTravels()` unconditionally on every render. Treat `initialState` as initialization input; to load a different document, explicitly replace state or create a new keyed editor owner rather than silently resetting history during render.

## Restored shared timelines [#restored-shared-timelines]

Restore outside React, then subscribe to the restored instance:

```tsx
const snapshot = Travels.deserialize<DocumentState>(stored, {
  validation: 'semantic',
});
const timeline = restoreTravels(snapshot);

function Editor() {
  useSyncExternalStore(
    timeline.subscribe,
    timeline.getRevision,
    timeline.getRevision
  );

  return <DocumentView state={timeline.getState()} controls={timeline.getControls()} />;
}
```

For the official hook-based API and restored shared timelines, use [`use-travel@3`](https://github.com/mutativejs/use-travel). Its `useTravelStore` path accepts a restored Travels instance.

## Side effects and persistence [#side-effects-and-persistence]

Subscribe to persistence outside the render path. Debounce asynchronous writes and flush them at application-controlled shutdown points:

```ts
useEffect(() => {
  const persistence = attachAutoSave(travels, saveSnapshot);
  return () => {
    void persistence.dispose();
  };
}, [travels]);
```

Do not call `setState()`, `back()`, or other timeline mutations during render or synchronously from a Travels observer. Event handlers and appropriately scheduled effects/tasks keep transitions ordered.

## Server rendering [#server-rendering]

The third `useSyncExternalStore` argument provides the server snapshot. Keep server and initial client timeline data consistent to avoid hydration mismatches. A module-level timeline is application-global on the server; for request-specific data, create ownership at the appropriate request/client boundary instead of sharing documents across users.
