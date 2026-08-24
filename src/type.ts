import type {
  Options as MutativeOptions,
  Patch,
  Patches,
  Draft,
  Immutable,
  PatchesOptions,
} from 'mutative';

/**
 * Forward/inverse JSON Patch groups. Retained-history APIs use one group per
 * entry; observer events use event-local transition groups. Persisted paths use
 * JSON Pointer strings or dense arrays of strings/non-negative integers.
 */
export type TravelPatches<P extends PatchesOption = {}> = {
  patches: Patches<P>[];
  inversePatches: Patches<P>[];
};

/** A read-only patch operation exposed through a shared observer event. */
export type ReadonlyTravelPatch<P extends PatchesOption = {}> = Omit<
  Readonly<Patch<P>>,
  'path'
> & {
  readonly path: Patch<P>['path'] extends readonly (infer Segment)[]
    ? readonly Segment[]
    : Patch<P>['path'];
};

/** Read-only event-local patch groups shared by all observers of one event. */
export type ReadonlyTravelPatches<P extends PatchesOption = {}> = {
  readonly patches: readonly (readonly ReadonlyTravelPatch<P>[])[];
  readonly inversePatches: readonly (readonly ReadonlyTravelPatch<P>[])[];
};

/**
 * Metadata attached to a history entry. Keep custom values JSON-compatible
 * when the history will be persisted with `serialize()`.
 */
export type TravelMetadata = {
  label?: string;
  timestamp?: number;
  source?: string;
  [key: string]: unknown;
};

export type TravelHistoryEntry<P extends PatchesOption = {}> = {
  patches: Patches<P>;
  inversePatches: Patches<P>;
  metadata?: TravelMetadata;
};

/**
 * Patch transition delegated to an external state owner by a controlled
 * Travels journal.
 */
export type TravelsControlledTransition<S, P extends PatchesOption = {}> = {
  /** State known to Travels before the transition is applied. */
  readonly state: S;
  /** Composed patches that move from `fromPosition` to `toPosition`. */
  readonly patches: Patches<P>;
  /** Composed patches that roll the transition back. */
  readonly inversePatches: Patches<P>;
  readonly fromPosition: number;
  readonly toPosition: number;
};

/**
 * Synchronous executor used when another runtime owns the authoritative state.
 * Return that runtime's committed state after applying `transition.patches`.
 */
export type TravelsControlledApply<S, P extends PatchesOption = {}> = (
  transition: TravelsControlledTransition<S, P>
) => S;

export type PatchesOption = Exclude<PatchesOptions, boolean>;

/**
 * A JSON primitive by TypeScript shape. `number` cannot statically exclude
 * `NaN`, infinities, or `-0`; use `findStateCompatibilityIssues` at runtime.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/** State shape supported by Travels' runtime and persistence contracts. */
export type PatchableState = JsonValue;

type PatchableTypeDepth = readonly [
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
];

type IsAny<T> = 0 extends 1 & T ? true : false;
type IsUnknown<T> = IsAny<T> extends true
  ? false
  : unknown extends T
    ? [keyof T] extends [never]
      ? true
      : false
    : false;
type IsBroadObject<T> = [T] extends [object]
  ? [object] extends [T]
    ? [string] extends [T]
      ? false
      : true
    : false
  : false;

type NonPatchableValue<
  T,
  Depth extends readonly unknown[] = PatchableTypeDepth,
> = IsAny<T> extends true
  ? T
  : IsUnknown<T> extends true
    ? T
    : IsBroadObject<T> extends true
      ? T
      : Depth extends readonly [unknown, ...infer Rest]
        ? T extends JsonPrimitive
          ? never
          : T extends readonly (infer Item)[]
            ? NonPatchableValue<Item, Rest>
            : T extends (...args: any[]) => unknown
              ? T
              : T extends Date | Map<unknown, unknown> | Set<unknown>
                ? T
                : T extends object
                  ? Extract<keyof T, symbol> extends never
                    ? {
                        [Key in keyof T]-?: NonPatchableValue<T[Key], Rest>;
                      }[keyof T]
                    : T
                  : T
        : never;

/**
 * Preserve an inferred state type when its reachable properties are
 * statically compatible with the durable patch/persistence contract.
 *
 * Recursive types are inspected to a finite depth and broad `{}`-shaped
 * values cannot be proven from their static type alone. The strict factory
 * therefore also validates the concrete initial value at runtime.
 */
export type PatchableInput<T> = [NonPatchableValue<T>] extends [never]
  ? T
  : never;

export type TravelsHistory<P extends PatchesOption = {}> = {
  patches: TravelPatches<P>;
  position: number;
  metadata?: Array<TravelMetadata | undefined>;
};

export type TravelsSerializedHistory<
  S,
  P extends PatchesOption = {},
> = TravelsHistory<P> & {
  version: 1;
  state: S;
};

export type TravelsPersistenceErrorCode =
  | 'PARSE_ERROR'
  | 'INVALID_SCHEMA'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_PATCHES'
  | 'INVALID_HISTORY'
  | 'MIGRATION_FAILED'
  | 'FALLBACK_FAILED';

