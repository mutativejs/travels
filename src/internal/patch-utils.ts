import type { Patches } from 'mutative';
import { TravelsTypeError } from '../errors.js';
import type { PatchesOption, TravelPatches } from '../type.js';
import { isPlainObject } from '../utils.js';

export const tryStructuredClone = <T>(value: T): T | undefined => {
  if (typeof (globalThis as any).structuredClone !== 'function') {
    return undefined;
  }

  try {
    return (globalThis as any).structuredClone(value) as T;
  } catch {
    return undefined;
  }
};

export const deepCloneValue = (
  value: any,
  seen = new WeakMap<object, any>()
): any => {
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

const uncloneablePatchValue = (
  path: string,
  cause?: unknown
): TravelsTypeError =>
  new TravelsTypeError(
    'UNCLONEABLE_PATCH_VALUE',
    `Travels: patch value at ${path} cannot be safely detached. ` +
      `Use plain data or a value whose structured clone preserves its runtime type.`,
    { cause }
  );

const cloneDetachedDataProperties = (
  source: object,
  target: object,
  seen: WeakMap<object, unknown>,
  path: string,
  skip: ReadonlySet<PropertyKey> = new Set()
): void => {
  let keys: PropertyKey[];
  try {
    keys = Reflect.ownKeys(source);
  } catch (error) {
    throw uncloneablePatchValue(path, error);
  }

  for (const key of keys) {
    if (skip.has(key)) continue;

    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(source, key);
    } catch (error) {
      throw uncloneablePatchValue(`${path}.${String(key)}`, error);
    }
    if (!descriptor || !('value' in descriptor)) {
      throw uncloneablePatchValue(`${path}.${String(key)}`);
    }

    try {
      Object.defineProperty(target, key, {
        ...descriptor,
        value: cloneDetachedPatchValue(
          descriptor.value,
          seen,
          `${path}.${String(key)}`
        ),
      });
    } catch (error) {
      if (error instanceof TravelsTypeError) throw error;
      throw uncloneablePatchValue(`${path}.${String(key)}`, error);
    }
  }
};

const getClonePrototype = (value: object, path: string): object | null => {
  try {
    return Object.getPrototypeOf(value);
  } catch (error) {
    throw uncloneablePatchValue(path, error);
  }
};

/**
 * Carry the source's extensibility over to its clone.
 *
 * Copying descriptors reproduces `writable` and `configurable` for properties
 * that already exist, but says nothing about whether new ones may be added, so
 * a frozen source would otherwise detach into an extensible clone. Apply this
 * only once the clone's own properties are in place, because each of these
 * calls forbids the definitions that follow.
 */
const preserveClonedIntegrity = (
  source: object,
  target: object,
  path: string
): void => {
  try {
    // Extensibility is a single flag, while isFrozen and isSealed each walk
    // every own property. An extensible source can be neither, so the ordinary
    // case settles here instead of paying for two property scans per object.
    if (Object.isExtensible(source)) {
      return;
    }

    if (Object.isFrozen(source)) {
      Object.freeze(target);
    } else if (Object.isSealed(source)) {
      Object.seal(target);
    } else {
      Object.preventExtensions(target);
    }
  } catch (error) {
    throw uncloneablePatchValue(path, error);
  }
};

const cloneDetachedPatchValue = (
  value: unknown,
  seen: WeakMap<object, unknown>,
  path: string
): unknown => {
  if (typeof value === 'function') {
    throw uncloneablePatchValue(path);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    if (getClonePrototype(value, path) !== Array.prototype) {
      throw uncloneablePatchValue(path);
    }
    const cloned: unknown[] = new Array(value.length);
    seen.set(value, cloned);
    cloneDetachedDataProperties(
      value,
      cloned,
      seen,
      path,
      new Set<PropertyKey>(['length'])
    );
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor && 'value' in lengthDescriptor) {
      Object.defineProperty(cloned, 'length', {
        ...lengthDescriptor,
        value: value.length,
      });
    }
    preserveClonedIntegrity(value, cloned, path);
    return cloned;
  }

  if (value instanceof Date) {
    if (getClonePrototype(value, path) !== Date.prototype) {
      throw uncloneablePatchValue(path);
    }
    const cloned = new Date(value.getTime());
    seen.set(value, cloned);
    cloneDetachedDataProperties(value, cloned, seen, path);
    preserveClonedIntegrity(value, cloned, path);
    return cloned;
  }

  const prototype = getClonePrototype(value, path);
  if (isPlainObject(value) || prototype === null) {
    const cloned = Object.create(prototype) as Record<PropertyKey, unknown>;
    seen.set(value, cloned);
    cloneDetachedDataProperties(value, cloned, seen, path);
    preserveClonedIntegrity(value, cloned, path);
    return cloned;
  }

  // Other runtime objects can carry internal slots, identity-sensitive
  // behavior, or custom prototypes that a clone would silently change.
  throw uncloneablePatchValue(path);
};

