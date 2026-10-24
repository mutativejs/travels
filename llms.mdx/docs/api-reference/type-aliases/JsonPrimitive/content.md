# JsonPrimitive (/docs/api-reference/type-aliases/JsonPrimitive)

> **JsonPrimitive** = `string` \| `number` \| `boolean` \| `null`

Defined in: [src/type.ts:86](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L86)

A JSON primitive by TypeScript shape. `number` cannot statically exclude
`NaN`, infinities, or `-0`; use `findStateCompatibilityIssues` at runtime.
