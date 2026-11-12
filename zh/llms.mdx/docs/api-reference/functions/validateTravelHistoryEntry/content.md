# validateTravelHistoryEntry() (/zh/docs/api-reference/functions/validateTravelHistoryEntry)

> **validateTravelHistoryEntry**\<`P`\>(`entry`): \{ `error`: `string`; \} \| \{ `entry`: [`TravelHistoryEntry`](../type-aliases/TravelHistoryEntry.mdx)\<`P`\>; `error`: `null`; \}

Defined in: [src/persistence.ts:232](https://github.com/mutativejs/travels/blob/b5543aaea58ad69b9ce79acdf14d7ef5198f7876/src/persistence.ts#L232)

Validate and normalize one externally supplied forward/inverse patch pair.
Accessor-backed or inherited fields are rejected without being evaluated.
Use `assertTravelHistoryEntryRecordable()` to also apply the detached-value
rules of `recordPatches()`.

## Type Parameters [#type-parameters]

### P [#p]

`P` *extends* `object` = \{ \}

## Parameters [#parameters]

### entry [#entry]

`unknown`

## Returns [#returns]

\{ `error`: `string`; \} \| \{ `entry`: [`TravelHistoryEntry`](../type-aliases/TravelHistoryEntry.mdx)\<`P`\>; `error`: `null`; \}
