# TravelJournalOptions<S, F, A, P> (/docs/api-reference/type-aliases/TravelJournalOptions)

> **TravelJournalOptions**\<`S`, `F`, `A`, `P`\> = `Omit`\<[`TravelsOptions`](TravelsOptions.mdx)\<`F`, `A`, `P`, `S`\>, `"mutable"`\> & `object`

Defined in: [src/createTravelJournal.ts:63](https://github.com/mutativejs/travels/blob/b5543aaea58ad69b9ce79acdf14d7ef5198f7876/src/createTravelJournal.ts#L63)

## Type Declaration [#type-declaration]

### apply [#apply]

> **apply**: [`TravelsControlledApply`](TravelsControlledApply.mdx)\<`S`, `P`\>

Apply a navigation transition through the external state owner.

## Type Parameters [#type-parameters]

### S [#s]

`S`

### F [#f]

`F` *extends* `boolean` = `false`

### A [#a]

`A` *extends* `boolean` = `true`

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}
