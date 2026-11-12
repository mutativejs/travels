# restoreTravelJournal() (/travels/zh/llms.mdx/docs/api-reference/functions/restoreTravelJournal/content.md)

> **restoreTravelJournal**\<`S`, `F`, `A`, `P`\>(`snapshot`, `options`): [`TravelJournal`](/travels/zh/llms.mdx/docs/api-reference/type-aliases/TravelJournal/content.md)\<`S`, `F`, `A`, `P`\>

Defined in: [src/createTravelJournal.ts:164](https://github.com/mutativejs/travels/blob/v3.0.1/src/createTravelJournal.ts#L164)

Restore an externally owned journal from one complete persisted snapshot.

## Type Parameters [#type-parameters]

### S [#s]

`S`

### F [#f]

`F` *extends* `boolean` = `false`

### A [#a]

`A` *extends* `boolean` = `true`

### P [#p]

`P` *extends* `object` = \{ \}

## Parameters [#parameters]

### snapshot [#snapshot]

[`TravelsSerializedHistory`](/travels/zh/llms.mdx/docs/api-reference/type-aliases/TravelsSerializedHistory/content.md)\<`S`, `P`\>

### options [#options]

[`TravelJournalOptions`](/travels/zh/llms.mdx/docs/api-reference/type-aliases/TravelJournalOptions/content.md)\<`S`, `F`, `A`, `P`\>

## Returns [#returns]

[`TravelJournal`](/travels/zh/llms.mdx/docs/api-reference/type-aliases/TravelJournal/content.md)\<`S`, `F`, `A`, `P`\>
