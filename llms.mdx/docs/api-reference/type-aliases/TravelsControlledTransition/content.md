# TravelsControlledTransition<S, P> (/docs/api-reference/type-aliases/TravelsControlledTransition)

> **TravelsControlledTransition**\<`S`, `P`\> = `object`

Defined in: [src/type.ts:61](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L61)

Patch transition delegated to an external state owner by a controlled
Travels journal.

## Type Parameters [#type-parameters]

### S [#s]

`S`

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}

## Properties [#properties]

### fromPosition [#fromposition]

> `readonly` **fromPosition**: `number`

Defined in: [src/type.ts:68](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L68)

***

### inversePatches [#inversepatches]

> `readonly` **inversePatches**: `Patches`\<`P`\>

Defined in: [src/type.ts:67](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L67)

Composed patches that roll the transition back.

***

### patches [#patches]

> `readonly` **patches**: `Patches`\<`P`\>

Defined in: [src/type.ts:65](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L65)

Composed patches that move from `fromPosition` to `toPosition`.

***

### state [#state]

> `readonly` **state**: `S`

Defined in: [src/type.ts:63](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L63)

State known to Travels before the transition is applied.

***

### toPosition [#toposition]

> `readonly` **toPosition**: `number`

Defined in: [src/type.ts:69](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L69)
