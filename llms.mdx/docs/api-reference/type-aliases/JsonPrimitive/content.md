# JsonPrimitive (/travels/llms.mdx/docs/api-reference/type-aliases/JsonPrimitive/content.md)

> **JsonPrimitive** = `string` \| `number` \| `boolean` \| `null`

Defined in: [src/type.ts:86](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L86)

A JSON primitive by TypeScript shape. `number` cannot statically exclude
`NaN`, infinities, or `-0`; use `findStateCompatibilityIssues` at runtime.
