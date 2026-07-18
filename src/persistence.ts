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
  containsMapOrSet,
  consumePromiseLikeRejection,
  isArrayIndex,
  isPlainObject,
  isStandardDenseArray,
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

const isValidMetadataEntry = (entry: unknown): boolean => {
  return entry == null || (isObjectRecord(entry) && !Array.isArray(entry));
};

type DataPropertyDescriptor = PropertyDescriptor & { value: unknown };

const getOwnDataProperty = (
  value: object,
  key: PropertyKey
): DataPropertyDescriptor | undefined => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor
    ? (descriptor as DataPropertyDescriptor)
    : undefined;
};

const getPatchOperationFields = (
  operation: Record<string, unknown>
): { op: unknown; path: unknown; value?: unknown } | null => {
  const op = getOwnDataProperty(operation, 'op');
  const path = getOwnDataProperty(operation, 'path');
  const valueDescriptor = Object.getOwnPropertyDescriptor(operation, 'value');
  if (
    !op ||
    !path ||
    (valueDescriptor !== undefined && !('value' in valueDescriptor))
  ) {
    return null;
  }

  const fields: { op: unknown; path: unknown; value?: unknown } = {
    op: op.value,
    path: path.value,
  };
  if (valueDescriptor && 'value' in valueDescriptor) {
    fields.value = valueDescriptor.value;
  }
  return fields;
};

const isRootPatchPath = (path: unknown): boolean => {
  return path === '' || (Array.isArray(path) && path.length === 0);
};

const normalizePatchOperation = (
  operation: unknown
): { op: unknown; path: unknown; value?: unknown } | null => {
  if (!isObjectRecord(operation) || Array.isArray(operation)) {
    return null;
  }

  const fields = getPatchOperationFields(operation);
  if (!fields) {
    return null;
  }

  const { op, path } = fields;
  if (op !== 'add' && op !== 'remove' && op !== 'replace') {
    return null;
  }

  if (!isValidPatchPath(path)) {
    return null;
  }

  if ((op === 'add' || op === 'remove') && isRootPatchPath(path)) {
    return null;
  }

  if ((op === 'add' || op === 'replace') && !('value' in fields)) {
    return null;
  }

  return fields;
};

const normalizePatchHistoryEntries = (value: unknown): unknown[][] | null => {
  if (!isStandardDenseArray(value)) {
    return null;
  }

  const normalized = new Array(value.length) as unknown[][];
  for (let entryIndex = 0; entryIndex < value.length; entryIndex += 1) {
    const entry = value[entryIndex];
    if (!isStandardDenseArray(entry)) {
      return null;
    }

    const normalizedEntry = new Array(entry.length);
    for (
      let operationIndex = 0;
      operationIndex < entry.length;
      operationIndex += 1
    ) {
      const operation = normalizePatchOperation(entry[operationIndex]);
      if (!operation) {
        return null;
      }
      normalizedEntry[operationIndex] = operation;
    }
    normalized[entryIndex] = normalizedEntry;
  }

  return normalized;
};

type TravelPatchesValidation<P extends PatchesOption> =
  | { error: string }
  | { error: null; patches: TravelPatches<P> };

