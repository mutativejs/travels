# RestoreTravelsOptions<S, F, A, P> (/docs/api-reference/type-aliases/RestoreTravelsOptions)

> **RestoreTravelsOptions**\<`S`, `F`, `A`, `P`\> = [`TravelsOptions`](TravelsOptions.mdx)\<`F`, `A`, `P`, `S`\> & `object`

Defined in: [src/restoreTravels.ts:21](https://github.com/mutativejs/travels/blob/b5543aaea58ad69b9ce79acdf14d7ef5198f7876/src/restoreTravels.ts#L21)

Options accepted by `restoreTravels()`.

The restored state is detached from the snapshot. A mutable timeline can
instead restore into an existing live root, such as a MobX, Vue, or Pinia
store object: Travels overwrites `target` in place with the snapshot state
and keeps that reference as its state.

## Type Declaration [#type-declaration]

### target? [#target]

> `optional` **target**: `S`

Live mutable root that receives the restored state in place. Requires
`mutable: true` and the same plain object or array root kind as the
snapshot state.

### validation? [#validation]

> `optional` **validation**: [`TravelsHistoryValidationMode`](TravelsHistoryValidationMode.mdx)

Select semantic replay to verify the complete snapshot before restoring.

## Type Parameters [#type-parameters]

### S [#s]

`S`

### F [#f]

`F` *extends* `boolean`

### A [#a]

`A` *extends* `boolean`

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}
