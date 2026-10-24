# createTravels() (/docs/api-reference/functions/createTravels)

Create a new Travels instance

## Call Signature [#call-signature]

> **createTravels**\<`S`, `F`, `P`\>(`initialState`, `options?`): `object`

Defined in: [src/createTravels.ts:8](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/createTravels.ts#L8)

Create a new Travels instance with auto archive mode

### Type Parameters [#type-parameters]

#### S [#s]

`S`

#### F [#f]

`F` *extends* `boolean` = `false`

#### P [#p]

`P` *extends* `object` = \{ \}

### Parameters [#parameters]

#### initialState [#initialstate]

`S`

#### options? [#options]

`Omit`\<[`TravelsOptions`](../type-aliases/TravelsOptions.mdx)\<`F`, `true`, `P`, `S`\>, `"autoArchive"`\> & `object`

### Returns [#returns]

#### getRevision() [#getrevision]

> `readonly` **getRevision**: () => `number`

Monotonic token for committed observable timeline transitions.

##### Returns [#returns-1]

`number`

#### getState() [#getstate]

> `readonly` **getState**: () => `S`

Borrowed live state, the same value observers receive as `event.state`.

##### Returns [#returns-2]

`S`

##### Remarks [#remarks]

Typed as `S` so it can flow into stores and APIs that expect the state
type, but it must be treated as read-only: history patches apply to this
value, so mutating it outside Travels operations desynchronizes undo/redo.
In immutable mode its objects are also the values of retained patches, so
such a mutation rewrites the history that redo replays.
`enableAutoFreeze` freezes every state Travels produces after creation.

#### mutable [#mutable]

> `readonly` **mutable**: `boolean`

#### subscribe() [#subscribe]

> `readonly` **subscribe**: (`listener`) => () => `void`

##### Parameters [#parameters-1]

###### listener [#listener]

(`event`) => `void`

##### Returns [#returns-3]

> (): `void`

###### Returns [#returns-4]

`void`

#### assertPersistenceCompatible() [#assertpersistencecompatible]

> **assertPersistenceCompatible**(): `void`

##### Returns [#returns-5]

`void`

#### back() [#back]

> **back**(`amount?`): `void`

##### Parameters [#parameters-2]

###### amount? [#amount]

`number`

##### Returns [#returns-6]

`void`

#### batch() [#batch]

##### Call Signature [#call-signature-1]

> **batch**\<`FN`\>(`metadata`, `fn`): `void`

###### Type Parameters [#type-parameters-1]

###### FN [#fn]

`FN` *extends* () => `unknown`

###### Parameters [#parameters-3]

###### metadata [#metadata]

[`TravelMetadata`](../type-aliases/TravelMetadata.mdx)

###### fn [#fn-1]

`FN` & () => `unknown`

###### Returns [#returns-7]

`void`

##### Call Signature [#call-signature-2]

> **batch**\<`FN`\>(`fn`): `void`

###### Type Parameters [#type-parameters-2]

###### FN [#fn-2]

`FN` *extends* () => `unknown`

###### Parameters [#parameters-4]

###### fn [#fn-3]

`FN` & () => `unknown`

###### Returns [#returns-8]

`void`

#### canBack() [#canback]

> **canBack**(): `boolean`

##### Returns [#returns-9]

`boolean`

#### canForward() [#canforward]

> **canForward**(): `boolean`

##### Returns [#returns-10]

`boolean`

#### forward() [#forward]

> **forward**(`amount?`): `void`

##### Parameters [#parameters-5]

###### amount? [#amount-1]

`number`

##### Returns [#returns-11]

`void`

#### getControls() [#getcontrols]

> **getControls**(): [`RebasableTravelsControls`](../type-aliases/RebasableTravelsControls.mdx)\<`S`, `P`\>

##### Returns [#returns-12]

[`RebasableTravelsControls`](../type-aliases/RebasableTravelsControls.mdx)\<`S`, `P`\>

#### getHistory() [#gethistory]

> **getHistory**(): readonly `Immutable`\<`S`\>[]

##### Returns [#returns-13]

readonly `Immutable`\<`S`\>[]

#### getHistoryEntries() [#gethistoryentries]

> **getHistoryEntries**(): [`TravelHistoryEntry`](../type-aliases/TravelHistoryEntry.mdx)\<`P`\>[]

##### Returns [#returns-14]

[`TravelHistoryEntry`](../type-aliases/TravelHistoryEntry.mdx)\<`P`\>[]

#### getHistorySnapshot() [#gethistorysnapshot]

> **getHistorySnapshot**(): `S`[]

##### Returns [#returns-15]

`S`[]

#### getMetadata() [#getmetadata]

> **getMetadata**(): (`undefined` \| [`TravelMetadata`](../type-aliases/TravelMetadata.mdx))[]

##### Returns [#returns-16]

(`undefined` \| [`TravelMetadata`](../type-aliases/TravelMetadata.mdx))[]

#### getPatches() [#getpatches]

> **getPatches**(): [`TravelPatches`](../type-aliases/TravelPatches.mdx)\<`P`\>

##### Returns [#returns-17]

[`TravelPatches`](../type-aliases/TravelPatches.mdx)\<`P`\>

#### getPosition() [#getposition]

> **getPosition**(): `number`

##### Returns [#returns-18]

`number`

#### go() [#go]

> **go**(`nextPosition`): `void`

##### Parameters [#parameters-6]

###### nextPosition [#nextposition]

`number`

##### Returns [#returns-19]

`void`

#### pauseTracking() [#pausetracking]

> **pauseTracking**(): `void`

##### Returns [#returns-20]

`void`

#### rebase() [#rebase]

> **rebase**(): `void`

##### Returns [#returns-21]

`void`

#### replaceStateWithoutHistory() [#replacestatewithouthistory]

> **replaceStateWithoutHistory**\<`U`\>(`updater`): `void`

##### Type Parameters [#type-parameters-3]

###### U [#u]

`U`

##### Parameters [#parameters-7]

###### updater [#updater]

##### Returns [#returns-22]

`void`

#### reset() [#reset]

> **reset**(): `void`

##### Returns [#returns-23]

`void`

#### resumeTracking() [#resumetracking]

> **resumeTracking**(): `void`

##### Returns [#returns-24]

`void`

#### serialize() [#serialize]

> **serialize**(`options?`): [`TravelsSerializedHistory`](../type-aliases/TravelsSerializedHistory.mdx)\<`S`, `P`\>

##### Parameters [#parameters-8]

###### options? [#options-1]

[`TravelsSerializeOptions`](../type-aliases/TravelsSerializeOptions.mdx)

##### Returns [#returns-25]

[`TravelsSerializedHistory`](../type-aliases/TravelsSerializedHistory.mdx)\<`S`, `P`\>

#### setState() [#setstate]

> **setState**\<`U`\>(`updater`, `metadata?`): `void`

##### Type Parameters [#type-parameters-4]

###### U [#u-1]

`U`

##### Parameters [#parameters-9]

###### updater [#updater-1]

###### metadata? [#metadata-1]

[`TravelMetadata`](../type-aliases/TravelMetadata.mdx)

##### Returns [#returns-26]

`void`

#### transaction() [#transaction]

##### Call Signature [#call-signature-3]

> **transaction**\<`FN`\>(`metadata`, `fn`): `void`

###### Type Parameters [#type-parameters-5]

###### FN [#fn-4]

`FN` *extends* () => `unknown`

###### Parameters [#parameters-10]

###### metadata [#metadata-2]

[`TravelMetadata`](../type-aliases/TravelMetadata.mdx)

###### fn [#fn-5]

`FN` & () => `unknown`

###### Returns [#returns-27]

`void`

##### Call Signature [#call-signature-4]

> **transaction**\<`FN`\>(`fn`): `void`

###### Type Parameters [#type-parameters-6]

###### FN [#fn-6]

`FN` *extends* () => `unknown`

###### Parameters [#parameters-11]

###### fn [#fn-7]

`FN` & () => `unknown`

###### Returns [#returns-28]

`void`

## Call Signature [#call-signature-5]

> **createTravels**\<`S`, `F`, `P`\>(`initialState`, `options`): [`Travels`](../type-aliases/Travels.mdx)\<`S`, `F`, `false`, `P`\>

Defined in: [src/createTravels.ts:22](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/createTravels.ts#L22)

Create a new Travels instance with manual archive mode

### Type Parameters [#type-parameters-7]

#### S [#s-1]

`S`

#### F [#f-1]

`F` *extends* `boolean` = `false`

#### P [#p-1]

`P` *extends* `object` = \{ \}

### Parameters [#parameters-12]

#### initialState [#initialstate-1]

`S`

#### options [#options-2]

`Omit`\<[`TravelsOptions`](../type-aliases/TravelsOptions.mdx)\<`F`, `false`, `P`, `S`\>, `"autoArchive"`\> & `object`

### Returns [#returns-29]

[`Travels`](../type-aliases/Travels.mdx)\<`S`, `F`, `false`, `P`\>

## Call Signature [#call-signature-6]

> **createTravels**\<`S`, `F`, `A`, `P`\>(`initialState`, `options`): [`Travels`](../type-aliases/Travels.mdx)\<`S`, `F`, `A`, `P`\>

Defined in: [src/createTravels.ts:37](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/createTravels.ts#L37)

Create a new Travels instance when the archive mode is selected dynamically
or forwarded through a generic adapter.

### Type Parameters [#type-parameters-8]

#### S [#s-2]

`S`

#### F [#f-2]

`F` *extends* `boolean` = `false`

#### A [#a]

`A` *extends* `boolean` = `true`

#### P [#p-2]

`P` *extends* `object` = \{ \}

### Parameters [#parameters-13]

#### initialState [#initialstate-2]

`S`

#### options [#options-3]

[`TravelsOptions`](../type-aliases/TravelsOptions.mdx)\<`F`, `A`, `P`, `S`\>

### Returns [#returns-30]

[`Travels`](../type-aliases/Travels.mdx)\<`S`, `F`, `A`, `P`\>
