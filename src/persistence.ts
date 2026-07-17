import { apply } from 'mutative';
import type {
  PatchesOption,
  TravelMetadata,
  TravelPatches,
  TravelsDeserializeOptions,
  TravelsPersistenceErrorCode,
  TravelsReplayOptions,
  TravelsSerializedHistory,
} from './type.js';
import { composePatchGroups } from './replay.js';
import { consumePromiseLikeRejection } from './utils.js';

export const TRAVELS_HISTORY_SCHEMA_VERSION = 1 as const;

export class TravelsPersistenceError extends Error {
  public readonly code: TravelsPersistenceErrorCode;
  public readonly cause?: unknown;
  public readonly entryIndex?: number;
  public readonly direction?: 'forward' | 'inverse';

  constructor(
    code: TravelsPersistenceErrorCode,
    message: string,
    options: {
      cause?: unknown;
      entryIndex?: number;
      direction?: 'forward' | 'inverse';
    } = {}
  ) {
    super(message);
    this.name = 'TravelsPersistenceError';
    this.code = code;
    this.cause = options.cause;
    this.entryIndex = options.entryIndex;
    this.direction = options.direction;
  }
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isValidMetadataEntry = (entry: unknown): boolean => {
  return entry == null || (isObjectRecord(entry) && !Array.isArray(entry));
};

const isUnsafePatchPathSegment = (
  segment: unknown,
  index: number,
  length: number
): boolean =>
  segment === '__proto__' ||
  (segment === 'constructor' && index < length - 1);

const isValidPatchPath = (
  path: unknown,
  allowNonJsonPathSegments: boolean
): boolean => {
  if (typeof path === 'string') {
    if (path === '') {
      return true;
    }
    if (!path.startsWith('/') || /~(?:[^01]|$)/.test(path)) {
      return false;
    }

    const segments = path
      .split('/')
      .slice(1)
      .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
    return segments.every(
      (segment, index) =>
        !isUnsafePatchPathSegment(segment, index, segments.length)
    );
  }

  return (
    Array.isArray(path) &&
    Array.from({ length: path.length }, (_, index) => index).every((index) => {
      if (!hasOwn(path, String(index))) {
        return false;
      }

      const segment = path[index];
      const isJsonPathSegment =
        typeof segment === 'string' ||
        (typeof segment === 'number' &&
          Number.isFinite(segment) &&
          Number.isInteger(segment) &&
          segment >= 0);
      const isRuntimeTerminalSegment =
        allowNonJsonPathSegments && index === path.length - 1;
      return (
        (isJsonPathSegment || isRuntimeTerminalSegment) &&
        !isUnsafePatchPathSegment(segment, index, path.length)
      );
    })
  );
};

const getPatchOperationFields = (
  operation: Record<string, unknown>
): { op: unknown; path: unknown } | null => {
  const op = Object.getOwnPropertyDescriptor(operation, 'op');
  const path = Object.getOwnPropertyDescriptor(operation, 'path');
  if (!op || !path || !('value' in op) || !('value' in path)) {
    return null;
  }

  return { op: op.value, path: path.value };
};

const isDenseArray = (value: unknown): value is unknown[] =>
  Array.isArray(value) &&
  Array.from({ length: value.length }, (_, index) => index).every((index) =>
    hasOwn(value, String(index))
  );

const isRootPatchPath = (path: unknown): boolean => {
  return path === '' || (Array.isArray(path) && path.length === 0);
};

const isValidPatchOperation = (
  operation: unknown,
  allowNonJsonPathSegments: boolean
): boolean => {
  if (!isObjectRecord(operation) || Array.isArray(operation)) {
    return false;
  }

  const fields = getPatchOperationFields(operation);
  if (!fields) {
    return false;
  }

  const { op, path } = fields;
  if (op !== 'add' && op !== 'remove' && op !== 'replace') {
    return false;
  }

  if (!isValidPatchPath(path, allowNonJsonPathSegments)) {
    return false;
  }

  if ((op === 'add' || op === 'remove') && isRootPatchPath(path)) {
    return false;
  }

  if ((op === 'add' || op === 'replace') && !hasOwn(operation, 'value')) {
    return false;
  }

  return true;
};

const isPatchHistoryEntries = (
  value: unknown,
  allowNonJsonPathSegments: boolean
): value is unknown[][] => {
  return (
    isDenseArray(value) &&
    value.every(
      (entry) =>
        isDenseArray(entry) &&
        entry.every((operation) =>
          isValidPatchOperation(operation, allowNonJsonPathSegments)
        )
    )
  );
};

export const getTravelPatchesValidationError = <
  P extends PatchesOption = {},
>(
  patches: unknown,
  options: { allowNonJsonPathSegments?: boolean } = {}
): string | null => {
  if (!isObjectRecord(patches) || Array.isArray(patches)) {
    return `patches must be an object with 'patches' and 'inversePatches' arrays`;
  }

  const patchHistory = patches as TravelPatches<P>;
  const allowNonJsonPathSegments =
    options.allowNonJsonPathSegments === true;
  if (
    !isPatchHistoryEntries(
      patchHistory.patches,
      allowNonJsonPathSegments
    ) ||
    !isPatchHistoryEntries(
      patchHistory.inversePatches,
      allowNonJsonPathSegments
    )
  ) {
    return `patches must have 'patches' and 'inversePatches' arrays of JSON Patch operations`;
  }

  if (patchHistory.patches.length !== patchHistory.inversePatches.length) {
    return `patches.patches and patches.inversePatches must have the same length`;
  }

  return null;
};

const parseSnapshotInput = (input: unknown): unknown => {
  if (typeof input !== 'string') {
    return input;
  }

  try {
    return JSON.parse(input);
  } catch (error) {
    throw new TravelsPersistenceError(
      'PARSE_ERROR',
      'Travels: persisted history is not valid JSON.',
      { cause: error }
    );
  }
};

const normalizeSnapshot = <S, P extends PatchesOption = {}>(
  snapshot: unknown
): TravelsSerializedHistory<S, P> => {
  if (!isObjectRecord(snapshot)) {
    throw new TravelsPersistenceError(
      'INVALID_SCHEMA',
      'Travels: persisted history must be an object.'
    );
  }

  if (snapshot.version !== TRAVELS_HISTORY_SCHEMA_VERSION) {
    throw new TravelsPersistenceError(
      'UNSUPPORTED_VERSION',
      `Travels: unsupported persisted history version ${String(
        snapshot.version
      )}. Expected ${TRAVELS_HISTORY_SCHEMA_VERSION}.`
    );
  }

  if (!('state' in snapshot)) {
    throw new TravelsPersistenceError(
      'INVALID_SCHEMA',
      "Travels: persisted history must include 'state'."
    );
  }

  if (!('patches' in snapshot)) {
    throw new TravelsPersistenceError(
      'INVALID_SCHEMA',
      "Travels: persisted history must include 'patches'."
    );
  }

  const patches = snapshot.patches as TravelPatches<P> | undefined;
  const patchValidationError = getTravelPatchesValidationError(patches);
  if (patchValidationError) {
    throw new TravelsPersistenceError(
      'INVALID_PATCHES',
      `Travels: ${patchValidationError}.`
    );
  }

  const position = snapshot.position;
  if (
    typeof position !== 'number' ||
    !Number.isFinite(position) ||
    !Number.isInteger(position) ||
    position < 0 ||
    (patches && position > patches.patches.length)
  ) {
    throw new TravelsPersistenceError(
      'INVALID_SCHEMA',
      `Travels: persisted history position ${String(
        position
      )} is invalid for the patch history.`
    );
  }

  const metadataInput = snapshot.metadata as unknown;
  let metadata: Array<TravelMetadata | undefined> | undefined;
  if (metadataInput !== undefined) {
    if (!Array.isArray(metadataInput)) {
      throw new TravelsPersistenceError(
        'INVALID_SCHEMA',
        "Travels: persisted history 'metadata' must be an array when provided."
      );
    }

    const metadataEntries: unknown[] = metadataInput;
    if (!metadataEntries.every(isValidMetadataEntry)) {
      throw new TravelsPersistenceError(
        'INVALID_SCHEMA',
        "Travels: persisted history 'metadata' entries must be objects, null, or undefined."
      );
    }

    metadata = metadataEntries.map((entry) =>
      entry == null ? undefined : (entry as TravelMetadata)
    );
  }

  if (metadata !== undefined && metadata.length !== patches!.patches.length) {
    throw new TravelsPersistenceError(
      'INVALID_SCHEMA',
      "Travels: persisted history 'metadata' length must match patches length."
    );
  }

  return {
    version: TRAVELS_HISTORY_SCHEMA_VERSION,
    state: snapshot.state as S,
    patches: patches as TravelPatches<P>,
    position,
    metadata,
  };
};

const ownKeyCount = (value: object): number => Reflect.ownKeys(value).length;

const areReplayStatesEqual = (
  left: unknown,
  right: unknown,
  leftToRight = new WeakMap<object, object>(),
  rightToLeft = new WeakMap<object, object>()
): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (
    left === null ||
    right === null ||
    (typeof left !== 'object' && typeof left !== 'function') ||
    (typeof right !== 'object' && typeof right !== 'function')
  ) {
    return false;
  }

