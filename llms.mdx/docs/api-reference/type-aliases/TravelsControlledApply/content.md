# TravelsControlledApply()<S, P> (/travels/llms.mdx/docs/api-reference/type-aliases/TravelsControlledApply/content.md)

> **TravelsControlledApply**\<`S`, `P`\> = (`transition`) => `S`

Defined in: [src/type.ts:76](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L76)

Synchronous executor used when another runtime owns the authoritative state.
Return that runtime's committed state after applying `transition.patches`.

## Type Parameters [#type-parameters]

### S [#s]

`S`

### P [#p]

`P` *extends* [`PatchesOption`](/travels/llms.mdx/docs/api-reference/type-aliases/PatchesOption/content.md) = \{ \}

## Parameters [#parameters]

### transition [#transition]

[`TravelsControlledTransition`](/travels/llms.mdx/docs/api-reference/type-aliases/TravelsControlledTransition/content.md)\<`S`, `P`\>

## Returns [#returns]

`S`
