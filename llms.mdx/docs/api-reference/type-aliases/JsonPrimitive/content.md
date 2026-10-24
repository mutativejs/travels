# JsonPrimitive (/docs/api-reference/type-aliases/JsonPrimitive)

> **JsonPrimitive** = `string` \| `number` \| `boolean` \| `null`

Defined in: [src/type.ts:86](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L86)

A JSON primitive by TypeScript shape. `number` cannot statically exclude
`NaN`, infinities, or `-0`; use `findStateCompatibilityIssues` at runtime.
