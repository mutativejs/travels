# TravelPatches<P> (/zh/docs/api-reference/type-aliases/TravelPatches)

> **TravelPatches**\<`P`\> = `object`

Defined in: [src/type.ts:15](https://github.com/mutativejs/travels/blob/b5543aaea58ad69b9ce79acdf14d7ef5198f7876/src/type.ts#L15)

Forward/inverse JSON Patch groups. Retained-history APIs use one group per
entry; observer events use event-local transition groups. Persisted paths use
JSON Pointer strings or dense arrays of strings/non-negative integers.

## Type Parameters [#type-parameters]

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}

## Properties [#properties]

### inversePatches [#inversepatches]

> **inversePatches**: `Patches`\<`P`\>[]

Defined in: [src/type.ts:17](https://github.com/mutativejs/travels/blob/b5543aaea58ad69b9ce79acdf14d7ef5198f7876/src/type.ts#L17)

***

### patches [#patches]

> **patches**: `Patches`\<`P`\>[]

Defined in: [src/type.ts:16](https://github.com/mutativejs/travels/blob/b5543aaea58ad69b9ce79acdf14d7ef5198f7876/src/type.ts#L16)