export const validateTravelPatches = <P extends PatchesOption = {}>(
  patches: unknown
): TravelPatchesValidation<P> => {
  if (!isObjectRecord(patches) || Array.isArray(patches)) {
    return {
      error: `patches must be an object with 'patches' and 'inversePatches' arrays`,
    };
  }

  const patchesProperty = getOwnDataProperty(patches, 'patches');
  const inversePatchesProperty = getOwnDataProperty(patches, 'inversePatches');
  const forward = normalizePatchHistoryEntries(patchesProperty?.value);
  const inverse = normalizePatchHistoryEntries(inversePatchesProperty?.value);
  if (!forward || !inverse) {
    return {
      error: `patches must have 'patches' and 'inversePatches' arrays of JSON Patch operations`,
    };
  }

  const normalized = {
    patches: forward,
    inversePatches: inverse,
  } as TravelPatches<P>;
  if (containsMapOrSet(normalized)) {
    return { error: `patches must not contain Map or Set values` };
  }

  if (forward.length !== inverse.length) {
    return {
      error: `patches.patches and patches.inversePatches must have the same length`,
    };
  }

  return { error: null, patches: normalized };
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

const requireSnapshotDataProperty = (
  descriptor: PropertyDescriptor | undefined,
  field: string
): DataPropertyDescriptor => {
  if (!descriptor || !('value' in descriptor)) {
    throw new TravelsPersistenceError(
      'INVALID_SCHEMA',
      `Travels: persisted history '${field}' must be an own data property.`
    );
  }
  return descriptor as DataPropertyDescriptor;
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

  const versionDescriptor = Object.getOwnPropertyDescriptor(
    snapshot,
    'version'
  );
  const stateDescriptor = Object.getOwnPropertyDescriptor(snapshot, 'state');
  const patchesDescriptor = Object.getOwnPropertyDescriptor(
    snapshot,
    'patches'
  );
  const positionDescriptor = Object.getOwnPropertyDescriptor(
    snapshot,
    'position'
  );
  const metadataDescriptor = Object.getOwnPropertyDescriptor(
    snapshot,
    'metadata'
  );
  const version = requireSnapshotDataProperty(
    versionDescriptor,
    'version'
  ).value;
  if (version !== TRAVELS_HISTORY_SCHEMA_VERSION) {
    throw new TravelsPersistenceError(
      'UNSUPPORTED_VERSION',
      `Travels: unsupported persisted history version ${String(
        version
      )}. Expected ${TRAVELS_HISTORY_SCHEMA_VERSION}.`
    );
  }

  const state = requireSnapshotDataProperty(stateDescriptor, 'state').value;
  if (containsMapOrSet(state)) {
    throw new TravelsPersistenceError(
      'INVALID_SCHEMA',
      'Travels: persisted history state must not contain Map or Set values.'
    );
  }

  const patchesInput = requireSnapshotDataProperty(
    patchesDescriptor,
    'patches'
  ).value;
  const patchValidation = validateTravelPatches<P>(patchesInput);
  if (patchValidation.error !== null) {
    throw new TravelsPersistenceError(
      'INVALID_PATCHES',
      `Travels: ${patchValidation.error}.`
    );
  }
  const { patches } = patchValidation;

  const position = requireSnapshotDataProperty(
    positionDescriptor,
    'position'
  ).value;
  if (
    typeof position !== 'number' ||
    !Number.isFinite(position) ||
    !Number.isInteger(position) ||
    position < 0 ||
    position > patches.patches.length
  ) {
    throw new TravelsPersistenceError(
      'INVALID_SCHEMA',
      `Travels: persisted history position ${String(
        position
      )} is invalid for the patch history.`
    );
  }

  const metadataInput = metadataDescriptor
    ? requireSnapshotDataProperty(metadataDescriptor, 'metadata').value
    : undefined;
  let metadata: Array<TravelMetadata | undefined> | undefined;
  if (metadataInput !== undefined) {
    if (!isStandardDenseArray(metadataInput)) {
      throw new TravelsPersistenceError(
        'INVALID_SCHEMA',
        "Travels: persisted history 'metadata' must be a plain dense array when provided."
      );
    }

    const metadataEntries: unknown[] = metadataInput;
    metadata = new Array(metadataEntries.length);
    for (let index = 0; index < metadataEntries.length; index += 1) {
      const entry = metadataEntries[index];
      if (!isValidMetadataEntry(entry)) {
        throw new TravelsPersistenceError(
          'INVALID_SCHEMA',
          "Travels: persisted history 'metadata' entries must be objects, null, or undefined."
        );
      }
      metadata[index] = entry == null ? undefined : (entry as TravelMetadata);
    }
  }

  if (metadata !== undefined && metadata.length !== patches.patches.length) {
    throw new TravelsPersistenceError(
      'INVALID_SCHEMA',
      "Travels: persisted history 'metadata' length must match patches length."
    );
  }

  return {
    version: TRAVELS_HISTORY_SCHEMA_VERSION,
    state: state as S,
    patches,
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
  if (keyCount !== rightKeys.length) {
    return false;
  }
  const leftIsArray = Array.isArray(left);
  const isRegExp = prototype === RegExp.prototype;

  // Array indices and the fixed built-in slots (Date/RegExp) are positional, so
  // their key sequence must match exactly. Plain-object own-key order is not
  // preserved by JSON Patch replay — removing a key and re-adding it re-appends
  // it — so a reordered but otherwise identical object is still an equal,
  // reversible state. Compare plain-object keys as an unordered set.
  if (leftIsArray) {
    if (leftKeys.some((key, index) => key !== rightKeys[index])) {
      return false;
    }
  } else {
    const rightKeySet = new Set(rightKeys);
    if (leftKeys.some((key) => !rightKeySet.has(key))) {
      return false;
    }
  }

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
