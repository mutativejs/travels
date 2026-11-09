# RebasableTravelsControls<S, P> (/zh/docs/api-reference/type-aliases/RebasableTravelsControls)

> **RebasableTravelsControls**\<`S`, `P`\> = [`TravelsControls`](../interfaces/TravelsControls.mdx)\<`S`, `P`\> & `object`

Defined in: [src/type.ts:455](https://github.com/mutativejs/travels/blob/079554196672e49bffabc127e94f31a9218204d2/src/type.ts#L455)

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
