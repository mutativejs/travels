# validateTravelHistoryEntry() (/docs/api-reference/functions/validateTravelHistoryEntry)

> **validateTravelHistoryEntry**\<`P`\>(`entry`): \{ `error`: `string`; \} \| \{ `entry`: [`TravelHistoryEntry`](../type-aliases/TravelHistoryEntry.mdx)\<`P`\>; `error`: `null`; \}

Defined in: [src/persistence.ts:232](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/persistence.ts#L232)

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
