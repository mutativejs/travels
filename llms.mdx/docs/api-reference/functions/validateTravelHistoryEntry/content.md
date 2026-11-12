# validateTravelHistoryEntry() (/travels/llms.mdx/docs/api-reference/functions/validateTravelHistoryEntry/content.md)

> **validateTravelHistoryEntry**\<`P`\>(`entry`): \{ `error`: `string`; \} \| \{ `entry`: [`TravelHistoryEntry`](/travels/llms.mdx/docs/api-reference/type-aliases/TravelHistoryEntry/content.md)\<`P`\>; `error`: `null`; \}

Defined in: [src/persistence.ts:232](https://github.com/mutativejs/travels/blob/v3.0.1/src/persistence.ts#L232)

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

\{ `error`: `string`; \} \| \{ `entry`: [`TravelHistoryEntry`](/travels/llms.mdx/docs/api-reference/type-aliases/TravelHistoryEntry/content.md)\<`P`\>; `error`: `null`; \}
