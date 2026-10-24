# TravelsKnownEventType (/docs/api-reference/type-aliases/TravelsKnownEventType)

> **TravelsKnownEventType** = `"setState"` \| `"recordPatches"` \| `"archive"` \| `"transaction"` \| `"go"` \| `"reset"` \| `"rebase"` \| `"replaceStateWithoutHistory"`

Defined in: [src/type.ts:279](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L279)

Unified event published to `subscribe()` listeners and the `devtools` hook.

## Remarks [#remarks]

The `type` union is open: minor releases may add new event types, as 2.1.0
added `'recordPatches'`. Keep a `default` branch when switching on
`event.type` instead of asserting exhaustiveness with `never`.
