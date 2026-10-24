# Framework Integrations (/docs/integrations)

Travels’ core does not depend on a UI framework. The right integration depends on who owns state and whether your reactive system expects a new reference or stable object identity.

## Choose an integration [#choose-an-integration]

| Framework or owner | Recommended starting point | History mode |
| --- | --- | --- |
| React | `useSyncExternalStore` or `use-travel@3` | Immutable |
| Vue composable | `shallowRef`/`ref` subscription | Immutable |
| Vue reactive store / Pinia | Pass the observed object directly | `mutable: true` |
| Zustand | `zustand-travel@3` or manual external-store sync | Immutable / binding-owned |
| MobX | Pass observable state directly | `mutable: true` |
| Form manager | Detached values with manual archive, or an external journal | Depends on owner |
| State machine / existing patch producer | `createTravelJournal()` | Externally owned |

<Cards>
  <Card title="React" href="/docs/integrations/react" description="External-store subscriptions, controls, and component ownership." />
  <Card title="Vue" href="/docs/integrations/vue" description="Immutable composables and reference-stable reactive state." />
  <Card title="Zustand" href="/docs/integrations/zustand" description="Official middleware and direct core integration." />
  <Card title="MobX and Pinia" href="/docs/integrations/mobx-pinia" description="Mutable timelines for identity-sensitive stores." />
  <Card title="Forms and External Stores" href="/docs/integrations/external-stores" description="Single-owner synchronization and delegated navigation." />
</Cards>

## Official v3 bindings [#official-v3-bindings]

- [`use-travel`](https://github.com/mutativejs/use-travel) provides React hooks and shared-store integration.
- [`zustand-travel`](https://github.com/mutativejs/zustand-travel) provides Zustand middleware.

Use `travels@^3.0.1` with either v3 binding: `use-travel@3` accepts `travels@^3.0.0`, and `zustand-travel@3` requires `travels@^3.0.1`. Both bindings support `mutative@^2.0.0`. Use matching majors so factory overloads, read-only views, and snapshot restoration share one contract.

## Integration invariants [#integration-invariants]

Regardless of framework:

1. Create one timeline per logical document or editing session.
2. Keep its identity stable for as long as subscribers depend on it.
3. Update through exactly one authoritative state path.
4. Re-render on timeline revision as well as state changes.
5. Unsubscribe when the owner is disposed.
6. Flush pending persistence before controlled shutdown points.

Runnable source examples are linked from [Examples](/docs/resources/examples).
