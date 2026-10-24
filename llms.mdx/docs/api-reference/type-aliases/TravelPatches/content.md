# TravelPatches<P> (/docs/api-reference/type-aliases/TravelPatches)

> **TravelPatches**\<`P`\> = `object`

Defined in: [src/type.ts:15](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L15)

Forward/inverse JSON Patch groups. Retained-history APIs use one group per
entry; observer events use event-local transition groups. Persisted paths use
JSON Pointer strings or dense arrays of strings/non-negative integers.

## Type Parameters [#type-parameters]

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}

## Properties [#properties]

### inversePatches [#inversepatches]

> **inversePatches**: `Patches`\<`P`\>[]

Defined in: [src/type.ts:17](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L17)

***

### patches [#patches]

> **patches**: `Patches`\<`P`\>[]

Defined in: [src/type.ts:16](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L16)
