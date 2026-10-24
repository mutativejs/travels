# Travels<S, _F, A, P> (/docs/api-reference/type-aliases/Travels)

> **Travels**\<`S`, `_F`, `A`, `P`\> = `object` & `A` *extends* `false` ? `object` : `object`

Defined in: [src/travels.ts:100](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/travels.ts#L100)

Public state-owning Travels capability surface.

Controlled journals expose `recordPatches()` through `TravelJournal`
instead. Manual archive methods exist only when `A` is `false`, keeping
unavailable operations out of both the type and runtime surface.

`_F` records the factory's `enableAutoFreeze` literal. No member depends on
it, but it keeps its position so `Travels<S, false>` cannot silently start
meaning a manual-archive timeline.

## Type Declaration [#type-declaration]

### getRevision() [#getrevision]

> `readonly` **getRevision**: () => `number`

Monotonic token for committed observable timeline transitions.

#### Returns [#returns]

`number`

### getState() [#getstate]

> `readonly` **getState**: () => `S`

Borrowed live state, the same value observers receive as `event.state`.

#### Returns [#returns-1]

`S`

#### Remarks [#remarks]

Typed as `S` so it can flow into stores and APIs that expect the state
type, but it must be treated as read-only: history patches apply to this
value, so mutating it outside Travels operations desynchronizes undo/redo.
In immutable mode its objects are also the values of retained patches, so
such a mutation rewrites the history that redo replays.
`enableAutoFreeze` freezes every state Travels produces after creation.

### mutable [#mutable]

> `readonly` **mutable**: `boolean`

### subscribe() [#subscribe]

> `readonly` **subscribe**: (`listener`) => () => `void`

#### Parameters [#parameters]

##### listener [#listener]

(`event`) => `void`

#### Returns [#returns-2]

> (): `void`

##### Returns [#returns-3]

`void`

### assertPersistenceCompatible() [#assertpersistencecompatible]

> **assertPersistenceCompatible**(): `void`

#### Returns [#returns-4]

`void`

### back() [#back]

> **back**(`amount?`): `void`

#### Parameters [#parameters-1]

##### amount? [#amount]

`number`

#### Returns [#returns-5]

`void`

### batch() [#batch]

#### Call Signature [#call-signature]

> **batch**\<`FN`\>(`metadata`, `fn`): `void`

##### Type Parameters [#type-parameters]

###### FN [#fn]

`FN` *extends* () => `unknown`

##### Parameters [#parameters-2]

###### metadata [#metadata]

[`TravelMetadata`](TravelMetadata.mdx)

###### fn [#fn-1]

`FN` & () => `unknown`

##### Returns [#returns-6]

`void`

#### Call Signature [#call-signature-1]

> **batch**\<`FN`\>(`fn`): `void`

##### Type Parameters [#type-parameters-1]

###### FN [#fn-2]

`FN` *extends* () => `unknown`

##### Parameters [#parameters-3]

###### fn [#fn-3]

`FN` & () => `unknown`

##### Returns [#returns-7]

`void`

### canBack() [#canback]

> **canBack**(): `boolean`

#### Returns [#returns-8]

`boolean`

### canForward() [#canforward]

> **canForward**(): `boolean`

#### Returns [#returns-9]

`boolean`

### forward() [#forward]

> **forward**(`amount?`): `void`

#### Parameters [#parameters-4]

##### amount? [#amount-1]

`number`

#### Returns [#returns-10]

`void`

### getControls() [#getcontrols]

> **getControls**(): `A` *extends* `true` ? [`RebasableTravelsControls`](RebasableTravelsControls.mdx)\<`S`, `P`\> : [`RebasableManualTravelsControls`](RebasableManualTravelsControls.mdx)\<`S`, `P`\>

#### Returns [#returns-11]

`A` *extends* `true` ? [`RebasableTravelsControls`](RebasableTravelsControls.mdx)\<`S`, `P`\> : [`RebasableManualTravelsControls`](RebasableManualTravelsControls.mdx)\<`S`, `P`\>

### getHistory() [#gethistory]

> **getHistory**(): readonly [`ReadonlyState`](ReadonlyState.mdx)\<`S`\>[]

#### Returns [#returns-12]

readonly [`ReadonlyState`](ReadonlyState.mdx)\<`S`\>[]

### getHistoryEntries() [#gethistoryentries]

> **getHistoryEntries**(): [`TravelHistoryEntry`](TravelHistoryEntry.mdx)\<`P`\>[]

#### Returns [#returns-13]

[`TravelHistoryEntry`](TravelHistoryEntry.mdx)\<`P`\>[]

### getHistorySnapshot() [#gethistorysnapshot]

> **getHistorySnapshot**(): `S`[]

#### Returns [#returns-14]

`S`[]

### getMetadata() [#getmetadata]

> **getMetadata**(): (`undefined` \| [`TravelMetadata`](TravelMetadata.mdx))[]

#### Returns [#returns-15]

(`undefined` \| [`TravelMetadata`](TravelMetadata.mdx))[]

### getPatches() [#getpatches]

> **getPatches**(): [`TravelPatches`](TravelPatches.mdx)\<`P`\>

#### Returns [#returns-16]

[`TravelPatches`](TravelPatches.mdx)\<`P`\>

### getPosition() [#getposition]

> **getPosition**(): `number`

#### Returns [#returns-17]

`number`

### go() [#go]

> **go**(`nextPosition`): `void`

#### Parameters [#parameters-5]

##### nextPosition [#nextposition]

`number`

#### Returns [#returns-18]

`void`

### pauseTracking() [#pausetracking]

> **pauseTracking**(): `void`

#### Returns [#returns-19]

`void`

### rebase() [#rebase]

> **rebase**(): `void`

#### Returns [#returns-20]

`void`

### replaceStateWithoutHistory() [#replacestatewithouthistory]

> **replaceStateWithoutHistory**\<`U`\>(`updater`): `void`

#### Type Parameters [#type-parameters-2]

##### U [#u]

`U`

#### Parameters [#parameters-6]

##### updater [#updater]

#### Returns [#returns-21]

`void`

### reset() [#reset]

> **reset**(): `void`

#### Returns [#returns-22]

`void`

### resumeTracking() [#resumetracking]

> **resumeTracking**(): `void`

#### Returns [#returns-23]

`void`

### serialize() [#serialize]

> **serialize**(`options?`): [`TravelsSerializedHistory`](TravelsSerializedHistory.mdx)\<`S`, `P`\>

#### Parameters [#parameters-7]

##### options? [#options]

[`TravelsSerializeOptions`](TravelsSerializeOptions.mdx)

#### Returns [#returns-24]

[`TravelsSerializedHistory`](TravelsSerializedHistory.mdx)\<`S`, `P`\>

### setState() [#setstate]

> **setState**\<`U`\>(`updater`, `metadata?`): `void`

#### Type Parameters [#type-parameters-3]

##### U [#u-1]

`U`

#### Parameters [#parameters-8]

##### updater [#updater-1]

##### metadata? [#metadata-1]

[`TravelMetadata`](TravelMetadata.mdx)

#### Returns [#returns-25]

`void`

### transaction() [#transaction]

#### Call Signature [#call-signature-2]

> **transaction**\<`FN`\>(`metadata`, `fn`): `void`

##### Type Parameters [#type-parameters-4]

###### FN [#fn-4]

`FN` *extends* () => `unknown`

##### Parameters [#parameters-9]

###### metadata [#metadata-2]

[`TravelMetadata`](TravelMetadata.mdx)

###### fn [#fn-5]

`FN` & () => `unknown`

##### Returns [#returns-26]

`void`

#### Call Signature [#call-signature-3]

> **transaction**\<`FN`\>(`fn`): `void`

##### Type Parameters [#type-parameters-5]

###### FN [#fn-6]

`FN` *extends* () => `unknown`

##### Parameters [#parameters-10]

###### fn [#fn-7]

`FN` & () => `unknown`

##### Returns [#returns-27]

`void`

## Type Parameters [#type-parameters-6]

### S [#s]

`S`

### _F [#_f]

`_F` *extends* `boolean` = `false`

### A [#a]

`A` *extends* `boolean` = `true`

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}
