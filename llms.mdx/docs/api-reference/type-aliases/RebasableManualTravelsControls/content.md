# RebasableManualTravelsControls<S, P> (/docs/api-reference/type-aliases/RebasableManualTravelsControls)

> **RebasableManualTravelsControls**\<`S`, `P`\> = [`ManualTravelsControls`](../interfaces/ManualTravelsControls.mdx)\<`S`, `P`\> & `object`

Defined in: [src/type.ts:484](https://github.com/mutativejs/travels/blob/5b79ab071f0129c7c1248a058104f08217dcfe6e/src/type.ts#L484)

## Type Declaration [#type-declaration]

### rebase() [#rebase]

> `readonly` **rebase**: () => `void`

Remove all history and make the current state as the new initial state.

#### Returns [#returns]

`void`

#### Remarks [#remarks]

**IMPORTANT**: This is a destructive operation. All previous and future history entries are discarded,
and the current state (including any unarchived temp patches) becomes the new baseline (position 0). Any subsequent `reset()`
calls will return to this new baseline, not the original initial state.

## Type Parameters [#type-parameters]

### S [#s]

`S`

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}
