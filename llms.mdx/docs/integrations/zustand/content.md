# Zustand Integration (/docs/integrations/zustand)

For new Zustand applications, the official [`zustand-travel@3`](https://github.com/mutativejs/zustand-travel) middleware is the most direct integration. The core API remains useful when you need a separate history owner or custom persistence orchestration.

## Official middleware [#official-middleware]

```ts
import { create } from 'zustand';
import { travel } from 'zustand-travel';
import { Travels } from 'travels';

type State = { title: string; count: number };
type Actions = {
  updateTitle: (title: string) => void;
  increment: () => void;
};

const snapshot = Travels.deserialize<State>(stored, {
  validation: 'semantic',
});

const useStore = create<State & Actions>()(
  travel(
    (set) => ({
      title: 'Untitled',
      count: 0,
      updateTitle: (title) =>
        set((state) => {
          state.title = title;
        }),
      increment: () =>
        set((state) => {
          state.count += 1;
        }),
    }),
    { snapshot }
  )
);
```

The optional `snapshot` supplies one complete restored history. Do not also pass a state-owning `Travels` instance; the binding owns the timeline integration. Initializer functions define actions, while snapshot data supplies the restored baseline.

When no restore is needed, omit `snapshot` and let the initializer define the starting state. Consult the binding’s own documentation for its returned controls and hook API.

## Direct core integration [#direct-core-integration]

A small manual adapter can mirror an immutable Travels state into Zustand:

```ts
import { create } from 'zustand';
import { createTravels, type Updater } from 'travels';

type State = { count: number };
const travels = createTravels<State>({ count: 0 });

type Store = State & {
  setState: (updater: Updater<State>) => void;
  controls: ReturnType<typeof travels.getControls>;
};

const useStore = create<Store>((set) => ({
  ...travels.getState(),
  setState: (updater) => {
    travels.setState(updater);
    set(travels.getState());
  },
  controls: travels.getControls(),
}));

const unsubscribe = travels.subscribe(({ state }) => {
  useStore.setState(state);
});
```

The subscription also synchronizes undo, redo, reset, and other navigation. Keep the subscription for the store’s lifetime or dispose it with the application store.

For control-only updates such as manual `archive()` and `rebase()`, mirror `getRevision()` into the store as well if components read `controls.canBack()` or `controls.position` and do not otherwise re-render.

## One authoritative update path [#one-authoritative-update-path]

Do not let an action write independently to both stores in a way that creates divergent states. Either route updates through Travels and mirror its committed state, or keep Zustand authoritative and use the official binding or a controlled journal.

Avoid passing live mutable references from a separate form/store into immutable Travels without cloning when that owner can later mutate them. Use detached values at the integration boundary.
