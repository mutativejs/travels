# TravelsEvent<S, P> (/docs/api-reference/type-aliases/TravelsEvent)

> **TravelsEvent**\<`S`, `P`\> = `object`

Defined in: [src/type.ts:297](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L297)

## Type Parameters [#type-parameters]

### S [#s]

`S`

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}

## Properties [#properties]

### historyLength [#historylength]

> `readonly` **historyLength**: `number`

Defined in: [src/type.ts:314](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L314)

Number of entries currently retained in history.

***

### metadata? [#metadata]

> `readonly` `optional` **metadata**: `Readonly`\<[`TravelMetadata`](TravelMetadata.mdx)\>

Defined in: [src/type.ts:316](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L316)

Lazily cloned, shallow-frozen metadata shared by this event's observers.

***

### patches [#patches]

> `readonly` **patches**: [`ReadonlyTravelPatches`](ReadonlyTravelPatches.mdx)\<`P`\>

Defined in: [src/type.ts:312](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L312)

Lazily materialized event-local patches that transform the previously
published state. Treat the shared snapshot as read-only.

***

### position [#position]

> `readonly` **position**: `number`

Defined in: [src/type.ts:307](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L307)

***

### state [#state]

> `readonly` **state**: [`ReadonlyState`](ReadonlyState.mdx)\<`S`\>

Defined in: [src/type.ts:306](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L306)

Borrowed live state view. Mutate state only through Travels operations.

***

### type [#type]

> `readonly` **type**: [`TravelsEventType`](TravelsEventType.mdx)

Defined in: [src/type.ts:304](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L304)

The committed operation. Handle unrecognized values in a `default` branch.
