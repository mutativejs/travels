import type {
  Options as MutativeOptions,
  Patches,
  Draft,
  Immutable,
  PatchesOptions,
} from 'mutative';

/**
 * Retained forward/inverse JSON Patch entries. Persisted paths use JSON Pointer
 * strings or dense arrays of strings/non-negative integers; values are JSON-compatible.
 */
export type TravelPatches<P extends PatchesOption = {}> = {
  patches: Patches<P>[];
  inversePatches: Patches<P>[];
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

export type TravelsMigration<
  S,
  P extends PatchesOption = {},
> = (snapshot: unknown) => TravelsSerializedHistory<S, P> | unknown;

export type TravelsDeserializeOptions<
  S,
  P extends PatchesOption = {},
> = {
  /**
   * Migrate old persisted snapshots into the current schema before validation.
   */
  migrate?: TravelsMigration<S, P>;
  /**
   * Fallback snapshot used when parsing, migration, or validation fails.
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
  | 'compatibilityCheck';

export type TravelsObserverErrorEvent = {
  source: TravelsObserverErrorSource;
  error: unknown;
};

export type TravelsDevtoolsEvent<
  S,
  P extends PatchesOption = {},
> = {
  type:
    | 'setState'
    | 'archive'
    | 'transaction'
    | 'go'
    | 'reset'
    | 'rebase'
    | 'replaceStateWithoutHistory';
  state: S;
  position: number;
  patches: TravelPatches<P>;
  metadata?: TravelMetadata;
};

export type TravelsErrorCode = 'TRANSACTION_FAILED';

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
   * The initial position in the history, by default `0`
   */
  initialPosition?: number;
  /**
   * The initial patches of the history
   */
  initialPatches?: TravelPatches<P>;
  /**
   * Restore validated serialized history. This is equivalent to passing
   * initialPatches and initialPosition directly, but preserves the first-class
   * persistence API shape returned by `Travels.deserialize(...)`.
   */
  history?: TravelsHistory<P>;
  /**
   * Whether to throw when `initialPatches` is invalid.
   * When false (default), invalid patches are discarded and history starts empty.
   */
  strictInitialPatches?: boolean;
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
   * Receives errors thrown by notification hooks. Observer errors never roll
   * back or interrupt an already committed state transition.
   */
  onObserverError?: (event: TravelsObserverErrorEvent) => void;
  /**
   * Optional hook for external devtools or debugging timelines.
   */
  devtools?: (event: TravelsDevtoolsEvent<any, P>) => void;
} & Omit<MutativeOptions<true, F>, 'enablePatches'> & {
    /**
     * Configure patch formatting. Patches cannot be disabled because Travels
     * uses them to implement history, navigation, and persistence.
     */
    patchesOptions?: P;
  };

export type InitialValue<I extends unknown> = I extends (
  ...args: unknown[]
) => infer R
  ? R
  : I;
type DraftFunction<S> = (draft: Draft<S>) => void;
export type Updater<S> = S | (() => S) | DraftFunction<S>;
export type Value<S, F extends boolean> = F extends true
  ? Immutable<InitialValue<S>>
  : InitialValue<S>;

export interface TravelsControls<
  S,
  F extends boolean,
  P extends PatchesOption = {},
> {
  /**
   * The current position in the history
   */
  position: number;
  /**
   * Get the history of the state
   */
  getHistory: () => Value<S, F>[];
  /**
   * The patches of the history
   */
  patches: TravelPatches<P>;
  /**
   * Go back in the history
   */
  back: (amount?: number) => void;
  /**
   * Go forward in the history
   */
  forward: (amount?: number) => void;
  /**
   * Reset the history
   */
  reset: () => void;
  /**
   * Go to a specific position in the history
   */
  go: (position: number) => void;
  /**
   * Check if it's possible to go back
   */
  canBack: () => boolean;
  /**
   * Check if it's possible to go forward
   */
  canForward: () => boolean;
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
  rebase: () => void;
};

export interface ManualTravelsControls<
  S,
  F extends boolean,
  P extends PatchesOption = {},
> extends TravelsControls<S, F, P> {
  /**
   * Archive the current state
   */
  archive: (metadata?: TravelMetadata) => void;
  /**
   * Check if it's possible to archive the current state
   */
  canArchive: () => boolean;
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
  rebase: () => void;
};