  const leftObject = left as object;
  const rightObject = right as object;
  const knownRight = leftToRight.get(leftObject);
  if (knownRight) {
    return knownRight === rightObject;
  }
  const knownLeft = rightToLeft.get(rightObject);
  if (knownLeft) {
    return knownLeft === leftObject;
  }

  const prototype = Object.getPrototypeOf(leftObject);
  if (prototype !== Object.getPrototypeOf(rightObject)) {
    return false;
  }

  leftToRight.set(leftObject, rightObject);
  rightToLeft.set(rightObject, leftObject);

  const ownKeys = ownKeyCount(leftObject) + ownKeyCount(rightObject);

  // Array length is non-enumerable. The enumerable key comparison below still
  // distinguishes holes from present indices, including explicit `undefined`.
  if (Array.isArray(left) || Array.isArray(right)) {
    if (
      !Array.isArray(left) ||
      !Array.isArray(right) ||
      prototype !== Array.prototype ||
      left.length !== right.length
    ) {
      return false;
    }
  }

  if (prototype === Date.prototype) {
    return (
      ownKeys === 0 &&
      Object.is((left as Date).getTime(), (right as Date).getTime())
    );
  }

  if (prototype === RegExp.prototype) {
    const leftRegExp = left as RegExp;
    const rightRegExp = right as RegExp;
    return (
      ownKeys === 2 &&
      leftRegExp.lastIndex === 0 &&
      rightRegExp.lastIndex === 0 &&
      leftRegExp.source === rightRegExp.source &&
      leftRegExp.flags === rightRegExp.flags
    );
  }

