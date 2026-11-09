# ReadonlyTravelPatch<P> (/docs/api-reference/type-aliases/ReadonlyTravelPatch)

> **ReadonlyTravelPatch**\<`P`\> = `Omit`\<`Readonly`\<`Patch`\<`P`\>\>, `"path"`\> & `object`

Defined in: [src/type.ts:25](https://github.com/mutativejs/travels/blob/079554196672e49bffabc127e94f31a9218204d2/src/type.ts#L25)

A shallow read-only patch operation exposed through a shared observer event.
Object-valued patch payloads are event-local but remain shared by observers
handling that event.

## Type Declaration [#type-declaration]

### path [#path]

> `readonly` **path**: `Patch`\<`P`\>\[`"path"`\] *extends* readonly infer Segment[] ? readonly `Segment`[] : `Patch`\<`P`\>\[`"path"`\]

## Type Parameters [#type-parameters]

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}
