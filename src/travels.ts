import {
  type Options as MutativeOptions,
  type Patches,
  type Draft,
  apply,
  create,
  isDraft,
  rawReturn,
} from 'mutative';
import type {
  PatchesOption,
  RebasableManualTravelsControls,
  RebasableTravelsControls,
  TravelHistoryEntry,
  TravelMetadata,
  TravelPatches,
  TravelsBranchDiscardEvent,
  TravelsDeserializeOptions,
  TravelsDevtoolsEvent,
  TravelsOptions,
  TravelsObserverErrorEvent,
  TravelsObserverErrorSource,
  TravelsSerializedHistory,
  Updater,
  Value,
} from './type.js';
import {
  deserializeTravelsHistory,
  getTravelPatchesValidationError,
  TRAVELS_HISTORY_SCHEMA_VERSION,
} from './persistence.js';
import { findStateCompatibilityIssues } from './compatibility.js';
import { TravelsError } from './errors.js';
import { composePatchGroups } from './replay.js';
import {
  consumePromiseLikeRejection,
  isObjectLike,
  isPlainObject,
} from './utils.js';

/**
 * Listener callback for state changes
 */
type Listener<S, P extends PatchesOption = {}> = (
  state: S,
  patches: TravelPatches<P>,
  position: number
) => void;

type SynchronousFunction<F> = F extends (...args: never[]) => infer R
  ? Extract<R, PromiseLike<unknown>> extends never
    ? F
    : never
  : F;

type SynchronousUpdater<S, U extends Updater<S>> =
  Updater<S> extends U ? U : SynchronousFunction<U>;

const asyncFunctionTags = new Set([
  '[object AsyncFunction]',
  '[object AsyncGeneratorFunction]',
]);

const isKnownAsyncFunction = (value: unknown): boolean =>
  typeof value === 'function' &&
  asyncFunctionTags.has(Object.prototype.toString.call(value));

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  value !== null &&
  (typeof value === 'object' || typeof value === 'function') &&
  typeof (value as { then?: unknown }).then === 'function';

const silenceNativePromiseRejection = (value: PromiseLike<unknown>): void => {
  if (
    !(value instanceof Promise) &&
    Object.prototype.toString.call(value) !== '[object Promise]'
  ) {
    return;
  }

  try {
    void (value as Promise<unknown>).catch(() => undefined);
  } catch {
    // Promise-like objects are rejected without invoking arbitrary `then` code.
  }
};

const assertSynchronousResult = <T>(value: T, api: string): T => {
  if (!isPromiseLike(value)) {
    return value;
  }

  silenceNativePromiseRejection(value);
  throw new TypeError(`Travels: ${api} callback must be synchronous.`);
};

type TransactionSnapshot<S, P extends PatchesOption = {}> = {
  state: S;
  stateReference: S;
  position: number;
  allPatches: TravelPatches<P>;
  allMetadata: Array<TravelMetadata | undefined>;
  tempPatches: TravelPatches<P>;
  tempMetadata?: TravelMetadata;
  initialState: S;
  initialPosition: number;
  initialPatches?: TravelPatches<P>;
  initialMetadata?: Array<TravelMetadata | undefined>;
  trackingPauseDepth: number;
  branchDiscardEffects: BranchDiscardEffect<P>[];
  hasObserverEffects: boolean;
  needsCompatibilityCheck: boolean;
};

type BranchDiscardEffect<P extends PatchesOption = {}> = {
  position: number;
  patches: TravelPatches<P>;
  metadata: Array<TravelMetadata | undefined>;
};

const tryStructuredClone = <T>(value: T): T | undefined => {
  if (typeof (globalThis as any).structuredClone !== 'function') {
    return undefined;
  }

  try {
    return (globalThis as any).structuredClone(value) as T;
  } catch {
    return undefined;
  }
};

const deepCloneValue = (value: any, seen = new WeakMap<object, any>()): any => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const cloned: any[] = new Array(value.length);
    seen.set(value, cloned);

    for (let i = 0; i < value.length; i += 1) {
      if (Object.prototype.hasOwnProperty.call(value, i)) {
        cloned[i] = deepCloneValue(value[i], seen);
      }
    }

    return cloned;
  }

  if (value instanceof Map) {
    const cloned = new Map();
    seen.set(value, cloned);
    value.forEach((entryValue, entryKey) => {
      cloned.set(
        deepCloneValue(entryKey, seen),
        deepCloneValue(entryValue, seen)
      );
    });
    return cloned;
  }

  if (value instanceof Set) {
    const cloned = new Set();
    seen.set(value, cloned);
    value.forEach((entryValue) => {
      cloned.add(deepCloneValue(entryValue, seen));
    });
    return cloned;
  }

  if (value instanceof Date) {
    const cloned = new Date(value.getTime());
    seen.set(value, cloned);
    return cloned;
  }

  const structuredCloneValue = tryStructuredClone(value);
  if (structuredCloneValue !== undefined) {
    seen.set(value, structuredCloneValue);
    return structuredCloneValue;
  }

  if (!isPlainObject(value) && Object.getPrototypeOf(value) !== null) {
    return value;
  }

  const cloned: Record<string, any> = {};
  seen.set(value, cloned);
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      cloned[key] = deepCloneValue(value[key], seen);
    }
  }

  return cloned;
};

// Patch groups are immutable once archived. A weak identity follows their
// internal clones so transaction effects can distinguish pre-existing history
// from provisional entries without adding IDs to the public persistence shape.
const historyEntryIdentities = new WeakMap<object, object>();

const getHistoryEntryIdentity = (entry: object): object => {
  let identity = historyEntryIdentities.get(entry);
  if (!identity) {
    identity = {};
    historyEntryIdentities.set(entry, identity);
  }
  return identity;
};

const clonePatchGroup = <P extends PatchesOption = {}>(
  patch: Patches<P>
): Patches<P> => {
  const cloned = patch.map((operation) =>
    deepCloneValue(operation)
  ) as Patches<P>;
  const identity = historyEntryIdentities.get(patch);
  if (identity) {
    historyEntryIdentities.set(cloned, identity);
  }
  return cloned;
};

const cloneTravelPatches = <P extends PatchesOption = {}>(
  base?: TravelPatches<P>
): TravelPatches<P> => ({
  patches: base ? base.patches.map(clonePatchGroup) : [],
  inversePatches: base
    ? base.inversePatches.map((patch) =>
        patch.map((operation) => deepCloneValue(operation))
      )
    : [],
});

const filterBranchDiscardEffect = <P extends PatchesOption = {}>(
  effect: BranchDiscardEffect<P>,
  shouldInclude: (entryId: object) => boolean
): BranchDiscardEffect<P>[] => {
  const filtered: BranchDiscardEffect<P>[] = [];
  const patchGroups = effect.patches.patches;
  let runStart = -1;

  for (let index = 0; index <= patchGroups.length; index += 1) {
    const included =
      index < patchGroups.length &&
      shouldInclude(getHistoryEntryIdentity(patchGroups[index]));

    if (included && runStart < 0) {
      runStart = index;
    }

    if (!included && runStart >= 0) {
      filtered.push({
        position: effect.position + runStart,
        patches: {
          patches: effect.patches.patches.slice(runStart, index),
          inversePatches: effect.patches.inversePatches.slice(runStart, index),
        } as TravelPatches<P>,
        metadata: effect.metadata.slice(runStart, index),
      });
      runStart = -1;
    }
  }

  return filtered;
};

