# ManualTravelsControls<S, P> (/travels/llms.mdx/docs/api-reference/interfaces/ManualTravelsControls/content.md)

Defined in: [src/type.ts:470](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L470)

## Extends [#extends]

- [`TravelsControls`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md)\<`S`, `P`\>

## Type Parameters [#type-parameters]

### S [#s]

`S`

### P [#p]

`P` *extends* [`PatchesOption`](/travels/llms.mdx/docs/api-reference/type-aliases/PatchesOption/content.md) = \{ \}

## Properties [#properties]

### archive() [#archive]

> `readonly` **archive**: (`metadata?`) => `void`

Defined in: [src/type.ts:477](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L477)

Archive the current state

#### Parameters [#parameters]

##### metadata? [#metadata]

[`TravelMetadata`](/travels/llms.mdx/docs/api-reference/type-aliases/TravelMetadata/content.md)

#### Returns [#returns]

`void`

***

### back() [#back]

> `readonly` **back**: (`amount?`) => `void`

Defined in: [src/type.ts:432](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L432)

Go back in the history

#### Parameters [#parameters-1]

##### amount? [#amount]

`number`

#### Returns [#returns-1]

`void`

#### Inherited from [#inherited-from]

[`TravelsControls`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md).[`back`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md#back)

***

### canArchive() [#canarchive]

> `readonly` **canArchive**: () => `boolean`

Defined in: [src/type.ts:481](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L481)

Check if it's possible to archive the current state

#### Returns [#returns-2]

`boolean`

***

### canBack() [#canback]

> `readonly` **canBack**: () => `boolean`

Defined in: [src/type.ts:448](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L448)

Check if it's possible to go back

#### Returns [#returns-3]

`boolean`

#### Inherited from [#inherited-from-1]

[`TravelsControls`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md).[`canBack`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md#canback)

***

### canForward() [#canforward]

> `readonly` **canForward**: () => `boolean`

Defined in: [src/type.ts:452](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L452)

Check if it's possible to go forward

#### Returns [#returns-4]

`boolean`

#### Inherited from [#inherited-from-2]

[`TravelsControls`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md).[`canForward`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md#canforward)

***

### forward() [#forward]

> `readonly` **forward**: (`amount?`) => `void`

Defined in: [src/type.ts:436](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L436)

Go forward in the history

#### Parameters [#parameters-2]

##### amount? [#amount-1]

`number`

#### Returns [#returns-5]

`void`

#### Inherited from [#inherited-from-3]

[`TravelsControls`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md).[`forward`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md#forward)

***

### getHistory() [#gethistory]

> `readonly` **getHistory**: () => readonly `Immutable`\<`S`\>[]

Defined in: [src/type.ts:415](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L415)

Get the shared history cache.

#### Returns [#returns-6]

readonly `Immutable`\<`S`\>[]

#### Remarks [#remarks]

The returned array is Travels' shared internal cache. Use
[getHistorySnapshot](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md#gethistorysnapshot) when you need an array you can keep or change.

#### Inherited from [#inherited-from-4]

[`TravelsControls`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md).[`getHistory`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md#gethistory)

***

### getHistorySnapshot() [#gethistorysnapshot]

> `readonly` **getHistorySnapshot**: () => `S`[]

Defined in: [src/type.ts:419](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L419)

Get fully detached history snapshots that the caller owns.

#### Returns [#returns-7]

`S`[]

#### Inherited from [#inherited-from-5]

[`TravelsControls`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md).[`getHistorySnapshot`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md#gethistorysnapshot)

***

### go() [#go]

> `readonly` **go**: (`position`) => `void`

Defined in: [src/type.ts:444](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L444)

Go to a specific position in the history

#### Parameters [#parameters-3]

##### position [#position]

`number`

#### Returns [#returns-8]

`void`

#### Inherited from [#inherited-from-6]

[`TravelsControls`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md).[`go`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md#go)

***

### patches [#patches]

> `readonly` **patches**: [`ReadonlyTravelPatches`](/travels/llms.mdx/docs/api-reference/type-aliases/ReadonlyTravelPatches/content.md)\<`P`\>

Defined in: [src/type.ts:428](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L428)

Shared read-only view of the retained patch history.

#### Remarks [#remarks-1]

The view is cached and keeps its reference until history changes, so it
is cheap to read during rendering. Use `getPatches()` on the timeline for
a detached, caller-owned copy.

#### Inherited from [#inherited-from-7]

[`TravelsControls`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md).[`patches`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md#patches)

***

### position [#position-1]

> `readonly` **position**: `number`

Defined in: [src/type.ts:407](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L407)

The current position in the history

#### Inherited from [#inherited-from-8]

[`TravelsControls`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md).[`position`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md#position)

***

### reset() [#reset]

> `readonly` **reset**: () => `void`

Defined in: [src/type.ts:440](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L440)

Reset the history

#### Returns [#returns-9]

`void`

#### Inherited from [#inherited-from-9]

[`TravelsControls`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md).[`reset`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md#reset)
