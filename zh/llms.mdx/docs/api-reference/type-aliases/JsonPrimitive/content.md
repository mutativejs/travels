# JsonPrimitive (/zh/docs/api-reference/type-aliases/JsonPrimitive)

> **JsonPrimitive** = `string` \| `number` \| `boolean` \| `null`

Defined in: [src/type.ts:86](https://github.com/mutativejs/travels/blob/b5543aaea58ad69b9ce79acdf14d7ef5198f7876/src/type.ts#L86)

A JSON primitive by TypeScript shape. `number` cannot statically exclude
`NaN`, infinities, or `-0`; use `findStateCompatibilityIssues` at runtime.
