# TravelsDeserializeOptions<S, P> (/docs/api-reference/type-aliases/TravelsDeserializeOptions)

> **TravelsDeserializeOptions**\<`S`, `P`\> = `object`

Defined in: [src/type.ts:204](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L204)

## Type Parameters [#type-parameters]

### S [#s]

`S`

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}

## Properties [#properties]

### fallback? [#fallback]

> `optional` **fallback**: [`TravelsSerializedHistory`](TravelsSerializedHistory.mdx)\<`S`, `P`\> \| () => [`TravelsSerializedHistory`](TravelsSerializedHistory.mdx)\<`S`, `P`\>

Defined in: [src/type.ts:218](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L218)

Fallback snapshot used when parsing, migration, or validation fails.
Function fallbacks must return synchronously.

***

### migrate? [#migrate]

> `optional` **migrate**: [`TravelsMigration`](TravelsMigration.mdx)\<`S`, `P`\>

Defined in: [src/type.ts:213](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L213)

Migrate old persisted snapshots into the current schema before validation.
The callback must return synchronously; perform asynchronous I/O before
calling `deserialize()`.

***

### onError()? [#onerror]

> `optional` **onError**: (`error`) => `void`

Defined in: [src/type.ts:224](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L224)

Receive typed persistence errors before a fallback is returned or the error is thrown.

#### Parameters [#parameters]

##### error [#error]

`Error`

#### Returns [#returns]

`void`

***

### replayOptions? [#replayoptions]

> `optional` **replayOptions**: [`TravelsReplayOptions`](TravelsReplayOptions.mdx)

Defined in: [src/type.ts:235](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L235)

Mutative options used while semantically replaying every history entry.
Supply the same strict/mark settings that were used to record the history.

***

### validation? [#validation]

> `optional` **validation**: [`TravelsHistoryValidationMode`](TravelsHistoryValidationMode.mdx)

Defined in: [src/type.ts:230](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L230)

`structural` validates the encoded schema and patch shapes (default).
`semantic` additionally replays and reverses every entry and is recommended
for snapshots that have not crossed a trusted verification boundary.
