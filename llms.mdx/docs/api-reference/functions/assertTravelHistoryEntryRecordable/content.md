# assertTravelHistoryEntryRecordable() (/docs/api-reference/functions/assertTravelHistoryEntryRecordable)

> **assertTravelHistoryEntryRecordable**\<`P`\>(`entry`): `void`

Defined in: [src/history-entry.ts:48](https://github.com/mutativejs/travels/blob/079554196672e49bffabc127e94f31a9218204d2/src/history-entry.ts#L48)

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