  if (prototype === Map.prototype) {
    if (
      ownKeys !== 0 ||
      (left as Map<unknown, unknown>).size !==
        (right as Map<unknown, unknown>).size
    ) {
      return false;
    }

    const leftEntries = Array.from(left as Map<unknown, unknown>);
    const rightEntries = Array.from(right as Map<unknown, unknown>);
    return leftEntries.every(
      ([leftKey, leftValue], index) =>
        areReplayStatesEqual(
          leftKey,
          rightEntries[index][0],
          leftToRight,
          rightToLeft
        ) &&
        areReplayStatesEqual(
          leftValue,
          rightEntries[index][1],
          leftToRight,
          rightToLeft
        )
    );
  }

  if (prototype === Set.prototype) {
    if (
      ownKeys !== 0 ||
      (left as Set<unknown>).size !== (right as Set<unknown>).size
    ) {
      return false;
    }

    const leftValues = Array.from(left as Set<unknown>);
    const rightValues = Array.from(right as Set<unknown>);
    return leftValues.every((leftValue, index) =>
      areReplayStatesEqual(
        leftValue,
        rightValues[index],
        leftToRight,
        rightToLeft
      )
    );
  }

  // Unknown prototypes can hide observable data in internal slots. Treat them
  // as unverifiable instead of accepting two empty enumerable surfaces.
  if (
    !Array.isArray(left) &&
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    return false;
  }