const cloneTravelMetadata = (
  metadata: TravelMetadata | undefined
): TravelMetadata | undefined =>
  metadata ? (deepCloneValue(metadata) as TravelMetadata) : undefined;

const cloneTravelMetadataList = (
  metadata: Array<TravelMetadata | undefined>
): Array<TravelMetadata | undefined> => metadata.map(cloneTravelMetadata);

const alignMetadataToPatchCount = (
  metadata: Array<TravelMetadata | undefined> | undefined,
  count: number
): Array<TravelMetadata | undefined> =>
  Array.from({ length: count }, (_, index) =>
    cloneTravelMetadata(metadata?.[index])
  );

const deepClone = <T>(source: T, target?: any): T => {
  if (target && source && typeof source === 'object') {
    for (const key in source as any) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = deepCloneValue((source as any)[key]);
      }
    }
    return target;
  }

  return deepCloneValue(source);
};

const cloneInitialSnapshot = <T>(value: T): T => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  const structuredCloneValue = tryStructuredClone(value);
  if (structuredCloneValue !== undefined) {
    return structuredCloneValue;
  }

  return deepClone(value);
};

const containsDraft = (
  value: unknown,
  seen = new WeakSet<object>()
): boolean => {
  if (!isObjectLike(value)) {
    return false;
  }
  if (isDraft(value)) {
    return true;
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) {
    return false;
  }
  seen.add(objectValue);

  if (value instanceof Map) {
    for (const [key, item] of value) {
      if (containsDraft(key, seen) || containsDraft(item, seen)) {
        return true;
      }
    }
    return false;
  }

  if (value instanceof Set) {
    for (const item of value) {
      if (containsDraft(item, seen)) {
        return true;
      }
    }
    return false;
  }

  for (const key of Reflect.ownKeys(objectValue)) {
    if (containsDraft((objectValue as any)[key], seen)) {
      return true;
    }
  }

  return false;
};

const hasOnlyArrayIndices = (value: unknown): value is any[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  const keys = Reflect.ownKeys(value);
  const hasOnlyIndices = keys.every((key) => {
    if (key === 'length') {
      return true;
    }

    if (typeof key === 'symbol') {
      return false;
    }

    const index = Number(key);
    return Number.isInteger(index) && index >= 0 && String(index) === key;
  });

  if (!hasOnlyIndices) {
    return false;
  }

  // Sparse arrays cannot be safely synchronized with in-place patches.
  return Object.keys(value).length === value.length;
};

const canSynchronizeMutableRoots = (current: unknown, snapshot: unknown) => {
  if (Array.isArray(current) || Array.isArray(snapshot)) {
    return Array.isArray(current) && Array.isArray(snapshot);
  }

  return isPlainObject(current) && isPlainObject(snapshot);
};

const getInitialPatchesValidationError = <P extends PatchesOption = {}>(
  initialPatches: TravelPatches<P> | undefined
): string | null => {
  if (!initialPatches) {
    return null;
  }

  return (
    getTravelPatchesValidationError(initialPatches, {
      allowNonJsonPathSegments: true,
    })?.replace(/(^|\s)patches(?=\.| must)/g, '$1initialPatches') ?? null
  );
};

// Align mutable value updates with immutable replacements by syncing objects
const overwriteDraftWith = (draft: Draft<any>, value: any): void => {
  const draftIsArray = Array.isArray(draft);
  const valueIsArray = Array.isArray(value);

  const draftKeys = Reflect.ownKeys(draft as object);
  for (const key of draftKeys) {
    if (draftIsArray && key === 'length') {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      delete (draft as any)[key as any];
    }
  }

  if (draftIsArray && valueIsArray) {
    (draft as any[]).length = (value as any[]).length;
  }

  Object.assign(draft as object, value);
};

/**
 * Core Travels class for managing undo/redo history
 */
export class Travels<
  S,
  F extends boolean = false,
  A extends boolean = true,
  P extends PatchesOption = {},
