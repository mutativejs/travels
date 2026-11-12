# PatchableInput<T> (/travels/zh/llms.mdx/docs/api-reference/type-aliases/PatchableInput/content.md)

> **PatchableInput**\<`T`\> = \[`NonPatchableValue`\<`T`\>\] *extends* \[`never`\] ? `T` : `never`

Defined in: [src/type.ts:160](https://github.com/mutativejs/travels/blob/v3.0.1/src/type.ts#L160)

Preserve an inferred state type when its reachable properties are
statically compatible with the durable patch/persistence contract.

Recursive types are inspected to a finite depth and broad `{}`-shaped
values cannot be proven from their static type alone. The strict factory
therefore also validates the concrete initial value at runtime.

## Type Parameters [#type-parameters]

### T [#t]

`T`
