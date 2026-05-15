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
  TravelsSerializedHistory,
  Updater,
  Value,
} from './type';
import {
  deserializeTravelsHistory,
  TRAVELS_HISTORY_SCHEMA_VERSION,
} from './persistence';
import { findStateCompatibilityIssues } from './compatibility';
import { TravelsError } from './errors';
import { isObjectLike, isPlainObject } from './utils';

/**
 * Listener callback for state changes
 */
type Listener<S, P extends PatchesOption = {}> = (
  state: S,
  patches: TravelPatches<P>,
  position: number
) => void;

type TransactionSnapshot<S, P extends PatchesOption = {}> = {
  state: S;
  position: number;
  allPatches: TravelPatches<P>;
  allMetadata: Array<TravelMetadata | undefined>;
  tempPatches: TravelPatches<P>;
  tempMetadata?: TravelMetadata;
  initialState: S;
  initialPosition: number;
  initialPatches?: TravelPatches<P>;
  initialMetadata?: Array<TravelMetadata | undefined>;
  pendingState: S | null;
  pendingStateVersion: number;
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

const cloneTravelPatches = <P extends PatchesOption = {}>(
  base?: TravelPatches<P>
): TravelPatches<P> => ({
  patches: base
    ? base.patches.map((patch) =>
        patch.map((operation) => deepCloneValue(operation))
      )
    : [],
  inversePatches: base
    ? base.inversePatches.map((patch) =>
        patch.map((operation) => deepCloneValue(operation))
      )
    : [],
});

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

const isPatchHistoryEntries = (value: unknown): value is unknown[][] => {
  return Array.isArray(value) && value.every((entry) => Array.isArray(entry));
};

const getInitialPatchesValidationError = <P extends PatchesOption = {}>(
  initialPatches: TravelPatches<P> | undefined
): string | null => {
  if (!initialPatches) {
    return null;
  }

  if (
    !isPatchHistoryEntries(initialPatches.patches) ||
    !isPatchHistoryEntries(initialPatches.inversePatches)
  ) {
    return `initialPatches must have 'patches' and 'inversePatches' arrays`;
  }

  if (initialPatches.patches.length !== initialPatches.inversePatches.length) {
    return `initialPatches.patches and initialPatches.inversePatches must have the same length`;
  }

  return null;
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
  private autoArchive: A;
  private options: MutativeOptions<PatchesOption | true, F>;
  private onError?: (error: Error) => void;
  private onBranchDiscard?: (event: TravelsBranchDiscardEvent<P>) => void;
  private devtools?: (event: TravelsDevtoolsEvent<S, P>) => void;
  private listeners: Set<Listener<S, P>> = new Set();
  private pendingState: S | null = null;
  private pendingStateVersion = 0;
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
      devtools,
      patchesOptions,
      ...mutativeOptions
    } = options;
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
    this.devtools = devtools as ((event: TravelsDevtoolsEvent<S, P>) => void)
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
    if (
      !this.warnOnUnsupportedState ||
      process.env.NODE_ENV === 'production'
    ) {
      return;
    }

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
    return this.getPatches();
  }

  private notify(patches?: TravelPatches<P>): void {
    if (!this.listeners.size) {
      return;
    }
    const eventPatches = patches ?? this.getPatches();
    this.listeners.forEach((listener) =>
      listener(this.state, eventPatches, this.position)
    );
  }

  private emitDevtools(
    type: TravelsDevtoolsEvent<S, P>['type'],
    metadata?: TravelMetadata,
    patches?: TravelPatches<P>
  ): void {
    if (!this.devtools) {
      return;
    }
    const eventPatches = patches ?? this.getPatches();
    this.devtools?.({
      type,
      state: this.state,
      position: this.position,
      patches: eventPatches,
      metadata,
    });
  }

  private emitChange(
    type: TravelsDevtoolsEvent<S, P>['type'],
    metadata?: TravelMetadata
  ): void {
    const patches = this.getEventPatches();
    this.notify(patches);
    this.emitDevtools(type, metadata, patches);
  }

  private reportError(code: 'TRANSACTION_FAILED', error: unknown): TravelsError {
    const travelsError =
      error instanceof TravelsError
        ? error
        : new TravelsError(code, `Travels: ${code}`, { cause: error });
    this.onError?.(travelsError);
    return travelsError;
  }

  private toEntries(
    patches: TravelPatches<P>,
    metadata: Array<TravelMetadata | undefined> = []
  ): TravelHistoryEntry<P>[] {
    return patches.patches.map((patch, index) => ({
      patches: patch.map((operation) => deepCloneValue(operation)) as Patches<P>,
      inversePatches: patches.inversePatches[index].map((operation) =>
        deepCloneValue(operation)
      ) as Patches<P>,
      metadata: cloneTravelMetadata(metadata[index]),
    }));
  }

  private discardFutureFrom(position: number): void {
    if (position >= this.allPatches.patches.length) {
      return;
    }

    const discardedPatches = {
      patches: this.allPatches.patches.slice(position),
      inversePatches: this.allPatches.inversePatches.slice(position),
    } as TravelPatches<P>;
    const discardedMetadata = cloneTravelMetadataList(
      this.allMetadata.slice(position)
    );

    this.allPatches.patches.splice(
      position,
      this.allPatches.patches.length - position
    );
    this.allPatches.inversePatches.splice(
      position,
      this.allPatches.inversePatches.length - position
    );
    this.allMetadata.splice(position, this.allMetadata.length - position);

    this.onBranchDiscard?.({
      position,
      discarded: this.toEntries(discardedPatches, discardedMetadata),
    });
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

  private restoreStateFromSnapshot(snapshot: S): void {
    const canRestoreMutably =
      this.mutable && isObjectLike(this.state) && isObjectLike(snapshot);

    if (canRestoreMutably) {
      const [, patches] = create(
        this.state,
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

      apply(this.state as object, patches, { mutable: true });
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
      pendingState: this.pendingState,
      pendingStateVersion: this.pendingStateVersion,
    };
  }

  private restoreTransactionSnapshot(
    snapshot: TransactionSnapshot<S, P>
  ): void {
    this.restoreStateFromSnapshot(snapshot.state);
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
    this.pendingState = snapshot.pendingState;
    this.pendingStateVersion = snapshot.pendingStateVersion;

    this.invalidateHistoryCache();
    this.notify();
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

  /**
   * Get the current state
   */
  getState = () => this.state;

  /**
   * Update the state
   */
  public setState(updater: Updater<S>, metadata?: TravelMetadata): void {
    let patches: Patches<P>;
    let inversePatches: Patches<P>;
    let nextPendingState: S;

    const canUseMutableRoot = this.mutable && isObjectLike(this.state);
    const isFunctionUpdater = typeof updater === 'function';
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
          ? (updater as (draft: Draft<S>) => void)
          : (draft: Draft<S>) => {
              overwriteDraftWith(draft!, updater);
            },
        this.options
      ) as [S, Patches<P>, Patches<P>];

      patches = p;
      inversePatches = ip;

      if (this.hasRootReplacement(patches)) {
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
        nextPendingState = nextState;
      } else {
        // Apply patches to mutate the existing state object
        apply(this.state as object, patches, { mutable: true });

        // Keep the same reference
        nextPendingState = this.state;
      }
    } else {
      // For immutable state: create new object
      const [nextState, p, ip] = (
        typeof updater === 'function'
          ? create(
              this.state,
              (draft: Draft<S>) => {
                const result = (updater as (draft: Draft<S>) => S | void)(
                  draft
                );
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
            )
      ) as unknown as [S, Patches<P>, Patches<P>];

      patches = p;
      inversePatches = ip;
      this.state = nextState;
      nextPendingState = nextState;
    }

    const hasNoChanges = patches.length === 0 && inversePatches.length === 0;

    if (hasNoChanges) {
      return;
    }

    this.pendingState = nextPendingState;
    const pendingStateVersion = ++this.pendingStateVersion;

    // Reset pendingState asynchronously, but only if no newer update landed.
    Promise.resolve().then(() => {
      if (this.pendingStateVersion === pendingStateVersion) {
        this.pendingState = null;
      }
    });

    this.warnAboutStateCompatibility(this.state);

    if (this.trackingPauseDepth > 0) {
      this.resetHistoryToCurrentState();
      this.invalidateHistoryCache();
      this.emitChange('replaceStateWithoutHistory', metadata);
      return;
    }

    if (this.autoArchive) {
      const notLast = this.position < this.allPatches.patches.length;

      // Remove all patches after the current position
      if (notLast) {
        this.discardFutureFrom(this.position);
      }

      this.allPatches.patches.push(patches);
      this.allPatches.inversePatches.push(inversePatches);
      this.allMetadata.push(cloneTravelMetadata(metadata));

      this.position =
        this.maxHistory < this.allPatches.patches.length
          ? this.maxHistory
          : this.position + 1;

      this.trimHistoryToMax();
    } else {
      const notLast =
        this.position <
        this.allPatches.patches.length +
          Number(!!this.tempPatches.patches.length);

      // Remove all patches after the current position
      if (notLast) {
        this.discardFutureFrom(this.position);
      }

      if (!this.tempPatches.patches.length || notLast) {
        this.position =
          this.maxHistory < this.allPatches.patches.length + 1
            ? this.maxHistory
            : this.position + 1;
      }

      if (notLast) {
        this.tempPatches.patches.length = 0;
        this.tempPatches.inversePatches.length = 0;
        this.tempMetadata = undefined;
      }

      this.tempPatches.patches.push(patches);
      this.tempPatches.inversePatches.push(inversePatches);
      if (metadata !== undefined || this.tempMetadata === undefined) {
        this.tempMetadata = cloneTravelMetadata(metadata);
      }
    }

    this.invalidateHistoryCache();
    this.emitChange('setState', metadata);
  }

  /**
   * Archive the current state (only for manual archive mode)
   */
  private archivePending(metadata?: TravelMetadata): boolean {
    if (!this.tempPatches.patches.length) return false;
    const archiveMetadata =
      metadata === undefined ? this.tempMetadata : metadata;
    const pendingArchive = this.getPendingArchiveEntry();

    this.allPatches.patches.push(pendingArchive.patches);
    this.allPatches.inversePatches.push(pendingArchive.inversePatches);
    this.allMetadata.push(cloneTravelMetadata(archiveMetadata));

    // Respect maxHistory limit
    this.trimHistoryToMax();

    // Clear temporary patches after archiving
    this.tempPatches.patches.length = 0;
    this.tempPatches.inversePatches.length = 0;
    this.tempMetadata = undefined;

    this.invalidateHistoryCache();
    this.emitChange('archive', archiveMetadata);
    return true;
  }

  public archive(metadata?: TravelMetadata): void {
    if (this.autoArchive) {
      console.warn('Auto archive is enabled, no need to archive manually');
      return;
    }

    this.archivePending(metadata);
  }

  public transaction(
    metadata: TravelMetadata,
    fn: () => void
  ): void;
  public transaction(fn: () => void): void;
  public transaction(
    metadataOrFn: TravelMetadata | (() => void),
    maybeFn?: () => void
  ): void {
    const metadata =
      typeof metadataOrFn === 'function'
        ? undefined
        : cloneTravelMetadata(metadataOrFn);
    const fn = typeof metadataOrFn === 'function' ? metadataOrFn : maybeFn;

    if (!fn) {
      return;
    }

    const previousAutoArchive = this.autoArchive;
    const previousMetadata = this.transactionMetadata;
    const isRootTransaction = this.transactionDepth === 0;
    const transactionSnapshot = this.captureTransactionSnapshot();
    let failed = false;

    this.transactionDepth += 1;
    if (isRootTransaction) {
      this.transactionMetadata = metadata;
    } else if (!this.transactionMetadata && metadata) {
      this.transactionMetadata = metadata;
    }
    this.autoArchive = false as A;

    try {
      fn();
    } catch (error) {
      failed = true;
      this.restoreTransactionSnapshot(transactionSnapshot);
      this.transactionMetadata = previousMetadata;
      throw this.reportError('TRANSACTION_FAILED', error);
    } finally {
      this.transactionDepth -= 1;

      if (this.transactionDepth === 0) {
        this.autoArchive = previousAutoArchive;
        if (!failed) {
          const committed = this.archivePending(this.transactionMetadata);
          if (committed) {
            this.emitDevtools('transaction', this.transactionMetadata);
          }
        }
        this.transactionMetadata = previousMetadata;
      }
    }
  }

  public batch(metadata: TravelMetadata, fn: () => void): void;
  public batch(fn: () => void): void;
  public batch(
    metadataOrFn: TravelMetadata | (() => void),
    maybeFn?: () => void
  ): void {
    this.transaction(metadataOrFn as any, maybeFn as any);
  }

  public pauseTracking(): void {
    this.trackingPauseDepth += 1;
  }

  public resumeTracking(): void {
    this.trackingPauseDepth = Math.max(0, this.trackingPauseDepth - 1);
  }

  public replaceStateWithoutHistory(updater: Updater<S>): void {
    const historyVersionBefore = this.historyVersion;

    this.pauseTracking();
    try {
      this.setState(updater);
    } finally {
      this.resumeTracking();
    }

    if (this.historyVersion === historyVersionBefore) {
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
    // Use pendingState if available, otherwise use current state.
    const stateToUse = (this.pendingState ?? this.state) as object;

    // Merge temp patches into the same entry shape archive() would commit.
    const [, patches, inversePatches] = create(
      stateToUse,
      (draft) => apply(draft, this.tempPatches.inversePatches.flat().reverse()),
      this.options
    ) as [S, Patches<P>, Patches<P>];

    return {
      patches: inversePatches,
      inversePatches: patches,
    };
  }

  private getAllPatches(): TravelPatches<P> {
    const shouldArchive =
      !this.autoArchive && !!this.tempPatches.patches.length;

    if (shouldArchive) {
      const pendingArchive = this.getPendingArchiveEntry();
      return {
        patches: this.allPatches.patches.concat([pendingArchive.patches]),
        inversePatches: this.allPatches.inversePatches.concat([
          pendingArchive.inversePatches,
        ]),
      };
    }

    return this.allPatches;
  }

  /**
   * Get the complete history of states
   *
   * @returns The history array. Reference equality indicates cache hit.
   *
   * @remarks
   * **IMPORTANT**: Do not modify the returned array. It is cached internally.
   * - In development mode, the array is frozen
   * - In production mode, modifications will corrupt the cache
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
      !this.autoArchive && _allPatches.patches.length > this.maxHistory
        ? _allPatches.patches.slice(
            _allPatches.patches.length - this.maxHistory
          )
        : _allPatches.patches;
    const inversePatches =
      !this.autoArchive && _allPatches.inversePatches.length > this.maxHistory
        ? _allPatches.inversePatches.slice(
            _allPatches.inversePatches.length - this.maxHistory
          )
        : _allPatches.inversePatches;

    // Build future history
    const futureHistory: S[] = [];
    for (let i = this.position; i < patches.length; i++) {
      currentState = apply(currentState as object, patches[i]) as S;
      futureHistory.push(currentState);
    }

    // Build past history
    currentState = this.state;
    const pastHistory: S[] = [];
    for (let i = this.position - 1; i > -1; i--) {
      currentState = apply(currentState as object, inversePatches[i]) as S;
      pastHistory.push(currentState);
    }
    pastHistory.reverse();

    const history: S[] = [...pastHistory, this.state, ...futureHistory];

    this.historyCache = {
      version: this.historyVersion,
      history,
    };

    // In development mode, freeze the history array to prevent accidental mutations
    if (process.env.NODE_ENV !== 'production') {
      Object.freeze(history);
    }

    return history;
  }

  /**
   * Go to a specific position in the history
   */
  public go(nextPosition: number): void {
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
      !this.autoArchive && !!this.tempPatches.patches.length;

    if (shouldArchive) {
      this.archive();
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

    const inversePatchesForNavigation =
      shouldArchive && _allPatches.inversePatches.length > 0
        ? _allPatches.inversePatches.map((patch, index, allPatches) =>
            index === allPatches.length - 1 ? [...patch].reverse() : patch
          )
        : _allPatches.inversePatches;

    const patchesToApply = back
      ? inversePatchesForNavigation
          .slice(-this.maxHistory)
          .slice(nextPosition, this.position)
          .flat()
          .reverse()
      : _allPatches.patches
          .slice(-this.maxHistory)
          .slice(this.position, nextPosition)
          .flat();

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
      this.state = apply(this.state as object, patchesToApply) as S;
    }

    this.position = nextPosition;
    this.invalidateHistoryCache();
    this.emitChange('go');
  }

  /**
   * Go back in the history
   */
  public back(amount: number = 1): void {
    this.go(this.position - amount);
  }

  /**
   * Go forward in the history
   */
  public forward(amount: number = 1): void {
    this.go(this.position + amount);
  }

  /**
   * Reset to the initial state
   */
  public reset(): void {
    const canResetMutably =
      this.mutable &&
      isObjectLike(this.state) &&
      isObjectLike(this.initialState);

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
      this.state = cloneInitialSnapshot(this.initialState);
    }

    this.position = this.initialPosition;
    this.allPatches = cloneTravelPatches(this.initialPatches);
    this.allMetadata = this.initialMetadata
      ? cloneTravelMetadataList(this.initialMetadata)
      : [];
    this.tempPatches = cloneTravelPatches();
    this.tempMetadata = undefined;

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
      !this.autoArchive && !!this.tempPatches.patches.length;
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
      !this.autoArchive && !!this.tempPatches.patches.length;
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

    if (!this.autoArchive && this.tempPatches.patches.length) {
      metadata.push(cloneTravelMetadata(this.tempMetadata));
    }

    return metadata;
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
      (controls as RebasableManualTravelsControls<S, F, P>).archive =
        (metadata?: TravelMetadata): void => self.archive(metadata);
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