  const leftKeys = Object.keys(leftObject);
  const rightKeyCount = Object.keys(rightObject).length;
  const arrayLength = Array.isArray(left) ? left.length : -1;
  const intrinsicKeyCount = arrayLength < 0 ? 0 : 2;

  if (
    ownKeys !== leftKeys.length + rightKeyCount + intrinsicKeyCount ||
    leftKeys.length !== rightKeyCount ||
    leftKeys.some((key) => {
      if (!Object.prototype.propertyIsEnumerable.call(rightObject, key)) {
        return true;
      }
      if (arrayLength < 0) {
        return false;
      }

      const index = Number(key);
      return (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= arrayLength ||
        String(index) !== key
      );
    })
  ) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftDescriptor = Object.getOwnPropertyDescriptor(leftObject, key);
    const rightDescriptor = Object.getOwnPropertyDescriptor(rightObject, key);
    if (!leftDescriptor || !rightDescriptor) {
      return false;
    }

    return (
      'value' in leftDescriptor &&
      'value' in rightDescriptor &&
      areReplayStatesEqual(
        leftDescriptor.value,
        rightDescriptor.value,
        leftToRight,
        rightToLeft
      )
    );
  });
};

const invalidHistoryError = (
  entryIndex: number,
  direction: 'forward' | 'inverse',
  detail: string,
  cause?: unknown
): TravelsPersistenceError =>
  new TravelsPersistenceError(
    'INVALID_HISTORY',
    `Travels: persisted history entry ${entryIndex} could not be validated in the ${direction} direction: ${detail}`,
    { cause, entryIndex, direction }
  );

const replayHistoryEntry = <S, P extends PatchesOption = {}>(
  state: S,
  snapshot: TravelsSerializedHistory<S, P>,
  entryIndex: number,
  direction: 'forward' | 'inverse',
  replayOptions: TravelsReplayOptions
): S => {
  const group =
    direction === 'forward'
      ? snapshot.patches.patches[entryIndex]
      : snapshot.patches.inversePatches[entryIndex];
  const patches = composePatchGroups(
    [group],
    direction === 'forward' ? 'forward' : 'backward'
  );

  try {
    return apply(
      state as object,
      patches,
      replayOptions as Parameters<typeof apply>[2]
    ) as S;
  } catch (error) {
    throw invalidHistoryError(
      entryIndex,
      direction,
      'patch replay failed.',
      error
    );
  }
};

const assertRoundTrip = (
  expected: unknown,
  actual: unknown,
  entryIndex: number,
  direction: 'forward' | 'inverse'
): void => {
  let matches = false;
  try {
    matches = areReplayStatesEqual(expected, actual);
  } catch (error) {
    throw invalidHistoryError(
      entryIndex,
      direction,
      'state comparison failed.',
      error
    );
  }

  if (!matches) {
    throw invalidHistoryError(
      entryIndex,
      direction,
      'forward and inverse patches are not reversible.'
    );
  }
};

const validateTravelsHistorySemantics = <
  S,
  P extends PatchesOption = {},
