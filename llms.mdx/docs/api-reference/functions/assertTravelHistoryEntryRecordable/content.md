# assertTravelHistoryEntryRecordable() (/docs/api-reference/functions/assertTravelHistoryEntryRecordable)

> **assertTravelHistoryEntryRecordable**\<`P`\>(`entry`): `void`

Defined in: [src/history-entry.ts:48](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/history-entry.ts#L48)

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
