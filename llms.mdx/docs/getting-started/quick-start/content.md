# Quick Start (/docs/getting-started/quick-start)

This guide builds a small document editor history. The same API works in vanilla JavaScript, TypeScript, and framework integrations.

## 1. Create a timeline [#1-create-a-timeline]

Pass the initial state and, optionally, the maximum number of retained patch entries:

```ts
import { createTravels } from 'travels';

type DocumentState = {
  title: string;
  blocks: Array<{ id: string; text: string }>;
};

const travels = createTravels<DocumentState>(
  { title: 'Untitled', blocks: [] },
  { maxHistory: 100 }
);
```

The initial state is the baseline at position `0`. `maxHistory` limits retained transitions, not the number of states returned by `getHistory()`; a window of 100 patches can expose 101 states.

## 2. Record an edit [#2-record-an-edit]

Use a draft recipe for the most natural update style:

```ts
travels.setState(
  (draft) => {
    draft.title = 'Product brief';
    draft.blocks.push({ id: 'intro', text: 'A reversible edit.' });
  },
  {
    label: 'Edit introduction',
    source: 'editor',
    timestamp: Date.now(),
  }
);
```

Travels commits one immutable state, stores forward and inverse patches, advances the cursor, and notifies subscribers. Metadata is attached to the history entry and included in persistence snapshots.

You can also provide a direct value or return a new state. Updaters must be synchronous:

```ts
travels.setState({ title: 'A new title', blocks: [] });
travels.setState(() => ({ title: 'Another title', blocks: [] }));
```

No-op updates that produce no patches do not create an entry or publish an event.

## 3. Observe committed changes [#3-observe-committed-changes]

Subscribe once and clean up when the owner is disposed:

```ts
const unsubscribe = travels.subscribe(
  ({ type, state, position, historyLength, metadata }) => {
    console.log({ type, state, position, historyLength, metadata });
  }
);

// Later, when the editor is destroyed:
unsubscribe();
```

Events are published after the timeline commits. Treat `event.state`, `event.patches`, and `event.metadata` as read-only. Do not synchronously call mutating Travels APIs from an observer; schedule follow-up work for a later task.

## 4. Add undo, redo, and navigation [#4-add-undo-redo-and-navigation]

```ts
if (travels.canBack()) travels.back();
if (travels.canForward()) travels.forward();

travels.back(2);      // Move back two entries
travels.forward(2);   // Move forward two entries
travels.go(0);        // Jump to the retained window start
travels.reset();      // Restore the instance baseline and clear the timeline
```

For UI components that need navigation but should not receive the full state-owning instance, use the cached controls facade:

```ts
const controls = travels.getControls();

controls.back();
controls.forward();
console.log(controls.position, controls.canBack(), controls.canForward());
```

A committed edit after undo discards the redo branch. Use `onBranchDiscard` when the application needs to observe that cleanup.

## 5. Group one logical operation [#5-group-one-logical-operation]

Use a transaction when several updates should become one undo step and observers should see only the settled result:

```ts
travels.transaction({ label: 'Revise document' }, () => {
  travels.setState((draft) => {
    draft.blocks.push({ id: 'revision', text: 'First revision' });
  });
  travels.setState((draft) => {
    draft.title = 'Revised brief';
  });
});
```

`batch()` is an alias for `transaction()`. Transaction callbacks must be synchronous; failures roll back changes made through Travels APIs. Learn more in [Transactions](/docs/guides/transactions).

## 6. Save and restore the timeline [#6-save-and-restore-the-timeline]

```ts
import { restoreTravels, Travels } from 'travels';

const encoded = JSON.stringify(travels.serialize());
localStorage.setItem('travels:quick-start', encoded);

// During a later startup:
const stored = localStorage.getItem('travels:quick-start');
if (stored) {
  const snapshot = Travels.deserialize<DocumentState>(stored, {
    validation: 'semantic',
  });
  const restored = restoreTravels(snapshot, { maxHistory: 100 });
  console.log(restored.getState());
}
```

The snapshot contains current state, retained forward and inverse patches, position, schema version, and optional metadata. `serialize()` returns detached data; it does not write to storage or call `JSON.stringify()` itself.

<Callout type="warn" title="Use semantic validation for unverified storage">
Structural validation is the fast default and checks schema and patch shape. Semantic validation additionally replays the reachable history in both directions. Use it for browser storage or other input that has not crossed a trusted verification boundary.
</Callout>

## 7. Keep exploring [#7-keep-exploring]

<Cards>
  <Card title="Connect React or another framework" href="/docs/integrations" />
  <Card title="Choose automatic or manual archives" href="/docs/guides/archive-mode" />
  <Card title="Build a production persistence adapter" href="/docs/persistence/storage-adapters" />
  <Card title="Review every instance method" href="/docs/reference/instance-methods" />
</Cards>
