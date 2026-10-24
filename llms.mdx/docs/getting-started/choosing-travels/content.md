# Choosing Travels (/docs/getting-started/choosing-travels)

Travels is designed around a specific trade-off: spend work generating and applying patches to reduce retained history size and make complete timelines practical to persist. It is not intended to win every update-latency benchmark.

## Choose by workload [#choose-by-workload]

| Scenario | Recommended approach |
| --- | --- |
| Large state with localized edits | Travels: retained patches usually avoid repeated full-state copies |
| Long history that must survive reloads | Travels: one versioned snapshot includes state and history |
| Replayable operation logs or undo metadata | Travels: entries contain forward/inverse patches and metadata |
| Tiny state and a handful of local-only entries | A snapshot stack, Redux-undo, or Zundo may be simpler and faster |
| Replace most or all state on every edit | Measure both approaches; patches can approach snapshot cost |
| Collaborative conflict merging and concurrent users | A CRDT/OT system; Travels does not resolve conflicts by itself |

## Compare the costs [#compare-the-costs]

A snapshot history pays a state-copy cost for every entry and usually has cheap navigation. A patch history pays patch-generation and patch-application costs, while retaining only the changed operations for localized updates.

With Travels, immutable updates also use Mutative’s structural sharing. “Patch-based” does not mean every retained state is deep-cloned, and “smaller history” does not imply the lowest possible `setState()` latency.

Measure your actual workload across four dimensions:

1. Update latency and throughput.
2. Undo/redo and transaction latency.
3. Retained and serialized history size.
4. Save, restore, and semantic-validation cost.

The repository’s [benchmark suite](https://github.com/mutativejs/travels/tree/main/benchmarks) separates these concerns rather than presenting a single universal winner.

## Choose an ownership model [#choose-an-ownership-model]

### `createTravels()` [#createtravels]

Use this when Travels should receive and commit updates. It is the default choice for vanilla state, reducer-style state, and most new integrations.

- Immutable mode returns new state references.
- Mutable mode updates a live object for MobX, Vue, Pinia, and similar reactive owners.
- `setState()`, transactions, tracking controls, and `getControls()` are available.

### `createTravelJournal()` [#createtraveljournal]

Use this when another runtime already produces `nextState`, `patches`, and `inversePatches`. The external owner remains authoritative.

- Record an existing commit with `recordPatches()`.
- Apply undo/redo through the required synchronous `apply` callback.
- Avoid generating the same patches twice.
- Do not feed delegated navigation back into `recordPatches()`.

See the [Controlled Journal Guide](/docs/guides/controlled-journal) for the commit and failure boundaries.

## Choose an archive mode [#choose-an-archive-mode]

- **Automatic (`autoArchive: true`)**: each effective `setState()` call is one undo step. This is the default and the right starting point for most apps.
- **Manual (`autoArchive: false`)**: updates affect current state immediately, while `archive()` groups pending work into an entry. Use it for blur commits, drag gestures, or application-defined transactions.

For a single atomic operation with one final observer event, prefer `transaction()` over manually coordinating an archive.

## A practical decision checklist [#a-practical-decision-checklist]

Travels is likely a strong fit when most answers are yes:

- Is undo/redo a product feature rather than a debugging convenience?
- Are updates usually smaller than the complete state?
- Does history need metadata, persistence, or replay?
- Would a versioned snapshot simplify local-first storage?
- Do you need both immutable and reference-stable reactive integrations?

If your only requirement is a five-entry counter history in one component, a small local stack is probably enough.
