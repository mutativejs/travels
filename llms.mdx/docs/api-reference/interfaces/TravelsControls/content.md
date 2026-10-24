# TravelsControls<S, P> (/docs/api-reference/interfaces/TravelsControls)

Defined in: [src/type.ts:403](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L403)

## Extended by [#extended-by]

- [`ManualTravelsControls`](ManualTravelsControls.mdx)

## Type Parameters [#type-parameters]

### S [#s]

`S`

### P [#p]

`P` *extends* [`PatchesOption`](../type-aliases/PatchesOption.mdx) = \{ \}

## Properties [#properties]

### back() [#back]

> `readonly` **back**: (`amount?`) => `void`

Defined in: [src/type.ts:432](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L432)

Go back in the history

#### Parameters [#parameters]

##### amount? [#amount]

`number`

#### Returns [#returns]

`void`

***

### canBack() [#canback]

> `readonly` **canBack**: () => `boolean`

Defined in: [src/type.ts:448](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L448)

Check if it's possible to go back

#### Returns [#returns-1]

`boolean`

***

### canForward() [#canforward]

> `readonly` **canForward**: () => `boolean`

Defined in: [src/type.ts:452](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L452)

Check if it's possible to go forward

#### Returns [#returns-2]

`boolean`

***

### forward() [#forward]

> `readonly` **forward**: (`amount?`) => `void`

Defined in: [src/type.ts:436](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L436)

Go forward in the history

#### Parameters [#parameters-1]

##### amount? [#amount-1]

`number`

#### Returns [#returns-3]

`void`

***

### getHistory() [#gethistory]

> `readonly` **getHistory**: () => readonly `Immutable`\<`S`\>[]

Defined in: [src/type.ts:415](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L415)

Get the shared history cache.

#### Returns [#returns-4]

readonly `Immutable`\<`S`\>[]

#### Remarks [#remarks]

The returned array is Travels' shared internal cache. Use
[getHistorySnapshot](#gethistorysnapshot) when you need an array you can keep or change.

***

### getHistorySnapshot() [#gethistorysnapshot]

> `readonly` **getHistorySnapshot**: () => `S`[]

Defined in: [src/type.ts:419](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L419)

Get fully detached history snapshots that the caller owns.

#### Returns [#returns-5]

`S`[]

***

### go() [#go]

> `readonly` **go**: (`position`) => `void`

Defined in: [src/type.ts:444](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L444)

Go to a specific position in the history

#### Parameters [#parameters-2]

##### position [#position]

`number`

#### Returns [#returns-6]

`void`

***

### patches [#patches]

> `readonly` **patches**: [`ReadonlyTravelPatches`](../type-aliases/ReadonlyTravelPatches.mdx)\<`P`\>

Defined in: [src/type.ts:428](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L428)

Shared read-only view of the retained patch history.

#### Remarks [#remarks-1]

The view is cached and keeps its reference until history changes, so it
is cheap to read during rendering. Use `getPatches()` on the timeline for
a detached, caller-owned copy.

***

### position [#position-1]

> `readonly` **position**: `number`

Defined in: [src/type.ts:407](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L407)

The current position in the history

***

### reset() [#reset]

> `readonly` **reset**: () => `void`

Defined in: [src/type.ts:440](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L440)

Reset the history

#### Returns [#returns-7]

`void`
