# TravelsControlledApply()<S, P> (/zh/docs/api-reference/type-aliases/TravelsControlledApply)

> **TravelsControlledApply**\<`S`, `P`\> = (`transition`) => `S`

Defined in: [src/type.ts:76](https://github.com/mutativejs/travels/blob/079554196672e49bffabc127e94f31a9218204d2/src/type.ts#L76)

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
