import {
  apply,
  create,
  type Options as MutativeOptions,
  type Patches,
} from 'mutative';
import { TravelsTypeError } from '../errors.js';
import type {
  PatchesOption,
  TravelsControlledApply,
} from '../type.js';
import {
  containsMapOrSet,
  getPatchPathSegments,
  isObjectLike,
} from '../utils.js';
import { clonePatchGroupDetached } from './patch-utils.js';
import { isRootReplacement } from '../replay.js';

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

export const assertSynchronousResult = <T>(value: T, api: string): T => {
  if (!isPromiseLike(value)) {
    return value;
  }

  silenceNativePromiseRejection(value);
  throw new TravelsTypeError(
    'ASYNC_CALLBACK',
    `Travels: ${api} callback must be synchronous.`
  );
};

export const assertSupportedRuntimeState = (
  value: unknown,
  knownCollectionFree?: WeakSet<object>
): void => {
  if (containsMapOrSet(value, new WeakSet<object>(), knownCollectionFree)) {
    throw new TravelsTypeError(
      'UNSUPPORTED_STATE',
      'Travels: Map and Set are not supported in state. Normalize collections to plain objects or dense arrays.'
    );
  }
};

const resolveOwnDataValue = (
  value: unknown,
  segments: Array<string | number>
): { found: boolean; value?: unknown } => {
  let current = value;
  for (const segment of segments) {
    if (!isObjectLike(current)) {
      return { found: false };
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      current as object,
      segment as PropertyKey
    );
    if (!descriptor || !('value' in descriptor)) {
      return { found: false };
    }
    current = descriptor.value;
  }
  return { found: true, value: current };
};

/**
 * Validate a state an external owner just committed or returned.
 *
 * Rescanning the whole graph uncached is O(state) on every commit and
 * navigation, which dominates controlled journals over large state. The cost
 * only buys something when the owner can have mutated an object the cache
 * already accepted, so the scan is narrowed by how the owner answered:
 *
 * - A root the cache has already seen means the owner reused its reference and
 *   may have mutated anywhere inside it, so the whole graph is rescanned.
 * - A fresh root is walked through the cache, which skips the structurally
 *   shared branches the owner did not rebuild, and the sub-trees this
 *   transition wrote are rescanned unconditionally on top of that.
 */
export const assertSupportedExternalState = <P extends PatchesOption = {}>(
  state: unknown,
  patches: Patches<P>,
  knownCollectionFree: WeakSet<object>
): void => {
  if (isObjectLike(state) && knownCollectionFree.has(state as object)) {
    assertSupportedRuntimeState(state);
    return;
  }

  const seen = new WeakSet<object>();

  for (const operation of patches) {
    const segments = getPatchPathSegments((operation as { path: unknown }).path);
    if (!segments) {
      // An unreadable path leaves no bounded region to trust: check it all.
      assertSupportedRuntimeState(state);
      return;
    }

    const target = resolveOwnDataValue(state, segments);
    if (!target.found) {
      continue;
    }
    if (containsMapOrSet(target.value, seen, undefined, false)) {
      throw new TravelsTypeError(
        'UNSUPPORTED_STATE',
        'Travels: Map and Set are not supported in state. Normalize collections to plain objects or dense arrays.'
      );
    }
  }

  // `seen` carries the sub-trees above so the cached pass does not repeat them.
  if (containsMapOrSet(state, seen, knownCollectionFree)) {
    throw new TravelsTypeError(
      'UNSUPPORTED_STATE',
      'Travels: Map and Set are not supported in state. Normalize collections to plain objects or dense arrays.'
    );
  }
};

export const assertSupportedPatchValues = <P extends PatchesOption = {}>(
  patches: Patches<P>,
  inversePatches: Patches<P>,
  knownCollectionFree?: WeakSet<object>
): [boolean, boolean] => {
  const groups = [patches, inversePatches] as const;
  const hasObjectValues: [boolean, boolean] = [false, false];
  const seen = new WeakSet<object>();

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    for (const operation of groups[groupIndex]) {
      const value = (operation as { value?: unknown }).value;
      if (!isObjectLike(value)) {
        continue;
      }

      hasObjectValues[groupIndex] = true;
      if (containsMapOrSet(value, seen, knownCollectionFree, false)) {
        throw new TravelsTypeError(
          'UNSUPPORTED_STATE',
          'Travels: Map and Set are not supported in state. Normalize collections to plain objects or dense arrays.'
        );
      }
    }
  }

  return hasObjectValues;
};

export const freezeAcceptedState = (state: unknown): void => {
  void create([state], () => undefined, { enableAutoFreeze: true });
};

type StateDriverOptions<
  S,
  F extends boolean,
  P extends PatchesOption,
> = {
  mutable: boolean;
  mutativeOptions: MutativeOptions<PatchesOption | true, F>;
  controlledApply?: TravelsControlledApply<S, P>;
  collectionFreeObjects: WeakSet<object>;
};

type NavigationTransition<S, P extends PatchesOption> = {
  state: S;
  patches: Patches<P>;
  inversePatches: Patches<P>;
  fromPosition: number;
  toPosition: number;
  journalMutableState: (state: object, inversePatches: Patches<P>) => void;
};

export class StateDriver<
  S,
  F extends boolean,
  P extends PatchesOption = {},
> {
  private readonly mutable: boolean;
  private readonly mutativeOptions: MutativeOptions<PatchesOption | true, F>;
  private readonly controlledApply?: TravelsControlledApply<S, P>;
  private readonly collectionFreeObjects: WeakSet<object>;

  constructor(options: StateDriverOptions<S, F, P>) {
    this.mutable = options.mutable;
    this.mutativeOptions = options.mutativeOptions;
    this.controlledApply = options.controlledApply;
    this.collectionFreeObjects = options.collectionFreeObjects;
  }

  public get isControlled(): boolean {
    return this.controlledApply !== undefined;
  }

  public applyImmutably<T>(state: T, patches: Patches<P>): T {
    const { enablePatches: _enablePatches, ...replayOptions } =
      this.mutativeOptions;
    return apply(
      state as object,
      patches,
      replayOptions as Parameters<typeof apply>[2]
    ) as T;
  }

  public applyNavigation(
    transition: NavigationTransition<S, P>
  ): S {
    if (this.controlledApply) {
      const controlledState = assertSynchronousResult(
        this.controlledApply(
          Object.freeze({
            state: transition.state,
            patches: clonePatchGroupDetached(transition.patches),
            inversePatches: clonePatchGroupDetached(transition.inversePatches),
            fromPosition: transition.fromPosition,
            toPosition: transition.toPosition,
          })
        ),
        'controlledApply'
      );
      // A controlled owner may mutate and return a previously seen object, so
      // the sub-trees it just wrote are always rescanned.
      assertSupportedExternalState(
        controlledState,
        transition.patches,
        this.collectionFreeObjects
      );
      return controlledState;
    }

    const canApplyMutably =
      this.mutable &&
      isObjectLike(transition.state) &&
      !transition.patches.some(isRootReplacement);
    if (canApplyMutably) {
      transition.journalMutableState(
        transition.state as object,
        transition.inversePatches
      );
      apply(transition.state as object, transition.patches, { mutable: true });
      return transition.state;
    }

    return this.applyImmutably(transition.state, transition.patches);
  }
}
