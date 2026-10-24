# TravelJournal<S, F, A, P> (/docs/api-reference/type-aliases/TravelJournal)

> **TravelJournal**\<`S`, `F`, `A`, `P`\> = `Readonly`\<`Pick`\<[`Travels`](Travels.mdx)\<`S`, `F`, `A`, `P`\>, `"subscribe"` \| `"getState"` \| `"getRevision"` \| `"getHistory"` \| `"getHistorySnapshot"` \| `"go"` \| `"back"` \| `"forward"` \| `"reset"` \| `"rebase"` \| `"canBack"` \| `"canForward"` \| `"getPosition"` \| `"getPatches"` \| `"serialize"` \| `"assertPersistenceCompatible"` \| `"getMetadata"` \| `"getHistoryEntries"`\> & `object` & `A` *extends* `false` ? `object` : `object`\>

Defined in: [src/createTravelJournal.ts:27](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/createTravelJournal.ts#L27)

Public surface for a timeline whose state is owned by another runtime.

State-owning methods such as `setState()`, transactions, tracking controls,
and `getControls()` are intentionally excluded. External commits enter
through `recordPatches()`; navigation and reset leave through `apply`.

## Type Parameters [#type-parameters]

### S [#s]

`S`

### F [#f]

`F` *extends* `boolean` = `false`

### A [#a]

`A` *extends* `boolean` = `true`

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}
