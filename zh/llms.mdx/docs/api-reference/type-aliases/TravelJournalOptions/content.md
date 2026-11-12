# TravelJournalOptions<S, F, A, P> (/travels/zh/llms.mdx/docs/api-reference/type-aliases/TravelJournalOptions/content.md)

> **TravelJournalOptions**\<`S`, `F`, `A`, `P`\> = `Omit`\<[`TravelsOptions`](/travels/zh/llms.mdx/docs/api-reference/type-aliases/TravelsOptions/content.md)\<`F`, `A`, `P`, `S`\>, `"mutable"`\> & `object`

Defined in: [src/createTravelJournal.ts:63](https://github.com/mutativejs/travels/blob/v3.0.1/src/createTravelJournal.ts#L63)

## Type Declaration [#type-declaration]

### apply [#apply]

> **apply**: [`TravelsControlledApply`](/travels/zh/llms.mdx/docs/api-reference/type-aliases/TravelsControlledApply/content.md)\<`S`, `P`\>

Apply a navigation transition through the external state owner.

## Type Parameters [#type-parameters]

### S [#s]

`S`

### F [#f]

`F` *extends* `boolean` = `false`

### A [#a]

`A` *extends* `boolean` = `true`

### P [#p]

`P` *extends* [`PatchesOption`](/travels/zh/llms.mdx/docs/api-reference/type-aliases/PatchesOption/content.md) = \{ \}