export type TravelsReplayOptions = {
  /** Match the `strict` option used when the history was recorded. */
  strict?: boolean;
  /** Match the Mutative `mark` option used when the history was recorded. */
  mark?: MutativeOptions<false, boolean>['mark'];
};

export type TravelsHistoryValidationMode = 'semantic' | 'structural';

export type TravelsSerializeOptions = {
  /** Throw when state, retained patches, or metadata are not durable JSON data. */
  strict?: boolean;
};


export type TravelsMigration<
  S,
  P extends PatchesOption = {},
> = (snapshot: unknown) => TravelsSerializedHistory<S, P>;

export type TravelsDeserializeOptions<
  S,
  P extends PatchesOption = {},
> = {
  /**
   * Migrate old persisted snapshots into the current schema before validation.
   * The callback must return synchronously; perform asynchronous I/O before
   * calling `deserialize()`.
   */
  migrate?: TravelsMigration<S, P>;
  /**
   * Fallback snapshot used when parsing, migration, or validation fails.
   * Function fallbacks must return synchronously.
   */
  fallback?:
    | TravelsSerializedHistory<S, P>
    | (() => TravelsSerializedHistory<S, P>);
  /**
   * Receive typed persistence errors before a fallback is returned or the error is thrown.
   */
  onError?: (error: Error) => void;
  /**
   * `structural` validates the encoded schema and patch shapes (default).
   * `semantic` additionally replays and reverses every entry and is recommended
   * for snapshots that have not crossed a trusted verification boundary.
   */
  validation?: TravelsHistoryValidationMode;
  /**
   * Mutative options used while semantically replaying every history entry.
   * Supply the same strict/mark settings that were used to record the history.
   */
  replayOptions?: TravelsReplayOptions;
};

export type TravelsBranchDiscardEvent<P extends PatchesOption = {}> = {
  position: number;
  discarded: TravelHistoryEntry<P>[];
};

export type TravelsObserverErrorSource =
  | 'listener'
  | 'devtools'
  | 'onBranchDiscard'
  | 'onError'
  | 'onWarning'
  | 'compatibilityCheck';

export type TravelsWarningCode =
  | 'AUTO_ARCHIVE_ENABLED'
  | 'HISTORY_DISABLED'
  | 'HISTORY_DISCARDED'
  | 'HISTORY_TRIMMED'
  | 'INVALID_POSITION'
  | 'MUTABLE_FALLBACK'
  | 'MUTABLE_ROOT_REPLACEMENT'
  | 'PERSISTENCE_COMPATIBILITY'
  | 'POSITION_CLAMPED';

export type TravelsWarning = {
  readonly code: TravelsWarningCode;
  readonly message: string;
};

export type TravelsObserverErrorEvent = {
  source: TravelsObserverErrorSource;
  error: unknown;
};

/**
 * Unified event published to `subscribe()` listeners and the `devtools` hook.
 *
 * @remarks
 * The `type` union is open: minor releases may add new event types, as 2.1.0
 * added `'recordPatches'`. Keep a `default` branch when switching on
 * `event.type` instead of asserting exhaustiveness with `never`.
 */
export type TravelsKnownEventType =
  | 'setState'
  | 'recordPatches'
  | 'archive'
  | 'transaction'
  | 'go'
  | 'reset'
  | 'rebase'
  | 'replaceStateWithoutHistory';

/**
 * Event names are intentionally extensible so minor releases can add new
 * operations without breaking exhaustive TypeScript switches.
 */
export type TravelsEventType =
  | TravelsKnownEventType
  | (string & Record<never, never>);

export type TravelsEvent<
  S,
  P extends PatchesOption = {},
> = {
  /**
   * The committed operation. Handle unrecognized values in a `default` branch.
   */
  readonly type: TravelsEventType;
  readonly state: S;
  readonly position: number;
  /**
   * Lazily materialized event-local patches that transform the previously
   * published state. Treat the shared snapshot as read-only.
   */
  readonly patches: ReadonlyTravelPatches<P>;
  /** Number of entries currently retained in history. */
  readonly historyLength: number;
  readonly metadata?: TravelMetadata;
};

export type TravelsErrorCode =
  | 'ASYNC_CALLBACK'
  | 'CONTROLLED_JOURNAL_REQUIRED'
  | 'CONTROLLED_OPERATION_UNAVAILABLE'
  | 'EMPTY_PATCH_ENTRY'
  | 'INVALID_OPERATION'
  | 'INVALID_OPTION'
  | 'INVALID_PATCH_ENTRY'
  | 'PERSISTENCE_INCOMPATIBLE'
  | 'REENTRANT_MUTATION'
  | 'TRANSACTION_FAILED'
  | 'UNCLONEABLE_PATCH_VALUE'
  | 'UNSUPPORTED_STATE';

export type TravelsOptions<
  F extends boolean,
  A extends boolean,
  P extends PatchesOption = {},
