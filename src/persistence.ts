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
import {
  consumePromiseLikeRejection,
  isArrayIndex,
  isPlainObject,
  isValidPatchPath,
} from './utils.js';

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

type SynchronousPersistenceCallback = 'migrate' | 'fallback';

const assertSynchronousPersistenceResult = <T>(
  callback: SynchronousPersistenceCallback,
  value: T
): T => {
  if (!consumePromiseLikeRejection(value, () => undefined)) {
    return value;
  }

  const code = callback === 'migrate' ? 'MIGRATION_FAILED' : 'FALLBACK_FAILED';
  throw new TravelsPersistenceError(
    code,
    `Travels: persisted history ${callback} callback must return synchronously.`
  );
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isValidMetadataEntry = (entry: unknown): boolean => {
  return entry == null || (isObjectRecord(entry) && !Array.isArray(entry));
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

const isValidPatchOperation = (operation: unknown): boolean => {
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

  if (!isValidPatchPath(path)) {
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

const isPatchHistoryEntries = (value: unknown): value is unknown[][] => {
  return (
    isDenseArray(value) &&
    value.every(
      (entry) =>
        isDenseArray(entry) &&
        entry.every((operation) => isValidPatchOperation(operation))
    )
  );
};

export const getTravelPatchesValidationError = <P extends PatchesOption = {}>(
  patches: unknown
): string | null => {
  if (!isObjectRecord(patches) || Array.isArray(patches)) {
    return `patches must be an object with 'patches' and 'inversePatches' arrays`;
  }

  const patchHistory = patches as TravelPatches<P>;
  if (
    !isPatchHistoryEntries(patchHistory.patches) ||
    !isPatchHistoryEntries(patchHistory.inversePatches)
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

const areReplayStatesEqual = (
  left: unknown,
  right: unknown,
  leftToRight = new WeakMap<object, object>(),
  rightValues = new WeakSet<object>()
): boolean => {
  if (
    left === null ||
    right === null ||
    (typeof left !== 'object' && typeof left !== 'function') ||
    (typeof right !== 'object' && typeof right !== 'function')
  ) {
    return Object.is(left, right);
  }

  const leftObject = left as object;
  const rightObject = right as object;
  const knownRight = leftToRight.get(leftObject);
  if (knownRight) {
    return knownRight === rightObject;
  }
  if (rightValues.has(rightObject)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(leftObject);
  if (
    prototype !== Object.getPrototypeOf(rightObject) ||
    Object.isExtensible(leftObject) !== Object.isExtensible(rightObject)
  ) {
    return false;
  }

  leftToRight.set(leftObject, rightObject);
  rightValues.add(rightObject);

  const leftKeys = Reflect.ownKeys(leftObject);
  const rightKeys = Reflect.ownKeys(rightObject);
  const keyCount = leftKeys.length;
  if (
    keyCount !== rightKeys.length ||
    leftKeys.some((key, index) => key !== rightKeys[index])
  ) {
    return false;
  }
  const leftIsArray = Array.isArray(left);
  const isRegExp = prototype === RegExp.prototype;

  if (
    leftIsArray !== Array.isArray(right) ||
    (leftIsArray && prototype !== Array.prototype)
  ) {
    return false;
  }

  if (prototype === Date.prototype) {
    return (
      !keyCount &&
      Object.is((left as Date).getTime(), (right as Date).getTime())
    );
  }

  if (isRegExp) {
    const leftRegExp = left as RegExp;
    const rightRegExp = right as RegExp;
    if (
      keyCount !== 1 ||
      leftKeys[0] !== 'lastIndex' ||
      leftRegExp.lastIndex !== 0 ||
      rightRegExp.lastIndex !== 0 ||
      leftRegExp.source !== rightRegExp.source ||
      leftRegExp.flags !== rightRegExp.flags
    ) {
      return false;
    }
  }

  // Unknown prototypes can hide observable data in internal slots. Treat them
  // as unverifiable instead of accepting two empty enumerable surfaces.
  if (!leftIsArray && !isRegExp && !isPlainObject(left)) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftDescriptor = Object.getOwnPropertyDescriptor(leftObject, key);
    const rightDescriptor = Object.getOwnPropertyDescriptor(rightObject, key);
    if (!leftDescriptor || !rightDescriptor) {
      return false;
    }

    return (
      (leftIsArray
        ? key === 'length' ||
          (isArrayIndex(key, left.length) && leftDescriptor.enumerable)
        : isRegExp ||
          (typeof key === 'string' && leftDescriptor.enumerable)) &&
      'value' in leftDescriptor &&
      'value' in rightDescriptor &&
      leftDescriptor.writable === rightDescriptor.writable &&
      leftDescriptor.enumerable === rightDescriptor.enumerable &&
      leftDescriptor.configurable === rightDescriptor.configurable &&
      areReplayStatesEqual(
        leftDescriptor.value,
        rightDescriptor.value,
        leftToRight,
        rightValues
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
    `Travels: entry ${entryIndex} failed ${direction}: ${detail}`,
    { cause, entryIndex, direction }
  );

const invalidHistoryIsolationError = (
  cause?: unknown
): TravelsPersistenceError =>
  new TravelsPersistenceError(
    'INVALID_HISTORY',
    'Travels: persisted history semantic validation graph could not be isolated.',
    { cause }
  );

function isolateReplayValue<T>(value: T): T;
function isolateReplayValue<T>(
  value: T,
  entryIndex: number,
  direction: 'forward' | 'inverse'
): T;
function isolateReplayValue<T>(
  value: T,
  entryIndex?: number,
  direction?: 'forward' | 'inverse'
): T {
  let cause: unknown;
  try {
    if (areReplayStatesEqual(value, value)) {
      const clone = structuredClone(value);
      if (areReplayStatesEqual(value, clone)) {
        return clone;
      }
    }
  } catch (error) {
    cause = error;
  }
  if (entryIndex === undefined || direction === undefined) {
    throw invalidHistoryIsolationError(cause);
  }
  throw invalidHistoryError(
    entryIndex,
    direction,
    'state clone failed.',
    cause
  );
}

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
  try {
    if (areReplayStatesEqual(expected, actual)) {
      return;
    }
  } catch {
    // Isolated replay values should be comparable; fail closed if they are not.
  }
  throw invalidHistoryError(entryIndex, direction, 'irreversible patches');
};

const validateTravelsHistorySemantics = <
  S,
  P extends PatchesOption = {},
>(
  snapshot: TravelsSerializedHistory<S, P>,
  replayOptions: TravelsReplayOptions = {}
): TravelsSerializedHistory<S, P> => {
  const entryCount = snapshot.patches.patches.length;
  const validationReplayOptions = {
    strict: replayOptions.strict,
    mark: replayOptions.mark,
  };
  const preparedSnapshot = {
    state: snapshot.state,
    patches: snapshot.patches,
    metadata: snapshot.metadata,
  } as TravelsSerializedHistory<S, P>;

  if (entryCount === 0) {
    isolateReplayValue(preparedSnapshot);
  }

  for (const direction of ['inverse', 'forward'] as const) {
    const isForward = direction === 'forward';
    const reverseDirection = isForward ? 'inverse' : 'forward';
    let index = isForward ? snapshot.position : snapshot.position - 1;
    const end = isForward ? entryCount : -1;
    if (index === end) {
      continue;
    }

    const validationSnapshot = isolateReplayValue(preparedSnapshot);
    let state = validationSnapshot.state;

    for (; index !== end; index += isForward ? 1 : -1) {
      const expected = isolateReplayValue(state, index, reverseDirection);
      const adjacent = replayHistoryEntry(
        state,
        validationSnapshot,
        index,
        direction,
        validationReplayOptions
      );
      const restored = replayHistoryEntry(
        isolateReplayValue(adjacent, index, reverseDirection),
        validationSnapshot,
        index,
        reverseDirection,
        validationReplayOptions
      );
      assertRoundTrip(expected, restored, index, reverseDirection);
      state = adjacent;
    }
  }

  return snapshot;
};

const resolveFallback = <S, P extends PatchesOption = {}>(
  fallback: NonNullable<TravelsDeserializeOptions<S, P>['fallback']>
): TravelsSerializedHistory<S, P> => {
  const resolved = typeof fallback === 'function' ? fallback() : fallback;
  return assertSynchronousPersistenceResult('fallback', resolved);
};

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
      let migrationResult: TravelsSerializedHistory<S, P>;
      try {
        migrationResult = options.migrate(parsed);
      } catch (error) {
        throw new TravelsPersistenceError(
          'MIGRATION_FAILED',
          'Travels: persisted history migration failed.',
          { cause: error }
        );
      }

      migrated = assertSynchronousPersistenceResult('migrate', migrationResult);
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
      const fallbackError =
        fallbackCause instanceof TravelsPersistenceError &&
        fallbackCause.code === 'FALLBACK_FAILED'
          ? fallbackCause
          : new TravelsPersistenceError(
              'FALLBACK_FAILED',
              'Travels: persisted history fallback could not be deserialized.',
              { cause: fallbackCause }
            );
      notifyPersistenceError(options.onError, fallbackError);
      throw fallbackError;
    }
  }
};
