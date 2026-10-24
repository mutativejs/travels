# TravelsControlledApply()<S, P> (/docs/api-reference/type-aliases/TravelsControlledApply)

> **TravelsControlledApply**\<`S`, `P`\> = (`transition`) => `S`

Defined in: [src/type.ts:76](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L76)

Synchronous executor used when another runtime owns the authoritative state.
Return that runtime's committed state after applying `transition.patches`.

## Type Parameters [#type-parameters]

### S [#s]

`S`

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}

## Parameters [#parameters]

### transition [#transition]

[`TravelsControlledTransition`](TravelsControlledTransition.mdx)\<`S`, `P`\>

## Returns [#returns]

`S`
