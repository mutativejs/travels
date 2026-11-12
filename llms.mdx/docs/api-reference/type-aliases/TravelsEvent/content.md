# TravelsEvent<S, P> (/travels/llms.mdx/docs/api-reference/type-aliases/TravelsEvent/content.md)

> **TravelsEvent**\<`S`, `P`\> = `object`

Defined in: [src/type.ts:297](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L297)

## Type Parameters [#type-parameters]

### S [#s]

`S`

### P [#p]

`P` *extends* [`PatchesOption`](/travels/llms.mdx/docs/api-reference/type-aliases/PatchesOption/content.md) = \{ \}

## Properties [#properties]

### historyLength [#historylength]

> `readonly` **historyLength**: `number`

Defined in: [src/type.ts:314](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L314)

Number of entries currently retained in history.

***

### metadata? [#metadata]

> `readonly` `optional` **metadata**: `Readonly`\<[`TravelMetadata`](/travels/llms.mdx/docs/api-reference/type-aliases/TravelMetadata/content.md)\>

Defined in: [src/type.ts:316](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L316)

Lazily cloned, shallow-frozen metadata shared by this event's observers.

***

### patches [#patches]

> `readonly` **patches**: [`ReadonlyTravelPatches`](/travels/llms.mdx/docs/api-reference/type-aliases/ReadonlyTravelPatches/content.md)\<`P`\>

Defined in: [src/type.ts:312](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L312)

Lazily materialized event-local patches that transform the previously
published state. Treat the shared snapshot as read-only.

***

### position [#position]

> `readonly` **position**: `number`

Defined in: [src/type.ts:307](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L307)

***

### state [#state]

> `readonly` **state**: [`ReadonlyState`](/travels/llms.mdx/docs/api-reference/type-aliases/ReadonlyState/content.md)\<`S`\>

Defined in: [src/type.ts:306](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L306)

Borrowed live state view. Mutate state only through Travels operations.

***

### type [#type]

> `readonly` **type**: [`TravelsEventType`](/travels/llms.mdx/docs/api-reference/type-aliases/TravelsEventType/content.md)

Defined in: [src/type.ts:304](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L304)

The committed operation. Handle unrecognized values in a `default` branch.