> {
  /**
   * Validate and normalize a persisted Travels history snapshot.
   */
  public static deserialize<S, P extends PatchesOption = {}>(
    snapshot: unknown,
    options?: TravelsDeserializeOptions<S, P>
  ): TravelsSerializedHistory<S, P> {
    return deserializeTravelsHistory(snapshot, options);
  }

  /**
   * Get the mutable mode
   */
  public mutable: boolean;
  private state: S;
  private position: number;
  private allPatches: TravelPatches<P>;
  private allMetadata: Array<TravelMetadata | undefined>;
  private tempPatches: TravelPatches<P>;
  private tempMetadata?: TravelMetadata;
  private maxHistory: number;
  private initialState: S;
  private initialPosition: number;
  private initialPatches?: TravelPatches<P>;
  private initialMetadata?: Array<TravelMetadata | undefined>;
  private readonly autoArchive: A;
  private options: MutativeOptions<PatchesOption | true, F>;
  private onError?: (error: Error) => void;
  private onBranchDiscard?: (event: TravelsBranchDiscardEvent<P>) => void;
  private onObserverError?: (event: TravelsObserverErrorEvent) => void;
  private devtools?: (event: TravelsDevtoolsEvent<S, P>) => void;
  private listeners: Set<Listener<S, P>> = new Set();
  private controlsCache:
    | RebasableTravelsControls<S, F, P>
    | RebasableManualTravelsControls<S, F, P>
    | null = null;
  private historyCache: { version: number; history: S[] } | null = null;
  private historyVersion = 0;
  private mutableFallbackWarned = false;
  private mutableRootReplaceWarned = false;
  private warnOnUnsupportedState: boolean;
  private stateCompatibilityWarningKeys = new Set<string>();
  private trackingPauseDepth = 0;
  private transactionDepth = 0;
  private transactionMetadata?: TravelMetadata;
  private transactionBranchDiscardEffects: BranchDiscardEffect<P>[] = [];
  private transactionVisibleEntryIds?: Set<object>;
  private transactionHasObserverEffects = false;
  private transactionNeedsCompatibilityCheck = false;
  private isPublishingEffects = false;

  constructor(initialState: S, options: TravelsOptions<F, A, P> = {}) {
    const {
      maxHistory = 10,
      history,
      initialPatches: inputInitialPatches,
      initialPosition: inputInitialPosition = 0,
      strictInitialPatches = false,
      autoArchive = true as A,
      mutable = false,
      warnOnUnsupportedState = process.env.NODE_ENV !== 'production',
      onError,
      onBranchDiscard,
      onObserverError,
      devtools,
      patchesOptions,
      ...mutativeOptions
    } = options;

    if ((patchesOptions as unknown) === false) {
      throw new TypeError(
        'Travels: patchesOptions cannot be false because history requires patches.'
      );
    }

    let initialPatches = history?.patches ?? inputInitialPatches;
    let initialPosition = history?.position ?? inputInitialPosition;

    if (
      process.env.NODE_ENV !== 'production' &&
      history &&
      (inputInitialPatches || inputInitialPosition !== 0)
    ) {
      console.warn(
        'Travels: history overrides initialPatches and initialPosition.'
      );
    }

    // Validate and enforce maxHistory constraints
    if (
      typeof maxHistory !== 'number' ||
      !Number.isFinite(maxHistory) ||
      !Number.isInteger(maxHistory)
    ) {
      throw new Error(
        `Travels: maxHistory must be a non-negative integer, but got ${maxHistory}`
      );
    }

    if (maxHistory < 0) {
      throw new Error(
        `Travels: maxHistory must be non-negative, but got ${maxHistory}`
      );
    }

    if (maxHistory === 0 && process.env.NODE_ENV !== 'production') {
      console.warn(
        'Travels: maxHistory is 0, which disables undo/redo history. This is rarely intended.'
      );
    }

    const initialPatchesValidationError =
      getInitialPatchesValidationError(initialPatches);

    if (initialPatchesValidationError) {
      if (strictInitialPatches) {
        throw new Error(`Travels: ${initialPatchesValidationError}`);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `Travels: ${initialPatchesValidationError}. Falling back to empty history. ` +
            `Set strictInitialPatches: true to throw instead.`
        );
      }

      initialPatches = undefined;
      initialPosition = 0;
    }

    this.state = initialState;
    // For mutable mode, deep clone initialState to prevent mutations
    this.initialState = cloneInitialSnapshot(initialState);
    this.maxHistory = maxHistory;
    this.autoArchive = autoArchive;
    this.mutable = mutable;
    this.warnOnUnsupportedState = warnOnUnsupportedState;
    this.onError = onError;
    this.onBranchDiscard = onBranchDiscard;
    this.onObserverError = onObserverError;
    this.devtools = devtools as
      | ((event: TravelsDevtoolsEvent<S, P>) => void)
      | undefined;
    this.options = {
      ...mutativeOptions,
      enablePatches: patchesOptions ?? true,
    };

    this.warnAboutStateCompatibility(initialState);

    const {
      patches: normalizedPatches,
      position: normalizedPosition,
      metadata: normalizedMetadata,
    } = this.normalizeInitialHistory(
      initialPatches,
      initialPosition,
      history?.metadata
    );

    this.allPatches = normalizedPatches;
    this.allMetadata = normalizedMetadata;
    if (initialPatches) {
      normalizedPatches.patches.forEach((patches) => {
        historyEntryIdentities.set(patches, {});
      });
    }
    this.initialPatches = initialPatches
      ? cloneTravelPatches(normalizedPatches)
      : undefined;
    this.initialMetadata = history?.metadata
      ? normalizedMetadata.slice()
      : undefined;
    this.position = normalizedPosition;
    this.initialPosition = normalizedPosition;

    this.tempPatches = cloneTravelPatches();
    this.tempMetadata = undefined;
  }

  private warnAboutStateCompatibility(state: unknown): void {
    if (!this.warnOnUnsupportedState || process.env.NODE_ENV === 'production') {
      return;
    }

    this.publishEffects(() => {
      try {
        const issues = findStateCompatibilityIssues(state, {
          mutable: this.mutable,
        });

        for (const issue of issues) {
          const key = `${issue.code}:${issue.path}`;
          if (this.stateCompatibilityWarningKeys.has(key)) {
            continue;
          }

          this.stateCompatibilityWarningKeys.add(key);
          console.warn(
            `Travels state compatibility warning at ${issue.path}: ${issue.message}`
          );
        }
      } catch (error) {
        this.reportObserverError('compatibilityCheck', error);
      }
    });
  }

  private checkStateCompatibilityAfterCommit(): void {
    if (this.transactionDepth > 0) {
      this.transactionNeedsCompatibilityCheck = true;
      return;
    }

    this.warnAboutStateCompatibility(this.state);
  }

  private normalizeInitialHistory(
    initialPatches: TravelPatches<P> | undefined,
    initialPosition: number,
    metadata?: Array<TravelMetadata | undefined>
  ): {
    patches: TravelPatches<P>;
    position: number;
    metadata: Array<TravelMetadata | undefined>;
  } {
    const cloned = cloneTravelPatches(initialPatches);
    const total = cloned.patches.length;
    const alignedMetadata = alignMetadataToPatchCount(metadata, total);
    const historyLimit = this.maxHistory > 0 ? this.maxHistory : 0;
    const invalidInitialPosition =
      typeof initialPosition !== 'number' ||
      !Number.isFinite(initialPosition) ||
      !Number.isInteger(initialPosition);
    let position = invalidInitialPosition ? 0 : (initialPosition as number);
    const clampedPosition = Math.max(0, Math.min(position, total));

    if (
      process.env.NODE_ENV !== 'production' &&
      (invalidInitialPosition || clampedPosition !== position)
    ) {
      console.warn(
        `Travels: initialPosition (${initialPosition}) is invalid for available patches (${total}). ` +
          `Using ${clampedPosition} instead.`
      );
    }

    position = clampedPosition;

    if (total === 0) {
      return { patches: cloned, position: 0, metadata: [] };
    }

    if (historyLimit === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `Travels: maxHistory (${this.maxHistory}) discards persisted history.`
        );
      }

      return { patches: cloneTravelPatches(), position: 0, metadata: [] };
    }

    if (historyLimit >= total) {
      return {
        patches: cloned,
        position,
        metadata: alignedMetadata,
      };
    }

    const trim = total - historyLimit;
    const windowStart = Math.min(position, trim);
    const windowEnd = windowStart + historyLimit;
    const trimmedBase = {
      patches: cloned.patches.slice(windowStart, windowEnd),
      inversePatches: cloned.inversePatches.slice(windowStart, windowEnd),
    } as TravelPatches<P>;

    const trimmed = cloneTravelPatches(trimmedBase);
    const adjustedPosition = position - windowStart;

    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `Travels: initialPatches length (${total}) exceeds maxHistory (${historyLimit}). ` +
          `Retained ${historyLimit} steps from position ${windowStart}. ` +
          `Position adjusted to ${adjustedPosition}.`
      );
    }

    return {
      patches: trimmed,
      position: adjustedPosition,
      metadata: alignedMetadata.slice(windowStart, windowEnd),
    };
  }

  private invalidateHistoryCache(): void {
    this.historyVersion += 1;
    this.historyCache = null;
  }

  private isAutoArchiving(): boolean {
    return this.autoArchive && this.transactionDepth === 0;
  }

  private assertCanMutate(api: string): void {
    if (this.isPublishingEffects) {
      throw new Error(
        `Travels: ${api} cannot be called while observers are being notified.`
      );
    }
  }

  private publishEffects(effect: () => void): void {
    const isRootPublication = !this.isPublishingEffects;
    if (isRootPublication) {
      this.isPublishingEffects = true;
    }

    try {
      effect();
    } finally {
      if (isRootPublication) {
        this.isPublishingEffects = false;
      }
    }
  }

  private reportObserverError(
    source: TravelsObserverErrorSource,
    error: unknown
  ): void {
    if (!this.onObserverError) {
      return;
    }

    const notify = () => {
      try {
        const result = this.onObserverError?.({ source, error });
        consumePromiseLikeRejection(result, () => undefined);
      } catch {
        // Error reporting must never replace the observer failure.
      }
    };

    if (this.isPublishingEffects) {
      notify();
    } else {
      this.publishEffects(notify);
    }
  }

  private invokeObserver(
    source: TravelsObserverErrorSource,
    observer: () => unknown
  ): void {
    let result: unknown;
    try {
      result = observer();
    } catch (error) {
      this.reportObserverError(source, error);
      return;
    }

    consumePromiseLikeRejection(result, (error) =>
      this.reportObserverError(source, error)
    );
  }

  /**
   * Subscribe to state changes
   * @returns Unsubscribe function
   */
  public subscribe = (listener: Listener<S, P>) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Notify all listeners of state changes
   */
  private getEventPatches(): TravelPatches<P> | undefined {
    if (!this.listeners.size && !this.devtools) {
      return undefined;
    }

    const shouldArchive =
      !this.isAutoArchiving() && !!this.tempPatches.patches.length;
    const source = shouldArchive ? this.getAllPatches() : this.allPatches;
    const patchGroups = source.patches;
    const inversePatchGroups = source.inversePatches;
    const patchCount = patchGroups.length;
    const inversePatchCount = inversePatchGroups.length;
    let materialized: TravelPatches<P> | undefined;

    const materialize = (): TravelPatches<P> => {
      if (!materialized) {
        materialized = cloneTravelPatches({
          patches: patchGroups.slice(0, patchCount),
          inversePatches: inversePatchGroups.slice(0, inversePatchCount),
        });
      }
      return materialized;
    };

    const snapshot = {} as TravelPatches<P>;
    Object.defineProperties(snapshot, {
      patches: {
        enumerable: true,
        get: () => materialize().patches,
      },
      inversePatches: {
        enumerable: true,
        get: () => materialize().inversePatches,
      },
    });
    return snapshot;
  }

  private emitBranchDiscard(effect: BranchDiscardEffect<P>): void {
    if (!this.onBranchDiscard) {
      return;
    }

    const onBranchDiscard = this.onBranchDiscard;
    this.invokeObserver('onBranchDiscard', () =>
      onBranchDiscard({
        position: effect.position,
        discarded: this.toEntries(effect.patches, effect.metadata),
      })
    );
  }

  private publishBranchDiscard(effect: BranchDiscardEffect<P>): void {
    if (this.transactionDepth > 0) {
      this.transactionBranchDiscardEffects.push(effect);
      return;
    }

    this.emitBranchDiscard(effect);
  }

  private flushTransactionBranchDiscards(): void {
    if (!this.transactionBranchDiscardEffects.length) {
      return;
    }

    const queuedEffects = this.transactionBranchDiscardEffects;
    this.transactionBranchDiscardEffects = [];
    const visibleEntryIds = this.transactionVisibleEntryIds;
    const effects = visibleEntryIds
      ? queuedEffects.flatMap((effect) =>
          filterBranchDiscardEffect(effect, (entryId) =>
            visibleEntryIds.has(entryId)
          )
        )
      : queuedEffects;

    this.publishEffects(() => {
      for (const effect of effects) {
        this.emitBranchDiscard(effect);
      }
    });
  }

  private emitChange(
    type: TravelsDevtoolsEvent<S, P>['type'],
    metadata?: TravelMetadata,
    branchDiscard?: BranchDiscardEffect<P>
  ): void {
    if (this.transactionDepth > 0) {
      this.transactionHasObserverEffects = true;
      if (branchDiscard) {
        this.publishBranchDiscard(branchDiscard);
      }
      return;
    }

    const patches = this.getEventPatches();
    const state = this.state;
    const position = this.position;
    const listeners = Array.from(this.listeners);
    const devtools = this.devtools;

    this.publishEffects(() => {
      if (branchDiscard) {
        this.publishBranchDiscard(branchDiscard);
      }

      if (patches) {
        for (const listener of listeners) {
          this.invokeObserver('listener', () =>
            listener(state, patches, position)
          );
        }

        if (devtools) {
          const event = {
            type,
            state,
            position,
            patches,
            metadata,
          } as TravelsDevtoolsEvent<S, P>;
          this.invokeObserver('devtools', () => devtools(event));
        }
      }
    });
  }

  private reportError(
    code: 'TRANSACTION_FAILED',
    error: unknown
  ): TravelsError {
    const travelsError =
      error instanceof TravelsError
        ? error
        : new TravelsError(code, `Travels: ${code}`, { cause: error });
    if (this.onError) {
      const onError = this.onError;
      this.publishEffects(() => {
        this.invokeObserver('onError', () => onError(travelsError));
      });
    }
    return travelsError;
  }

  private toEntries(
    patches: TravelPatches<P>,
    metadata: Array<TravelMetadata | undefined> = []
  ): TravelHistoryEntry<P>[] {
    return patches.patches.map((patch, index) => ({
      patches: patch.map((operation) =>
        deepCloneValue(operation)
      ) as Patches<P>,
      inversePatches: patches.inversePatches[index].map((operation) =>
        deepCloneValue(operation)
      ) as Patches<P>,
      metadata: cloneTravelMetadata(metadata[index]),
    }));
  }

  private discardFutureFrom(
    position: number
  ): BranchDiscardEffect<P> | undefined {
    if (position >= this.allPatches.patches.length) {
      return undefined;
    }

    const discardedPatches = {
      patches: this.allPatches.patches.slice(position),
      inversePatches: this.allPatches.inversePatches.slice(position),
    } as TravelPatches<P>;
    const discardedMetadata = this.allMetadata.slice(position);

    // Replace the outer arrays instead of mutating them so lazy event snapshots
    // can retain an exact view of the discarded branch.
    this.allPatches.patches = this.allPatches.patches.slice(0, position);
    this.allPatches.inversePatches = this.allPatches.inversePatches.slice(
      0,
      position
    );
    this.allMetadata = this.allMetadata.slice(0, position);

    return {
      position,
      patches: discardedPatches,
      metadata: discardedMetadata,
    };
  }

  private trimHistoryToMax(): void {
    if (this.maxHistory >= this.allPatches.patches.length) {
      return;
    }

    if (this.maxHistory === 0) {
      this.allPatches.patches = [];
      this.allPatches.inversePatches = [];
      this.allMetadata = [];
      return;
    }

    this.allPatches.patches = this.allPatches.patches.slice(-this.maxHistory);
    this.allPatches.inversePatches = this.allPatches.inversePatches.slice(
      -this.maxHistory
    );
    this.allMetadata = cloneTravelMetadataList(
      this.allMetadata.slice(-this.maxHistory)
    );
  }

  private resetHistoryToCurrentState(): void {
    this.initialState = cloneInitialSnapshot(this.state);
    this.initialPosition = 0;
    this.initialPatches = undefined;
    this.initialMetadata = undefined;
    this.position = 0;
    this.allPatches = cloneTravelPatches();
    this.allMetadata = [];
    this.tempPatches = cloneTravelPatches();
    this.tempMetadata = undefined;
  }

  private hasRecordedHistory(): boolean {
    return (
      this.position !== 0 ||
      this.initialPosition !== 0 ||
      !!this.initialPatches?.patches.length ||
      !!this.initialPatches?.inversePatches.length ||
      !!this.initialMetadata?.length ||
      this.allPatches.patches.length > 0 ||
      this.allPatches.inversePatches.length > 0 ||
      this.allMetadata.length > 0 ||
      this.tempPatches.patches.length > 0 ||
      this.tempPatches.inversePatches.length > 0 ||
      this.tempMetadata !== undefined
    );
  }

  private restoreStateFromSnapshot(snapshot: S, stateReference: S): void {
    const canRestoreMutably =
      this.mutable && canSynchronizeMutableRoots(stateReference, snapshot);

    if (canRestoreMutably) {
      const [, patches] = create(
        stateReference,
        (draft) => {
          for (const key of Object.keys(draft as object)) {
            delete (draft as any)[key];
          }
          deepClone(snapshot, draft);
          if (Array.isArray(draft) && Array.isArray(snapshot)) {
            (draft as any[]).length = (snapshot as any[]).length;
          }
        },
        this.options
      );

      apply(stateReference as object, patches, { mutable: true });
      this.state = stateReference;
      return;
    }

    this.state = snapshot;
  }

  private captureTransactionSnapshot(): TransactionSnapshot<S, P> {
    return {
      state:
        this.mutable && isObjectLike(this.state)
          ? cloneInitialSnapshot(this.state)
          : this.state,
      stateReference: this.state,
      position: this.position,
      allPatches: cloneTravelPatches(this.allPatches),
      allMetadata: cloneTravelMetadataList(this.allMetadata),
      tempPatches: cloneTravelPatches(this.tempPatches),
      tempMetadata: cloneTravelMetadata(this.tempMetadata),
      initialState: cloneInitialSnapshot(this.initialState),
      initialPosition: this.initialPosition,
      initialPatches: this.initialPatches
        ? cloneTravelPatches(this.initialPatches)
        : undefined,
      initialMetadata: this.initialMetadata
        ? cloneTravelMetadataList(this.initialMetadata)
        : undefined,
      trackingPauseDepth: this.trackingPauseDepth,
      branchDiscardEffects: this.transactionBranchDiscardEffects.slice(),
      hasObserverEffects: this.transactionHasObserverEffects,
      needsCompatibilityCheck: this.transactionNeedsCompatibilityCheck,
    };
  }

  private restoreTransactionSnapshot(
    snapshot: TransactionSnapshot<S, P>
  ): void {
    this.restoreStateFromSnapshot(snapshot.state, snapshot.stateReference);
    this.position = snapshot.position;
    this.allPatches = cloneTravelPatches(snapshot.allPatches);
    this.allMetadata = cloneTravelMetadataList(snapshot.allMetadata);
    this.tempPatches = cloneTravelPatches(snapshot.tempPatches);
    this.tempMetadata = cloneTravelMetadata(snapshot.tempMetadata);
    this.initialState = cloneInitialSnapshot(snapshot.initialState);
    this.initialPosition = snapshot.initialPosition;
    this.initialPatches = snapshot.initialPatches
      ? cloneTravelPatches(snapshot.initialPatches)
      : undefined;
    this.initialMetadata = snapshot.initialMetadata
      ? cloneTravelMetadataList(snapshot.initialMetadata)
      : undefined;
    this.trackingPauseDepth = snapshot.trackingPauseDepth;
    this.transactionBranchDiscardEffects =
      snapshot.branchDiscardEffects.slice();
    this.transactionHasObserverEffects = snapshot.hasObserverEffects;
    this.transactionNeedsCompatibilityCheck = snapshot.needsCompatibilityCheck;

    this.invalidateHistoryCache();
  }

  /**
   * Check if patches contain root-level replacement operations
   * Root replacement cannot be done mutably as it changes the type/value of the entire state
   */
  private hasRootReplacement(patches: Patches<P>): boolean {
    return patches.some(
      (patch) =>
        ((Array.isArray(patch.path) && patch.path.length === 0) ||
          patch.path === '') &&
        patch.op === 'replace'
    );
  }

  private applyImmutably<T>(state: T, patches: Patches<P>): T {
    const { enablePatches: _enablePatches, ...replayOptions } = this.options;
    return apply(
      state as object,
      patches,
      replayOptions as Parameters<typeof apply>[2]
    ) as T;
  }

  /**
   * Get the current state
   */
  getState = () => this.state;

  /**
   * Update the state
   */
  public setState<U extends Updater<S>>(
    updater: SynchronousUpdater<S, U>,
    metadata?: TravelMetadata
  ): void;
  public setState(updater: Updater<S>, metadata?: TravelMetadata): void {
    this.assertCanMutate('setState');

    let patches: Patches<P>;
    let inversePatches: Patches<P>;
    let branchDiscard: BranchDiscardEffect<P> | undefined;
    const storedMetadata = cloneTravelMetadata(metadata);

    const canUseMutableRoot = this.mutable && isObjectLike(this.state);
    const isFunctionUpdater = typeof updater === 'function';
    if (isFunctionUpdater && isKnownAsyncFunction(updater)) {
      throw new TypeError('Travels: setState callback must be synchronous.');
    }
    const stateIsArray = Array.isArray(this.state);
    const updaterIsArray = Array.isArray(updater);
    const canMutatePlainObjects =
      !stateIsArray &&
      !updaterIsArray &&
      isPlainObject(this.state) &&
      isPlainObject(updater);
    const canMutateArrays =
      stateIsArray &&
      updaterIsArray &&
      hasOnlyArrayIndices(this.state) &&
      hasOnlyArrayIndices(updater);
    const canMutateWithValue =
      canUseMutableRoot &&
      !isFunctionUpdater &&
      (canMutateArrays || canMutatePlainObjects);
    const useMutable =
      (isFunctionUpdater && canUseMutableRoot) || canMutateWithValue;

    if (this.mutable && !canUseMutableRoot && !this.mutableFallbackWarned) {
      this.mutableFallbackWarned = true;

      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          'Travels: mutable mode requires the state root to be an object. Falling back to immutable updates.'
        );
      }
    }

    if (useMutable) {
      // For observable state: generate patches then apply mutably
      const [nextState, p, ip] = create(
        this.state,
        isFunctionUpdater
          ? (draft: Draft<S>) =>
              assertSynchronousResult(
                (updater as (draft: Draft<S>) => S | void)(draft),
                'setState'
              )
          : (draft: Draft<S>) => {
              overwriteDraftWith(draft!, updater);
            },
        this.options
      ) as [S, Patches<P>, Patches<P>];

      const replacesRoot = this.hasRootReplacement(p);
      // Mutable state and removed values can remain reachable through reactive
      // stores or caller-held references. Archive detached patch values before
      // applying the original forward patches to the live state so neither
      // later mutation nor lazy observer access can rewrite history.
      patches = clonePatchGroup(p);
      inversePatches = clonePatchGroup(ip);

      if (replacesRoot) {
        if (
          process.env.NODE_ENV !== 'production' &&
          !this.mutableRootReplaceWarned
        ) {
          this.mutableRootReplaceWarned = true;
          console.warn(
            'Travels: mutable mode cannot apply root replacements in place. Falling back to immutable update for this change.'
          );
        }

        // Root replacement cannot be applied mutably; fall back to immutable assignment.
        this.state = nextState;
      } else {
        // Apply the original patches. Applying the archived clones would make
        // their object-valued payloads part of the live state again.
        apply(this.state as object, p, { mutable: true });
      }
    } else {
      // For immutable state: create new object
      const [nextState, p, ip] = (typeof updater === 'function'
        ? create(
            this.state,
            (draft: Draft<S>) => {
              const result = (updater as (draft: Draft<S>) => S | void)(draft);
              assertSynchronousResult(result, 'setState');
              if (result === draft) {
                return result as S;
              }
              return isObjectLike(result) && !containsDraft(result)
                ? (rawReturn(result as object) as S)
                : (result as S);
            },
            this.options
          )
        : create(
            this.state,
            () =>
              isObjectLike(updater)
                ? (rawReturn(updater as object) as S)
                : (updater as S),
            this.options
          )) as unknown as [S, Patches<P>, Patches<P>];

      patches = this.mutable ? clonePatchGroup(p) : p;
      inversePatches = this.mutable ? clonePatchGroup(ip) : ip;
      this.state = nextState;
    }

    const hasNoChanges = patches.length === 0 && inversePatches.length === 0;

    if (hasNoChanges) {
      return;
    }

    if (this.trackingPauseDepth > 0) {
      this.resetHistoryToCurrentState();
      this.invalidateHistoryCache();
      this.checkStateCompatibilityAfterCommit();
      this.emitChange('replaceStateWithoutHistory', metadata);
      return;
    }

    if (this.isAutoArchiving()) {
      const notLast = this.position < this.allPatches.patches.length;

      // Remove all patches after the current position
      if (notLast) {
        branchDiscard = this.discardFutureFrom(this.position);
      }

      this.allPatches.patches.push(patches);
      this.allPatches.inversePatches.push(inversePatches);
      this.allMetadata.push(storedMetadata);

      this.position =
        this.maxHistory < this.allPatches.patches.length
          ? this.maxHistory
          : this.position + 1;

      this.trimHistoryToMax();
    } else {
      const hasPendingArchive = this.tempPatches.patches.length > 0;
      const hasFuture = this.position < this.allPatches.patches.length;

      // Remove all patches after the current position
      if (hasFuture) {
        branchDiscard = this.discardFutureFrom(this.position);
      }

      if (!hasPendingArchive || hasFuture) {
        this.position =
          this.maxHistory < this.allPatches.patches.length + 1
            ? this.maxHistory
            : this.position + 1;
        historyEntryIdentities.set(patches, {});
      }

      if (hasFuture) {
        this.tempPatches.patches.length = 0;
        this.tempPatches.inversePatches.length = 0;
        this.tempMetadata = undefined;
      }

      this.tempPatches.patches.push(patches);
      this.tempPatches.inversePatches.push(inversePatches);
      if (metadata !== undefined || this.tempMetadata === undefined) {
        this.tempMetadata = storedMetadata;
      }
    }

    this.invalidateHistoryCache();
    this.checkStateCompatibilityAfterCommit();
    this.emitChange('setState', metadata, branchDiscard);
  }

  /**
   * Archive the current state (only for manual archive mode)
   */
  private archivePending(
    metadata?: TravelMetadata,
    publishChange = true
  ): boolean {
    if (!this.tempPatches.patches.length) return false;
    const archiveMetadata =
      metadata === undefined ? this.tempMetadata : metadata;
    const storedMetadata = cloneTravelMetadata(archiveMetadata);
    const pendingArchive = this.getPendingArchiveEntry();

    this.allPatches.patches.push(pendingArchive.patches);
    this.allPatches.inversePatches.push(pendingArchive.inversePatches);
    this.allMetadata.push(storedMetadata);

    // Respect maxHistory limit
    this.trimHistoryToMax();

    // Clear temporary patches after archiving
    this.tempPatches.patches.length = 0;
    this.tempPatches.inversePatches.length = 0;
    this.tempMetadata = undefined;

    this.invalidateHistoryCache();
    if (publishChange) {
      this.emitChange('archive', archiveMetadata);
    }
    return true;
  }

  public archive(metadata?: TravelMetadata): void {
    this.assertCanMutate('archive');

    if (this.autoArchive) {
      console.warn('Auto archive is enabled, no need to archive manually');
      return;
    }

    this.archivePending(metadata);
  }

  public transaction<FN extends () => unknown>(
    metadata: TravelMetadata,
    fn: FN & SynchronousFunction<FN>
  ): void;
  public transaction<FN extends () => unknown>(
    fn: FN & SynchronousFunction<FN>
  ): void;
  public transaction(
    metadataOrFn: TravelMetadata | (() => void),
    maybeFn?: () => void
  ): void {
    this.assertCanMutate('transaction');

    const metadata =
      typeof metadataOrFn === 'function'
        ? undefined
        : cloneTravelMetadata(metadataOrFn);
    const fn = typeof metadataOrFn === 'function' ? metadataOrFn : maybeFn;

    if (!fn) {
      return;
    }

    if (isKnownAsyncFunction(fn)) {
      throw this.reportError(
        'TRANSACTION_FAILED',
        new TypeError('Travels: transaction callback must be synchronous.')
      );
    }

    const previousMetadata = this.transactionMetadata;
    const isRootTransaction = this.transactionDepth === 0;
    const transactionSnapshot = this.captureTransactionSnapshot();
    let failure: { error: unknown } | undefined;

    this.transactionDepth += 1;
    if (isRootTransaction) {
      this.transactionMetadata = metadata;
      const visiblePatches = this.getAllPatches();
      this.transactionVisibleEntryIds = new Set(
        visiblePatches.patches.map(getHistoryEntryIdentity)
      );
      this.transactionHasObserverEffects = false;
      this.transactionNeedsCompatibilityCheck = false;
    } else if (!this.transactionMetadata && metadata) {
      this.transactionMetadata = metadata;
    }
    try {
      assertSynchronousResult(fn(), 'transaction');
    } catch (error) {
      failure = { error };
      this.restoreTransactionSnapshot(transactionSnapshot);
      this.transactionMetadata = previousMetadata;
    } finally {
      this.transactionDepth -= 1;

      if (this.transactionDepth === 0) {
        if (!failure) {
          const committed = this.archivePending(
            this.transactionMetadata,
            false
          );
          const shouldPublish = committed || this.transactionHasObserverEffects;
          if (this.transactionNeedsCompatibilityCheck) {
            this.warnAboutStateCompatibility(this.state);
          }
          if (shouldPublish) {
            this.emitChange('transaction', this.transactionMetadata);
          }
          this.flushTransactionBranchDiscards();
        }
        this.transactionVisibleEntryIds = undefined;
        this.transactionMetadata = previousMetadata;
        this.transactionHasObserverEffects =
          transactionSnapshot.hasObserverEffects;
        this.transactionNeedsCompatibilityCheck =
          transactionSnapshot.needsCompatibilityCheck;
      }
    }

    if (failure) {
      throw this.reportError('TRANSACTION_FAILED', failure.error);
    }
  }

  public batch<FN extends () => unknown>(
    metadata: TravelMetadata,
    fn: FN & SynchronousFunction<FN>
  ): void;
  public batch<FN extends () => unknown>(
    fn: FN & SynchronousFunction<FN>
  ): void;
  public batch(
    metadataOrFn: TravelMetadata | (() => void),
    maybeFn?: () => void
  ): void {
    this.assertCanMutate('batch');
    this.transaction(metadataOrFn as any, maybeFn as any);
  }

  public pauseTracking(): void {
    this.assertCanMutate('pauseTracking');
    this.trackingPauseDepth += 1;
  }

  public resumeTracking(): void {
    this.assertCanMutate('resumeTracking');
    this.trackingPauseDepth = Math.max(0, this.trackingPauseDepth - 1);
  }

  public replaceStateWithoutHistory(updater: Updater<S>): void {
    this.assertCanMutate('replaceStateWithoutHistory');
    const historyVersionBefore = this.historyVersion;

    this.pauseTracking();
    try {
      this.setState(updater);
    } finally {
      this.resumeTracking();
    }

    if (
      this.historyVersion === historyVersionBefore &&
      // Mutable stores can change externally before this no-op updater rebases the baseline.
      (this.hasRecordedHistory() || this.mutable)
    ) {
      this.resetHistoryToCurrentState();
      this.invalidateHistoryCache();
      this.emitChange('replaceStateWithoutHistory');
    }
  }

  /**
   * Get all patches including temporary patches
   */
  private getPendingArchiveEntry(): {
    patches: Patches<P>;
    inversePatches: Patches<P>;
  } {
    const patches = composePatchGroups(this.tempPatches.patches, 'forward');
    historyEntryIdentities.set(
      patches,
      getHistoryEntryIdentity(this.tempPatches.patches[0])
    );

    return {
      patches,
      inversePatches: composePatchGroups(
        this.tempPatches.inversePatches,
        'backward'
      ),
    };
  }

  private getAllPatches(): TravelPatches<P> {
    const shouldArchive =
      !this.isAutoArchiving() && !!this.tempPatches.patches.length;

    if (shouldArchive) {
      const pendingArchive = this.getPendingArchiveEntry();
      const combined = {
        patches: this.allPatches.patches.concat([pendingArchive.patches]),
        inversePatches: this.allPatches.inversePatches.concat([
          pendingArchive.inversePatches,
        ]),
      };

      if (this.maxHistory === 0) {
        return cloneTravelPatches();
      }

      if (combined.patches.length > this.maxHistory) {
        return {
          patches: combined.patches.slice(-this.maxHistory),
          inversePatches: combined.inversePatches.slice(-this.maxHistory),
        };
      }

      return combined;
    }

    return this.allPatches;
  }

  /**
   * Get the complete history of states
   *
   * @returns The history array. Reference equality indicates cache hit.
   *
   * @remarks
   * **IMPORTANT**: Treat the returned array and every state entry as read-only.
   * They are cached internally.
   * - In development mode, only the array container is frozen.
   * - State entries are shared cached snapshots and are not deep-frozen.
   * - In production mode, modifying the array or its entries will corrupt the cache.
   */
  public getHistory(): readonly S[] {
    if (
      this.historyCache &&
      this.historyCache.version === this.historyVersion
    ) {
      return this.historyCache.history;
    }

    let currentState = this.state;
    const _allPatches = this.getAllPatches();

    const patches =
      !this.isAutoArchiving() && _allPatches.patches.length > this.maxHistory
        ? _allPatches.patches.slice(
            _allPatches.patches.length - this.maxHistory
          )
        : _allPatches.patches;
    const inversePatches =
      !this.isAutoArchiving() &&
      _allPatches.inversePatches.length > this.maxHistory
        ? _allPatches.inversePatches.slice(
            _allPatches.inversePatches.length - this.maxHistory
          )
        : _allPatches.inversePatches;

    // Build future history
    const futureHistory: S[] = [];
    for (let i = this.position; i < patches.length; i++) {
      currentState = this.applyImmutably(currentState, patches[i]);
      futureHistory.push(currentState);
    }

    // Build past history
    currentState = this.state;
    const pastHistory: S[] = [];
    for (let i = this.position - 1; i > -1; i--) {
      currentState = this.applyImmutably(currentState, inversePatches[i]);
      pastHistory.push(currentState);
    }
    pastHistory.reverse();

    const history: S[] = [...pastHistory, this.state, ...futureHistory];

    this.historyCache = {
      version: this.historyVersion,
      history,
    };

    // In development mode, freeze the history container to catch push/splice.
    // Entries remain shared cached snapshots and should be treated as read-only.
    if (process.env.NODE_ENV !== 'production') {
      Object.freeze(history);
    }

    return history;
  }

  /**
   * Go to a specific position in the history
   */
  public go(nextPosition: number): void {
    this.assertCanMutate('go');

    if (typeof nextPosition !== 'number' || !Number.isFinite(nextPosition)) {
      console.warn(`Can't go to invalid position ${nextPosition}`);
      return;
    }

    if (!Number.isInteger(nextPosition)) {
      const normalizedPosition = Math.trunc(nextPosition);
      console.warn(
        `Can't go to non-integer position ${nextPosition}. Using ${normalizedPosition} instead.`
      );
      nextPosition = normalizedPosition;
    }

    const shouldArchive =
      !this.isAutoArchiving() && !!this.tempPatches.patches.length;

    if (shouldArchive) {
      this.archivePending();
    }

    const _allPatches = this.getAllPatches();
    const back = nextPosition < this.position;

    if (nextPosition > _allPatches.patches.length) {
      console.warn(`Can't go forward to position ${nextPosition}`);
      nextPosition = _allPatches.patches.length;
    }

    if (nextPosition < 0) {
      console.warn(`Can't go back to position ${nextPosition}`);
      nextPosition = 0;
    }

    if (nextPosition === this.position) return;

    const patchesToApply = back
      ? composePatchGroups(
          _allPatches.inversePatches
            .slice(-this.maxHistory)
            .slice(nextPosition, this.position),
          'backward'
        )
      : composePatchGroups(
          _allPatches.patches
            .slice(-this.maxHistory)
            .slice(this.position, nextPosition),
          'forward'
        );

    // Can only use mutable mode if:
    // 1. mutable mode is enabled
    // 2. current state is an object
    // 3. patches don't contain root-level replacements (which change the entire state)
    const canGoMutably =
      this.mutable &&
      isObjectLike(this.state) &&
      !this.hasRootReplacement(patchesToApply);

    if (canGoMutably) {
      // For observable state: mutate in place
      apply(this.state as object, patchesToApply, { mutable: true });
    } else {
      // For immutable state or primitive types: create new state
      this.state = this.applyImmutably(this.state, patchesToApply);
    }

    this.position = nextPosition;
    this.invalidateHistoryCache();
    this.emitChange('go');
  }

  /**
   * Go back in the history
   */
  public back(amount: number = 1): void {
    this.assertCanMutate('back');
    this.go(this.position - amount);
  }

  /**
   * Go forward in the history
   */
  public forward(amount: number = 1): void {
    this.assertCanMutate('forward');
    this.go(this.position + amount);
  }

  /**
   * Reset to the initial state
   */
  public reset(): void {
    this.assertCanMutate('reset');

    const canResetMutably =
      this.mutable && canSynchronizeMutableRoots(this.state, this.initialState);

    if (canResetMutably) {
      // For observable state: use patch system to reset to initial state
      // Generate patches from current state to initial state
      const [, patches] = create(
        this.state,
        (draft) => {
          // Clear all properties
          for (const key of Object.keys(draft as object)) {
            delete (draft as any)[key];
          }
          // Deep copy all properties from initialState
          deepClone(this.initialState, draft);
          if (Array.isArray(draft) && Array.isArray(this.initialState)) {
            (draft as any[]).length = (this.initialState as any[]).length;
          }
        },
        this.options
      );

      apply(this.state as object, patches, { mutable: true });
    } else {
      // For immutable state: restore from a snapshot clone.
      this.state = this.applyImmutably(
        cloneInitialSnapshot(this.initialState),
        []
      );
    }

    this.position = this.initialPosition;
    this.allPatches = cloneTravelPatches(this.initialPatches);
    this.allMetadata = this.initialMetadata
      ? cloneTravelMetadataList(this.initialMetadata)
      : [];
    this.tempPatches = cloneTravelPatches();
    this.tempMetadata = undefined;

    if (this.transactionDepth > 0) {
      // A reset can restore only part of a queued discarded branch. Reconcile
      // by entry identity so effects for history that remains absent survive.
      const restoredEntryIds = new Set(
        this.allPatches.patches.map(getHistoryEntryIdentity)
      );
      this.transactionBranchDiscardEffects =
        this.transactionBranchDiscardEffects.flatMap((effect) =>
          filterBranchDiscardEffect(
            effect,
            (entryId) => !restoredEntryIds.has(entryId)
          )
        );
    }

    this.invalidateHistoryCache();
    this.emitChange('reset');
  }

  /**
   * Remove all history and make the current state (including any unarchived temp patches) as the new initial state.
   *
   * This is a destructive operation that discards all history and overwrites
   * the internal baseline. Future `reset()` calls will return to this snapshot.
   */
  public rebase(): void {
    this.assertCanMutate('rebase');

    this.initialState = cloneInitialSnapshot(this.state);
    this.initialPosition = 0;
    this.initialPatches = undefined;
    this.initialMetadata = undefined;

    this.position = 0;
    this.allPatches = cloneTravelPatches();
    this.allMetadata = [];
    this.tempPatches = cloneTravelPatches();
    this.tempMetadata = undefined;

    this.invalidateHistoryCache();
    this.emitChange('rebase');
  }

  /**
   * Check if it's possible to go back
   */
  public canBack(): boolean {
    return this.position > 0;
  }

  /**
   * Check if it's possible to go forward
   */
  public canForward(): boolean {
    const shouldArchive =
      !this.isAutoArchiving() && !!this.tempPatches.patches.length;
    const _allPatches = this.getAllPatches();

    // Temporary patches represent the current state, not a future state
    return shouldArchive
      ? this.position < _allPatches.patches.length - 1
      : this.position < _allPatches.patches.length;
  }

  /**
   * Check if it's possible to archive the current state
   */
  public canArchive(): boolean {
    return !this.autoArchive && !!this.tempPatches.patches.length;
  }

  /**
   * Get the current position in the history
   */
  public getPosition(): number {
    return this.position;
  }

  /**
   * Get the patches history
   */
  public getPatches(): TravelPatches<P> {
    const shouldArchive =
      !this.isAutoArchiving() && !!this.tempPatches.patches.length;
    const patchSource = shouldArchive ? this.getAllPatches() : this.allPatches;
    return cloneTravelPatches(patchSource);
  }

  /**
   * Serialize the current state, patch history, and position for persistence.
   */
  public serialize(): TravelsSerializedHistory<S, P> {
    return {
      version: TRAVELS_HISTORY_SCHEMA_VERSION,
      state: cloneInitialSnapshot(this.state),
      patches: this.getPatches(),
      position: this.getPosition(),
      metadata: this.getMetadata(),
    };
  }

  public getMetadata(): Array<TravelMetadata | undefined> {
    const metadata = alignMetadataToPatchCount(
      this.allMetadata,
      this.allPatches.patches.length
    );

    if (!this.isAutoArchiving() && this.tempPatches.patches.length) {
      metadata.push(cloneTravelMetadata(this.tempMetadata));
    }

    if (this.maxHistory === 0) {
      return [];
    }

    return metadata.length > this.maxHistory
      ? metadata.slice(-this.maxHistory)
      : metadata;
  }

  public getHistoryEntries(): TravelHistoryEntry<P>[] {
    return this.toEntries(this.getPatches(), this.getMetadata());
  }

  /**
   * Get the controls object
   */
  public getControls() {
    if (this.controlsCache) {
      return this.controlsCache as A extends true
        ? RebasableTravelsControls<S, F, P>
        : RebasableManualTravelsControls<S, F, P>;
    }

    const self = this;
    const controls:
      | RebasableTravelsControls<S, F, P>
      | RebasableManualTravelsControls<S, F, P> = {
      get position(): number {
        return self.getPosition();
      },
      getHistory: () => self.getHistory() as Value<S, F>[],
      get patches(): TravelPatches<P> {
        return self.getPatches();
      },
      back: (amount?: number): void => self.back(amount),
      forward: (amount?: number): void => self.forward(amount),
      reset: (): void => self.reset(),
      go: (position: number): void => self.go(position),
      canBack: (): boolean => self.canBack(),
      canForward: (): boolean => self.canForward(),
      rebase: (): void => self.rebase(),
    };

    if (!this.autoArchive) {
      (controls as RebasableManualTravelsControls<S, F, P>).archive = (
        metadata?: TravelMetadata
      ): void => self.archive(metadata);
      (controls as RebasableManualTravelsControls<S, F, P>).canArchive =
        (): boolean => self.canArchive();
    }

    if (process.env.NODE_ENV !== 'production') {
      Object.freeze(controls);
    }

    this.controlsCache = controls;

    return controls as A extends true
      ? RebasableTravelsControls<S, F, P>
      : RebasableManualTravelsControls<S, F, P>;
  }
}
