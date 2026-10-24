# PatchableInput<T> (/docs/api-reference/type-aliases/PatchableInput)

> **PatchableInput**\<`T`\> = \[`NonPatchableValue`\<`T`\>\] *extends* \[`never`\] ? `T` : `never`

Defined in: [src/type.ts:160](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L160)

Preserve an inferred state type when its reachable properties are
statically compatible with the durable patch/persistence contract.

Recursive types are inspected to a finite depth and broad `{}`-shaped
values cannot be proven from their static type alone. The strict factory
therefore also validates the concrete initial value at runtime.

## Type Parameters [#type-parameters]

### T [#t]

`T`
