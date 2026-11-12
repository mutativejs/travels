# JsonPrimitive (/docs/api-reference/type-aliases/JsonPrimitive)

> **JsonPrimitive** = `string` \| `number` \| `boolean` \| `null`

Defined in: [src/type.ts:86](https://github.com/mutativejs/travels/blob/8685589f9ab027dd99e9f9a006978c653fc08692/src/type.ts#L86)

A JSON primitive by TypeScript shape. `number` cannot statically exclude
`NaN`, infinities, or `-0`; use `findStateCompatibilityIssues` at runtime.
