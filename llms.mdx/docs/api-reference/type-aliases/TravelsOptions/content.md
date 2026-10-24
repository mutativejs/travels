# TravelsOptions<F, A, P, S> (/docs/api-reference/type-aliases/TravelsOptions)

> **TravelsOptions**\<`F`, `A`, `P`, `S`\> = `object` & `Omit`\<`MutativeOptions`\<`true`, `F`\>, `"enablePatches"`\> & `object`

Defined in: [src/type.ts:334](https://github.com/mutativejs/travels/blob/41d4a4ba6df4982eb3033dfe6b4c511aa00ff635/src/type.ts#L334)

## Type Declaration [#type-declaration]

### autoArchive? [#autoarchive]

> `optional` **autoArchive**: `A`

Whether to automatically archive the current state, by default `true`

### devtools()? [#devtools]

> `optional` **devtools**: (`event`) => `void`

Optional hook for external devtools or debugging timelines. Factories
type its event with the timeline state.

#### Parameters [#parameters]

##### event [#event]

[`TravelsEvent`](TravelsEvent.mdx)\<`S`, `P`\>

#### Returns [#returns]

`void`

### maxHistory? [#maxhistory]

> `optional` **maxHistory**: `number`

The maximum number of history to keep, by default `10`

### mutable? [#mutable]

> `optional` **mutable**: \[`F`\] *extends* \[`true`\] ? `false` : `boolean`

Whether to mutate the state in place (for observable state like MobX, Vue, Pinia)
When true, apply patches directly to the existing state object
When false (default), create new immutable state objects

Cannot be combined with `enableAutoFreeze: true`. TypeScript rejects the
pair when the freeze flag is the literal `true`; the factories also reject
it at runtime with `INVALID_OPTION`.

#### Default [#default]

```ts
false
```

### onBranchDiscard()? [#onbranchdiscard]

> `optional` **onBranchDiscard**: (`event`) => `void`

Called when undoing and then making a committed edit discards redo history.
Root transactions report only entries that were visible before they began.

#### Parameters [#parameters-1]

##### event [#event-1]

[`TravelsBranchDiscardEvent`](TravelsBranchDiscardEvent.mdx)\<`P`\>

#### Returns [#returns-1]

`void`

### onError()? [#onerror]

> `optional` **onError**: (`error`) => `void`

Called when Travels wraps a thrown core operation error. Errors raised by
nested transactions are published after the root transaction settles.

#### Parameters [#parameters-2]

##### error [#error]

`Error`

#### Returns [#returns-2]

`void`

### onObserverError()? [#onobservererror]

> `optional` **onObserverError**: (`event`) => `void`

Receives errors thrown by notification hooks. Observer errors never roll
back or interrupt an already committed state transition.

#### Parameters [#parameters-3]

##### event [#event-2]

[`TravelsObserverErrorEvent`](TravelsObserverErrorEvent.mdx)

#### Returns [#returns-3]

`void`

### onWarning()? [#onwarning]

> `optional` **onWarning**: (`warning`) => `void`

Receives non-fatal normalization, compatibility, and migration warnings.
Without this hook warnings are written to the console only in development.

#### Parameters [#parameters-4]

##### warning [#warning]

[`TravelsWarning`](TravelsWarning.mdx)

#### Returns [#returns-4]

`void`

### warnOnUnsupportedState? [#warnonunsupportedstate]

> `optional` **warnOnUnsupportedState**: `boolean`

Warn in development about weak patch or JSON persistence semantics in
state, retained patches, or history metadata. Defaults to `true`.

## Type Declaration [#type-declaration-1]

### patchesOptions? [#patchesoptions]

> `optional` **patchesOptions**: `P`

Configure patch formatting. Patches cannot be disabled because Travels
uses them to implement history, navigation, and persistence.

## Type Parameters [#type-parameters]

### F [#f]

`F` *extends* `boolean`

### A [#a]

`A` *extends* `boolean`

### P [#p]

`P` *extends* [`PatchesOption`](PatchesOption.mdx) = \{ \}

### S [#s]

`S` = `any`
