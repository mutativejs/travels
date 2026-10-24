# Travels Documentation (/docs)

Travels is a framework-agnostic state history engine for durable undo/redo. It records forward and inverse JSON Patches, so applications with large state and small, frequent edits can retain compact timelines, persist them, and restore them later.

Write updates with familiar mutation syntax. Travels uses [Mutative](https://mutative.js.org/) to produce immutable state by default, while mutable mode and controlled journals support reactive stores and externally owned state.

<Callout type="info" title="Travels 3">
Version 3 uses explicit factories, one atomic persistence restore path, read-only shared views, and separate capabilities for state-owning timelines and external journals. Upgrading? Start with the [Migration Guide](/docs/migration).
</Callout>

## Start with your goal [#start-with-your-goal]

<Cards>
  <Card title="Install and build a timeline" href="/docs/getting-started/installation" description="Requirements, package installation, and a minimal working example." />
  <Card title="Understand the history model" href="/docs/concepts/how-it-works" description="State, patches, positions, archives, branches, and baselines." />
  <Card title="Connect your framework" href="/docs/integrations" description="React, Vue, Zustand, MobX, Pinia, forms, and external stores." />
  <Card title="Persist complete histories" href="/docs/persistence" description="Serialize, validate, restore, migrate, and recover timeline snapshots." />
  <Card title="Learn advanced behavior" href="/docs/guides" description="Transactions, manual archives, events, mutable state, and journals." />
  <Card title="Look up an exact API" href="/docs/api-reference" description="Every exported function, class, interface, type alias, and variable." />
</Cards>

## A complete example in one minute [#a-complete-example-in-one-minute]

```ts
import { createTravels, restoreTravels } from 'travels';

const travels = createTravels(
  { title: 'Untitled', tags: [] as string[] },
  { maxHistory: 100 }
);

const unsubscribe = travels.subscribe(({ state, position }) => {
  render(state, position);
});

travels.setState(
  (draft) => {
    draft.title = 'My document';
    draft.tags.push('draft');
  },
  { label: 'Edit document' }
);

travels.back();    // Undo the whole edit
travels.forward(); // Redo it

const snapshot = travels.serialize();
const restored = restoreTravels(snapshot);
```

The next step is the [Quick Start](/docs/getting-started/quick-start), which explains each part of this flow.

## When Travels is a good fit [#when-travels-is-a-good-fit]

Travels is optimized for history size, persistence, and replayable operation logs. It is especially useful for visual editors, form builders, local-first applications, workflow designers, and other editing experiences where users need a safe way to explore.

| Your priority | Recommended approach |
| --- | --- |
| Large state, small updates, long retained history | Travels |
| Persist or transmit undo/redo history | Travels |
| Small state, short local-only history, lowest update latency | A snapshot stack may be simpler and faster |
| Concurrent multi-user conflict resolution | Use a CRDT/OT system; Travels alone does not resolve conflicts |
| Full-state replacement on every update | Compare snapshot and patch costs for your workload |

See [Choosing Travels](/docs/getting-started/choosing-travels) for the full trade-off discussion.

## The public building blocks [#the-public-building-blocks]

- `createTravels()` creates a timeline that owns state updates.
- `createPatchableTravels()` adds compile-time and immediate runtime checks for durable state.
- `createTravelJournal()` records patch pairs from an external state owner.
- `restoreTravels()` and `restoreTravelJournal()` restore complete validated snapshots.
- `Travels.deserialize()` decodes, migrates, and validates persisted input.
- `getControls()` exposes a narrow, read-only navigation surface for UI components.

All exports are documented in the [API Reference](/docs/api-reference).

## Project resources [#project-resources]

Travels is MIT licensed and written in TypeScript. Find runnable examples in the documentation’s [Examples](/docs/resources/examples) page, or browse the [GitHub repository](https://github.com/mutativejs/travels). The official bindings are [use-travel](https://github.com/mutativejs/use-travel) for React and [zustand-travel](https://github.com/mutativejs/zustand-travel) for Zustand.
