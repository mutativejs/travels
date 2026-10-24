# Examples (/docs/resources/examples)

The repository contains small examples that exercise the public API without hiding the integration boundary behind a demo framework. Use them alongside the focused guides in this documentation.

## Core examples [#core-examples]

| Example | What it demonstrates |
| --- | --- |
| [Basic usage](https://github.com/mutativejs/travels/blob/main/examples/basic.ts) | Create a timeline, update state, navigate, and subscribe. |
| [Manual archive](https://github.com/mutativejs/travels/blob/main/examples/manual-archive.ts) | Group pending updates into application-defined undo steps. |
| [Persistence](https://github.com/mutativejs/travels/blob/main/examples/persistence.ts) | Serialize, deserialize, and restore a versioned timeline. |
| [Local-first persistence](https://github.com/mutativejs/travels/blob/main/examples/local-first-persistence.ts) | A durable editing flow built around stored snapshots. |
| [Persistence adapters](https://github.com/mutativejs/travels/blob/main/examples/persistence-adapters.ts) | Storage-oriented adapter patterns and recovery. |

## Framework integrations [#framework-integrations]

| Example | Framework or pattern |
| --- | --- |
| [React integration](https://github.com/mutativejs/travels/blob/main/examples/react-integration.tsx) | `useSyncExternalStore`, revisions, state, and controls. |
| [Vue integration](https://github.com/mutativejs/travels/blob/main/examples/vue.ts) | Vue state binding and undo/redo. |
| [Zustand integration](https://github.com/mutativejs/travels/blob/main/examples/zustand.ts) | Immutable timeline synchronization with a store. |
| [MobX integration](https://github.com/mutativejs/travels/blob/main/examples/mobx.ts) | Reference-stable mutable history. |
| [Pinia integration](https://github.com/mutativejs/travels/blob/main/examples/pinia.ts) | A setup store with mutable Travels state. |

## Editing applications [#editing-applications]

- [Form builder](https://github.com/mutativejs/travels/blob/main/examples/form-builder.ts): manual history boundaries around structured form edits.
- [Canvas editor](https://github.com/mutativejs/travels/blob/main/examples/canvas-editor.ts): grouped visual operations and metadata-driven history.
- [Vite application](https://github.com/mutativejs/travels/tree/main/examples/travels-vite): a runnable browser consumer of the package.

You can also try the [Travels Counter Demo](https://codesandbox.io/p/sandbox/travels-vanilla-ts-wzdd62) on CodeSandbox.

## Run repository checks [#run-repository-checks]

From the repository root:

```bash
corepack enable
pnpm install
pnpm run test:examples
pnpm run test:types
pnpm run test
```

The examples are included in the TypeScript example checks. When adapting one, keep the core invariants: one authoritative update path, synchronous timeline callbacks, read-only shared views, and semantic validation for unverified persisted history.

## Related documentation [#related-documentation]

<Cards>
  <Card title="Quick Start" href="/docs/getting-started/quick-start" />
  <Card title="Framework Integrations" href="/docs/integrations" />
  <Card title="Storage Adapters" href="/docs/persistence/storage-adapters" />
  <Card title="Contributing" href="/docs/resources/contributing" />
</Cards>
