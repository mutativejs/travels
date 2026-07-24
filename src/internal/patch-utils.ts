import type { Patches } from 'mutative';
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