/**
 * Clone a patch group for an external boundary. Unlike clonePatchGroup(), this
 * fails closed when a mutable patch value cannot be fully detached without
 * changing its runtime type or invoking an accessor.
 */
export const clonePatchGroupDetached = <P extends PatchesOption = {}>(
  patch: Patches<P>
): Patches<P> => {
  const cloned = new Array(patch.length) as Patches<P>;
  const seen = new WeakMap<object, unknown>();
  for (let index = 0; index < patch.length; index += 1) {
    const operation = patch[index] as {
      op: string;
      path: string | Array<string | number>;
      value?: unknown;
    };
    const detached = {
      op: operation.op,
      path: Array.isArray(operation.path)
        ? [...operation.path]
        : operation.path,
    } as typeof operation;
    if (Object.prototype.hasOwnProperty.call(operation, 'value')) {
      detached.value = cloneDetachedPatchValue(
        operation.value,
        seen,
        `operation[${index}].value`
      );
    }
    cloned[index] = detached as Patches<P>[number];
  }
  const identity = historyEntryIdentities.get(patch);
  if (identity) {
    historyEntryIdentities.set(cloned, identity);
  }
  return cloned;
};

const historyEntryIdentities = new WeakMap<object, object>();

export const getHistoryEntryIdentity = (entry: object): object => {
  let identity = historyEntryIdentities.get(entry);
  if (!identity) {
    identity = {};
    historyEntryIdentities.set(entry, identity);
  }
  return identity;
};

export const setHistoryEntryIdentity = (
  entry: object,
  identity: object = {}
): void => {
  historyEntryIdentities.set(entry, identity);
};

export const clonePatchGroup = <P extends PatchesOption = {}>(
  patch: Patches<P>
): Patches<P> => {
  const cloned = new Array(patch.length) as Patches<P>;
  for (let index = 0; index < patch.length; index += 1) {
    const operation = patch[index] as {
      op: string;
      path: string | Array<string | number>;
      value?: unknown;
    };
    const detached = {
      op: operation.op,
      path: Array.isArray(operation.path)
        ? [...operation.path]
        : operation.path,
    } as typeof operation;
    if (Object.prototype.hasOwnProperty.call(operation, 'value')) {
      detached.value = deepCloneValue(operation.value);
    }
    cloned[index] = detached as Patches<P>[number];
  }
  const identity = historyEntryIdentities.get(patch);
  if (identity) {
    historyEntryIdentities.set(cloned, identity);
  }
  return cloned;
};

export const detachMutablePatchValues = <P extends PatchesOption = {}>(
  patch: Patches<P>,
  hasObjectValues: boolean
): Patches<P> => (hasObjectValues ? clonePatchGroup(patch) : patch);

export const clonePatchGroups = <P extends PatchesOption = {}>(
  groups: Patches<P>[]
): Patches<P>[] => {
  const cloned = new Array(groups.length) as Patches<P>[];
  for (let index = 0; index < groups.length; index += 1) {
    cloned[index] = clonePatchGroup(groups[index]);
  }
  return cloned;
};

export const cloneTravelPatches = <P extends PatchesOption = {}>(
  base?: TravelPatches<P>
): TravelPatches<P> => ({
  patches: base ? clonePatchGroups(base.patches) : [],
  inversePatches: base ? clonePatchGroups(base.inversePatches) : [],
});

export const createPatchDelta = <P extends PatchesOption = {}>(
  patches: Patches<P>,
  inversePatches: Patches<P>
): TravelPatches<P> =>
  patches.length === 0 && inversePatches.length === 0
    ? cloneTravelPatches()
    : { patches: [patches], inversePatches: [inversePatches] };
