# Navigation and Controls (/docs/guides/navigation-and-controls)

## Undo, redo, and jumps [#undo-redo-and-jumps]

```ts
travels.back();       // One entry
travels.back(3);      // Three entries
travels.forward();    // One entry
travels.forward(2);   // Two entries
travels.go(0);        // Retained window start
```

Use `canBack()` and `canForward()` to disable controls rather than relying on a click to discover the boundary. `getPosition()` returns the current cursor, and `getHistory().length - 1` describes the end of the retained window.

`back()` and `forward()` publish navigation as `go` events. Manual pending changes are implicitly archived as part of a successful navigation; Travels 3 publishes one settled `go` event rather than separate `archive` and `go` events.

## Reset and rebase are different [#reset-and-rebase-are-different]

- `reset()` returns to the current instance baseline.
- `rebase()` discards all history and makes current state the new baseline.

Both are timeline mutations and notify observers. Neither means “go to the oldest retained patch” in every situation; read [History Lifecycle](/docs/concepts/history-lifecycle) before exposing them as product actions.

## Narrow controls for components [#narrow-controls-for-components]

`getControls()` returns a cached, frozen facade suitable for buttons, menus, and component props:

```tsx
const controls = travels.getControls();

function HistoryButtons() {
  useSyncExternalStore(travels.subscribe, travels.getRevision);

  return (
    <>
      <button disabled={!controls.canBack()} onClick={() => controls.back()}>Undo</button>
      <button disabled={!controls.canForward()} onClick={() => controls.forward()}>Redo</button>
      <span>{controls.position}</span>
    </>
  );
}
```

The facade includes navigation, current position, read-only patch/history views, and `rebase()`. Manual timelines expose manual-aware control types. State-owning methods such as `setState()` are not included.

<Callout type="info" title="Re-render on revision, not only state identity">
`archive()` and `rebase()` can change controls without changing the current state reference. `getRevision()` advances once for every committed subscriber event, making it the correct snapshot for `useSyncExternalStore`.
</Callout>

## Shared views versus owned snapshots [#shared-views-versus-owned-snapshots]

| API | Ownership | Use it for |
| --- | --- | --- |
| `getHistory()` | Shared cached read-only array and state views | Immediate timeline rendering and reads |
| `getHistorySnapshot()` | Detached caller-owned states | Keeping, sorting, editing, worker transfer |
| `getPatches()` | Detached retained patch data | Owned copies, custom serialization, analysis |
| `controls.patches` | Shared cached read-only view | Render-time reads and memo dependencies |
| `getHistoryEntries()` | Patch entries with inverse patches and metadata | Undo menus, devtools, audit views |

Never cast away read-only types to modify a shared cache. Mutable timelines can also update an old shared history view in place; use detached snapshots when a historical value must remain unchanged.

## Metadata-driven undo menus [#metadata-driven-undo-menus]

```ts
const entries = travels.getHistoryEntries();
const current = travels.getPosition();
const previous = entries[current - 1];
const next = entries[current];

const undoLabel = previous?.metadata?.label ?? 'Undo';
const redoLabel = next?.metadata?.label ?? 'Redo';
```

Metadata indexes align with retained patch entries. When old history is trimmed, labels for trimmed entries disappear with them; derive menu text from the current retained entries rather than a separate unbounded UI list.