> = {
  /**
   * The maximum number of history to keep, by default `10`
   */
  maxHistory?: number;
  /**
   * Restore history normalized by `Travels.deserialize(...)`.
   * Malformed history is rejected instead of silently discarded.
   */
  history?: TravelsHistory<P>;
  /**
   * Whether to automatically archive the current state, by default `true`
   */
  autoArchive?: A;
  /**
   * Whether to mutate the state in place (for observable state like MobX, Vue, Pinia)
   * When true, apply patches directly to the existing state object
   * When false (default), create new immutable state objects
   * @default false
   */
  mutable?: boolean;
  /**
   * Warn in development about weak patch or JSON persistence semantics in
   * state, retained patches, or history metadata. Defaults to `true`.
   */
  warnOnUnsupportedState?: boolean;
  /**
   * Called when Travels wraps a thrown core operation error. Errors raised by
   * nested transactions are published after the root transaction settles.
   */
  onError?: (error: Error) => void;
  /**
   * Called when undoing and then making a committed edit discards redo history.
   * Root transactions report only entries that were visible before they began.
   */
  onBranchDiscard?: (event: TravelsBranchDiscardEvent<P>) => void;
  /**
   * Receives non-fatal normalization, compatibility, and migration warnings.
   * Without this hook warnings are written to the console only in development.
   */
  onWarning?: (warning: TravelsWarning) => void;
  /**
   * Receives errors thrown by notification hooks. Observer errors never roll
   * back or interrupt an already committed state transition.
   */
  onObserverError?: (event: TravelsObserverErrorEvent) => void;
  /**
   * Optional hook for external devtools or debugging timelines.
   */
  devtools?: (event: TravelsEvent<any, P>) => void;
} & Omit<MutativeOptions<true, F>, 'enablePatches'> & {
    /**
     * Configure patch formatting. Patches cannot be disabled because Travels
     * uses them to implement history, navigation, and persistence.
     */
    patchesOptions?: P;
  };

export type InitialValue<I> = I extends (
  ...args: unknown[]
) => infer R
  ? R
  : I;
type DraftFunction<S> = (draft: Draft<S>) => void;
export type Updater<S> = S | (() => S) | DraftFunction<S>;
export type Value<S, F extends boolean> = F extends true
  ? Immutable<InitialValue<S>>
  : InitialValue<S>;

/** A state value exposed through a shared read-only view. */
export type ReadonlyState<S> = Immutable<S>;

export interface TravelsControls<
  S,
  F extends boolean,
  P extends PatchesOption = {},
> {
  /**
   * The current position in the history
   */
  readonly position: number;
  /**
   * Get the shared history cache.
   *
   * @remarks
   * The returned array is Travels' shared internal cache. Use
   * {@link getHistorySnapshot} when you need an array you can keep or change.
   */
  readonly getHistory: () => readonly ReadonlyState<S>[];
  /**
   * Get fully detached durable history snapshots.
   */
  readonly getHistorySnapshot: () => S[];
  /**
   * The patches of the history
   */
  readonly patches: TravelPatches<P>;
  /**
   * Go back in the history
   */
  readonly back: (amount?: number) => void;
  /**
   * Go forward in the history
   */
  readonly forward: (amount?: number) => void;
  /**
   * Reset the history
   */
  readonly reset: () => void;
  /**
   * Go to a specific position in the history
   */
  readonly go: (position: number) => void;
  /**
   * Check if it's possible to go back
   */
  readonly canBack: () => boolean;
  /**
   * Check if it's possible to go forward
   */
  readonly canForward: () => boolean;
}

export type RebasableTravelsControls<
  S,
  F extends boolean,
  P extends PatchesOption = {},
> = TravelsControls<S, F, P> & {
  /**
   * Remove all history and make the current state as the new initial state.
   *
   * @remarks
   * **IMPORTANT**: This is a destructive operation. All previous and future history entries are discarded,
   * and the current state (including any unarchived temp patches) becomes the new baseline (position 0). Any subsequent `reset()`
   * calls will return to this new baseline, not the original initial state.
   */
  readonly rebase: () => void;
};

export interface ManualTravelsControls<
  S,
  F extends boolean,
  P extends PatchesOption = {},
> extends TravelsControls<S, F, P> {
  /**
   * Archive the current state
   */
  readonly archive: (metadata?: TravelMetadata) => void;
  /**
   * Check if it's possible to archive the current state
   */
  readonly canArchive: () => boolean;
}

export type RebasableManualTravelsControls<
  S,
  F extends boolean,
  P extends PatchesOption = {},
> = ManualTravelsControls<S, F, P> & {
  /**
   * Remove all history and make the current state as the new initial state.
   *
   * @remarks
   * **IMPORTANT**: This is a destructive operation. All previous and future history entries are discarded,
   * and the current state (including any unarchived temp patches) becomes the new baseline (position 0). Any subsequent `reset()`
   * calls will return to this new baseline, not the original initial state.
   */
  readonly rebase: () => void;
};
