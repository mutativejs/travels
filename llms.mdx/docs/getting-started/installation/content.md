# Installation (/docs/getting-started/installation)

## Requirements [#requirements]

- **Node.js 22 or newer** for server-side use and repository tooling.
- A **modern browser** with standard JavaScript and JSON APIs for browser applications.
- **Mutative 2** as Travels’ peer dependency.
- A bundler that defines `process.env.NODE_ENV`, or an explicit production Mutative browser build when loading ES modules without a bundler.

Travels ships ESM, CommonJS, UMD, and TypeScript declarations. The runtime support policy is documented under [Compatibility](/docs/reference/compatibility).

## Install the packages [#install-the-packages]

<Tabs items={["pnpm", "npm", "yarn"]}>
  <Tab value="pnpm">
    ```bash
    pnpm add travels mutative
    ```
  </Tab>
  <Tab value="npm">
    ```bash
    npm install travels mutative
    ```
  </Tab>
  <Tab value="yarn">
    ```bash
    yarn add travels mutative
    ```
  </Tab>
</Tabs>

Install matching major versions: `travels@3` requires `mutative@^2.0.0`. Mutative 1 is not supported.

## Verify the installation [#verify-the-installation]

Create a small timeline and make one reversible edit:

```ts
import { createTravels } from 'travels';

const travels = createTravels({ count: 0 });

travels.setState((draft) => {
  draft.count += 1;
});

console.log(travels.getState()); // { count: 1 }
travels.back();
console.log(travels.getState()); // { count: 0 }
travels.forward();
console.log(travels.getState()); // { count: 1 }
```

`createTravels()` is the public factory. The exported `Travels` value is a persistence namespace, not a constructor; use `isTravels()` rather than `instanceof Travels` when detecting timelines.

## Optional official bindings [#optional-official-bindings]

Use the core API directly when you need framework-agnostic ownership, persistence, or custom integration. For a more idiomatic binding, install the matching v3 package:

| Binding | Purpose | Travels compatibility |
| --- | --- | --- |
| [`use-travel`](https://github.com/mutativejs/use-travel) | React hooks and shared external-store timelines | `^3.0.0` |
| [`zustand-travel`](https://github.com/mutativejs/zustand-travel) | Zustand time-travel middleware | `^3.0.1` |

## Browser bundling note [#browser-bundling-note]

Mutative 2 targets ES2018 and selects development or production code through `process.env.NODE_ENV`. Vite, webpack, and comparable bundlers normally handle this. Without a bundler, use `mutative/dist/mutative.esm.production.min.mjs` or Mutative’s UMD build so the browser does not need a `process` global.

<Callout type="warn" title="Normalize durable state">
Plain objects, dense arrays, strings, finite numbers other than `-0`, booleans, and `null` form the durable state contract. Map and Set are rejected. Normalize dates, class instances, non-JSON numbers, functions, refs, and other runtime-only values before persistence. See [State Requirements](/docs/concepts/state-requirements).
</Callout>

## Next step [#next-step]

Follow the [Quick Start](/docs/getting-started/quick-start) to add subscriptions, metadata, undo/redo controls, and persistence.