>(
  snapshot: TravelsSerializedHistory<S, P>,
  replayOptions: TravelsReplayOptions = {}
): TravelsSerializedHistory<S, P> => {
  const validationReplayOptions = {
    strict: replayOptions.strict,
    mark: replayOptions.mark,
    // Freezing is an output policy, not part of patch interpretation. Applying
    // it here can freeze structurally shared objects owned by the caller.
    enableAutoFreeze: false,
  };
  let stateAfter = snapshot.state;

  for (let index = snapshot.position - 1; index >= 0; index -= 1) {
    const stateBefore = replayHistoryEntry(
      stateAfter,
      snapshot,
      index,
      'inverse',
      validationReplayOptions
    );
    const replayedStateAfter = replayHistoryEntry(
      stateBefore,
      snapshot,
      index,
      'forward',
      validationReplayOptions
    );
    assertRoundTrip(stateAfter, replayedStateAfter, index, 'forward');
    stateAfter = stateBefore;
  }

  let stateBefore = snapshot.state;
  for (
    let index = snapshot.position;
    index < snapshot.patches.patches.length;
    index += 1
  ) {
    const nextState = replayHistoryEntry(
      stateBefore,
      snapshot,
      index,
      'forward',
      validationReplayOptions
    );
    const replayedStateBefore = replayHistoryEntry(
      nextState,
      snapshot,
      index,
      'inverse',
      validationReplayOptions
    );
    assertRoundTrip(stateBefore, replayedStateBefore, index, 'inverse');
    stateBefore = nextState;
  }

  return snapshot;
};

const resolveFallback = <S, P extends PatchesOption = {}>(
  fallback: NonNullable<TravelsDeserializeOptions<S, P>['fallback']>
): TravelsSerializedHistory<S, P> =>
  typeof fallback === 'function' ? fallback() : fallback;

const validateNormalizedSnapshot = <S, P extends PatchesOption = {}>(
  snapshot: TravelsSerializedHistory<S, P>,
  options: TravelsDeserializeOptions<S, P>
): TravelsSerializedHistory<S, P> =>
  options.validation === 'semantic'
    ? validateTravelsHistorySemantics(snapshot, options.replayOptions)
    : snapshot;

const toPersistenceError = (
  error: unknown,
  code: TravelsPersistenceErrorCode,
  message: string
): TravelsPersistenceError =>
  error instanceof TravelsPersistenceError
    ? error
    : new TravelsPersistenceError(code, message, { cause: error });

const notifyPersistenceError = (
  onError: TravelsDeserializeOptions<unknown>['onError'],
  error: TravelsPersistenceError
): void => {
  try {
    const result = onError?.(error);
    consumePromiseLikeRejection(result, () => undefined);
  } catch {
    // Error observers must not replace the persistence failure or block recovery.
  }
};

export const deserializeTravelsHistory = <
  S,
  P extends PatchesOption = {},
>(
  input: unknown,
  options: TravelsDeserializeOptions<S, P> = {}
): TravelsSerializedHistory<S, P> => {
  if (
    options.validation !== undefined &&
    options.validation !== 'semantic' &&
    options.validation !== 'structural'
  ) {
    throw new TypeError(
      "Travels: validation must be either 'semantic' or 'structural'."
    );
  }

  try {
    const parsed = parseSnapshotInput(input);
    let migrated = parsed;

    if (options.migrate) {
      try {
        migrated = options.migrate(parsed);
      } catch (error) {
        throw new TravelsPersistenceError(
          'MIGRATION_FAILED',
          'Travels: persisted history migration failed.',
          { cause: error }
        );
      }
    }

    return validateNormalizedSnapshot(
      normalizeSnapshot<S, P>(migrated),
      options
    );
  } catch (error) {
    const persistenceError = toPersistenceError(
      error,
      'INVALID_SCHEMA',
      'Travels: persisted history could not be deserialized.'
    );

    notifyPersistenceError(options.onError, persistenceError);

    if (options.fallback === undefined) {
      throw persistenceError;
    }

    try {
      return validateNormalizedSnapshot(
        normalizeSnapshot<S, P>(resolveFallback(options.fallback)),
        options
      );
    } catch (fallbackCause) {
      const fallbackError = new TravelsPersistenceError(
        'FALLBACK_FAILED',
        'Travels: persisted history fallback could not be deserialized.',
        { cause: fallbackCause }
      );
      notifyPersistenceError(options.onError, fallbackError);
      throw fallbackError;
    }
  }
};
