# State Requirements (/docs/concepts/state-requirements)

Travels’ durable contract is deliberately smaller than JavaScript’s object model. It applies to current state, values retained in old patches, patch paths, and custom history metadata—not just the object passed to `createTravels()`.

## Preferred durable data [#preferred-durable-data]

Use plain objects, dense arrays, strings, finite numbers other than `-0`, booleans, and `null`. Patch paths must be Travels-accepted JSON Pointer strings or dense arrays of strings and finite non-negative integer indexes.

```ts
const state = {
  title: 'Draft',
  published: false,
  updatedAt: '2026-10-24T12:00:00.000Z',
  revision: 0,
  blocks: [{ id: 'intro', text: 'Hello' }],
};
```

Durable containers have normal writable, enumerable data properties and standard prototypes. Avoid accessors, hidden properties, custom own properties, non-extensible containers, array holes, and built-in subclasses. Standard frozen containers are recognized when `enableAutoFreeze` is enabled, but they are not a general durable-data recommendation for caller-created input.

## Compatibility matrix [#compatibility-matrix]

| Value | Runtime behavior | JSON persistence | Recommendation |
| --- | --- | --- | --- |
| Plain object | Supported | Supported | Preferred |
| Dense array | Supported | Supported | Preferred |
| Sparse, extended, or subclassed array | Limited or rejected by durable checks | Shape is not preserved | Normalize to a dense plain array |
| String, boolean, `null` | Supported | Supported | Preferred |
| Finite number other than `-0` | Supported | Supported | Preferred |
| `NaN`, infinities, `-0` | Supported in some in-memory paths | Becomes `null` or `0` | Normalize first |
| `bigint` | Supported in some in-memory paths | `JSON.stringify()` throws | Encode as a string |
| `undefined` | Patchable in memory | Removed from objects; array semantics differ | Use `null` |
| `Date` | Cloneable, not durable | Becomes a string through JSON | Store a timestamp or ISO string |
| `Map` / `Set` | Rejected in both runtime modes | Rejected at snapshot boundaries | Use records or dense arrays |
| Class or custom/null prototype | Not durable | Prototype and methods are lost | Store plain data or IDs |
| Function or symbol | Not durable | Dropped by JSON | Keep behavior outside state |
| Circular or shared graph identity | Not durable | Circular fails; shared identity is duplicated | Normalize to IDs |
| DOM node, ref, observable body | Not durable | Not serializable | Store outside Travels |
| `WeakMap` / `WeakSet` | Not supported | Not serializable | Store outside Travels |

Primitive roots work, but mutable mode cannot mutate a primitive in place and falls back to immutable replacement. Wrap a primitive in an object when stable root identity matters.

## Normalize collections at the boundary [#normalize-collections-at-the-boundary]

```ts
type Item = { id: string; title: string };

type LegacyState = {
  itemsById: Map<string, Item>;
  selectedIds: Set<string>;
  updatedAt: Date;
};

function normalize(state: LegacyState) {
  return {
    itemsById: Object.fromEntries(state.itemsById),
    selectedIds: Array.from(state.selectedIds),
    updatedAt: state.updatedAt.toISOString(),
  };
}
```

Keep application-domain Map, Set, Date, or class views outside Travels and derive them from normalized state. Do not replay old collection-specific patch histories after conversion; materialize the authoritative current state, normalize it, and start a new baseline.

## Unsafe path keys [#unsafe-path-keys]

Mutative will not replay a change under a `__proto__` key or inside a value stored at a `constructor` key. Travels rejects such updates with `UNSUPPORTED_STATE`. Rename those keys before recording history. Root replacement has special handling in mutable and controlled-navigation paths; see the relevant guides before implementing in-place patch application.

## Static and runtime checks [#static-and-runtime-checks]

### Enforce the durable shape with `createPatchableTravels()` [#enforce-the-durable-shape-with-createpatchabletravels]

```ts
import { createPatchableTravels, type JsonValue } from 'travels';

const initial = {
  title: 'Draft',
  blocks: [] as Array<{ id: string; text: string }>,
} satisfies JsonValue;

const travels = createPatchableTravels(initial);
```

`PatchableInput<T>` performs a finite-depth, best-effort static check. TypeScript cannot prove every runtime property: `number` still includes `NaN`, infinities, and `-0`, and broad object types hide their contents. The strict factory therefore also validates its concrete initial value.

### Inspect a value directly [#inspect-a-value-directly]

```ts
import { findStateCompatibilityIssues } from 'travels';

const issues = findStateCompatibilityIssues(
  { createdAt: new Date(), selection: new Set(['a']) },
  { maxIssues: 20 }
);

for (const issue of issues) {
  console.warn(issue.code, issue.path, issue.message);
}
```

Issue codes identify circular/shared references, dates, functions, class instances, DOM nodes, Map/Set, bigint, non-JSON numbers, nonstandard array/object shapes, weak collections, symbols, and undefined values.

### Validate before or during serialization [#validate-before-or-during-serialization]

```ts
travels.assertPersistenceCompatible(); // Throws with path-specific diagnostics
const snapshot = travels.serialize({ strict: true });
```

`assertPersistenceCompatible()` checks current state, retained patch values and paths, and metadata. `serialize({ strict: true })` rejects any value that cannot round-trip through the documented JSON contract. Plain `serialize()` still returns detached data, but it does not normalize runtime-only values for you.

## Development diagnostics [#development-diagnostics]

Development builds scan initial and changed state plus retained patches and metadata for known hazards. `warnOnUnsupportedState: false` controls those warnings; it does not enable Map/Set or make invalid persistence safe. `onWarning` receives structured warning codes, and `onObserverError` isolates failures thrown by diagnostic or notification hooks.

The production package’s default entries avoid the full development scanner. Correctness boundaries such as strict serialization, restore validation, controlled patch validation, and Map/Set rejection remain explicit rather than depending on console warnings.
