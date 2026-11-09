# restoreTravelJournal() (/docs/api-reference/functions/restoreTravelJournal)

> **restoreTravelJournal**\<`S`, `F`, `A`, `P`\>(`snapshot`, `options`): [`TravelJournal`](../type-aliases/TravelJournal.mdx)\<`S`, `F`, `A`, `P`\>

Defined in: [src/createTravelJournal.ts:164](https://github.com/mutativejs/travels/blob/079554196672e49bffabc127e94f31a9218204d2/src/createTravelJournal.ts#L164)

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

[`TravelsSerializedHistory`](../type-aliases/TravelsSerializedHistory.mdx)\<`S`, `P`\>

### options [#options]

[`TravelJournalOptions`](../type-aliases/TravelJournalOptions.mdx)\<`S`, `F`, `A`, `P`\>

## Returns [#returns]

[`TravelJournal`](../type-aliases/TravelJournal.mdx)\<`S`, `F`, `A`, `P`\>
