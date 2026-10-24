# ManualTravelsControls<S, P> (/docs/api-reference/interfaces/ManualTravelsControls)

Defined in: [src/type.ts:470](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L470)

## Extends [#extends]

- [`TravelsControls`](TravelsControls.mdx)\<`S`, `P`\>

## Type Parameters [#type-parameters]

### S [#s]

`S`

### P [#p]

`P` *extends* [`PatchesOption`](../type-aliases/PatchesOption.mdx) = \{ \}

## Properties [#properties]

### archive() [#archive]

> `readonly` **archive**: (`metadata?`) => `void`

Defined in: [src/type.ts:477](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L477)

Archive the current state

#### Parameters [#parameters]

##### metadata? [#metadata]

[`TravelMetadata`](../type-aliases/TravelMetadata.mdx)

#### Returns [#returns]

`void`

***

### back() [#back]

> `readonly` **back**: (`amount?`) => `void`

Defined in: [src/type.ts:432](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L432)

Go back in the history

#### Parameters [#parameters-1]

##### amount? [#amount]

`number`

#### Returns [#returns-1]

`void`

#### Inherited from [#inherited-from]

[`TravelsControls`](TravelsControls.mdx).[`back`](TravelsControls.mdx#back)

***

### canArchive() [#canarchive]

> `readonly` **canArchive**: () => `boolean`

Defined in: [src/type.ts:481](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L481)

Check if it's possible to archive the current state

#### Returns [#returns-2]

`boolean`

***

### canBack() [#canback]

> `readonly` **canBack**: () => `boolean`

Defined in: [src/type.ts:448](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L448)

Check if it's possible to go back

#### Returns [#returns-3]

`boolean`

#### Inherited from [#inherited-from-1]

[`TravelsControls`](TravelsControls.mdx).[`canBack`](TravelsControls.mdx#canback)

***

### canForward() [#canforward]

> `readonly` **canForward**: () => `boolean`

Defined in: [src/type.ts:452](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L452)

Check if it's possible to go forward

#### Returns [#returns-4]

`boolean`

#### Inherited from [#inherited-from-2]

[`TravelsControls`](TravelsControls.mdx).[`canForward`](TravelsControls.mdx#canforward)

***

### forward() [#forward]

> `readonly` **forward**: (`amount?`) => `void`

Defined in: [src/type.ts:436](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L436)

Go forward in the history

#### Parameters [#parameters-2]

##### amount? [#amount-1]

`number`

#### Returns [#returns-5]

`void`

#### Inherited from [#inherited-from-3]

[`TravelsControls`](TravelsControls.mdx).[`forward`](TravelsControls.mdx#forward)

***

### getHistory() [#gethistory]

> `readonly` **getHistory**: () => readonly `Immutable`\<`S`\>[]

Defined in: [src/type.ts:415](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L415)

Get the shared history cache.

#### Returns [#returns-6]

readonly `Immutable`\<`S`\>[]

#### Remarks [#remarks]

The returned array is Travels' shared internal cache. Use
[getHistorySnapshot](TravelsControls.mdx#gethistorysnapshot) when you need an array you can keep or change.

#### Inherited from [#inherited-from-4]

[`TravelsControls`](TravelsControls.mdx).[`getHistory`](TravelsControls.mdx#gethistory)

***

### getHistorySnapshot() [#gethistorysnapshot]

> `readonly` **getHistorySnapshot**: () => `S`[]

Defined in: [src/type.ts:419](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L419)

Get fully detached history snapshots that the caller owns.

#### Returns [#returns-7]

`S`[]

#### Inherited from [#inherited-from-5]

[`TravelsControls`](TravelsControls.mdx).[`getHistorySnapshot`](TravelsControls.mdx#gethistorysnapshot)

***

### go() [#go]

> `readonly` **go**: (`position`) => `void`

Defined in: [src/type.ts:444](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L444)

Go to a specific position in the history

#### Parameters [#parameters-3]

##### position [#position]

`number`

#### Returns [#returns-8]

`void`

#### Inherited from [#inherited-from-6]

[`TravelsControls`](TravelsControls.mdx).[`go`](TravelsControls.mdx#go)

***

### patches [#patches]

> `readonly` **patches**: [`ReadonlyTravelPatches`](../type-aliases/ReadonlyTravelPatches.mdx)\<`P`\>

Defined in: [src/type.ts:428](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L428)

Shared read-only view of the retained patch history.

#### Remarks [#remarks-1]

The view is cached and keeps its reference until history changes, so it
is cheap to read during rendering. Use `getPatches()` on the timeline for
a detached, caller-owned copy.

#### Inherited from [#inherited-from-7]

[`TravelsControls`](TravelsControls.mdx).[`patches`](TravelsControls.mdx#patches)

***

### position [#position-1]

> `readonly` **position**: `number`

Defined in: [src/type.ts:407](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L407)

The current position in the history

#### Inherited from [#inherited-from-8]

[`TravelsControls`](TravelsControls.mdx).[`position`](TravelsControls.mdx#position)

***

### reset() [#reset]

> `readonly` **reset**: () => `void`

Defined in: [src/type.ts:440](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L440)

Reset the history

#### Returns [#returns-9]

`void`

#### Inherited from [#inherited-from-9]

[`TravelsControls`](TravelsControls.mdx).[`reset`](TravelsControls.mdx#reset)
