# assertTravelHistoryEntryRecordable() (/travels/llms.mdx/docs/api-reference/functions/assertTravelHistoryEntryRecordable/content.md)

> **assertTravelHistoryEntryRecordable**\<`P`\>(`entry`): `void`

Defined in: [src/history-entry.ts:48](https://github.com/mutativejs/travels/blob/v3.0.1/src/history-entry.ts#L48)

Verify that an external history entry can be detached before its owner
publishes the corresponding state commit.

## Type Parameters [#type-parameters]

### P [#p]

`P` *extends* `object` = \{ \}

## Parameters [#parameters]

### entry [#entry]

`unknown`

## Returns [#returns]

`void`
