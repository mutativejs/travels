import type {
  PatchesOption,
  TravelMetadata,
  TravelPatches,
  TravelsDeserializeOptions,
  TravelsPersistenceErrorCode,
  TravelsSerializedHistory,
} from './type';

export const TRAVELS_HISTORY_SCHEMA_VERSION = 1 as const;

export class TravelsPersistenceError extends Error {
  public readonly code: TravelsPersistenceErrorCode;
  public readonly cause?: unknown;

  constructor(
    code: TravelsPersistenceErrorCode,
    message: string,
    options: { cause?: unknown } = {}
  ) {
    super(message);
    this.name = 'TravelsPersistenceError';
    this.code = code;
    this.cause = options.cause;
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

const isValidPatchPath = (path: unknown): boolean => {
  return (
    typeof path === 'string' ||
    (Array.isArray(path) &&
      path.every(
        (segment) =>
          typeof segment === 'string' || typeof segment === 'number'
      ))
  );
};

const isValidPatchOperation = (operation: unknown): boolean => {
  if (!isObjectRecord(operation)) {
    return false;
  }

  const op = operation.op;
  if (
    op !== 'add' &&
    op !== 'remove' &&
    op !== 'replace' &&
    op !== 'move' &&
    op !== 'copy' &&
    op !== 'test'
  ) {
    return false;
  }

  if (!isValidPatchPath(operation.path)) {
    return false;
  }

  if (
    (op === 'add' || op === 'replace' || op === 'test') &&
    !hasOwn(operation, 'value')
  ) {
    return false;
  }

  if ((op === 'move' || op === 'copy') && !isValidPatchPath(operation.from)) {
    return false;
  }

  return true;
};

const isPatchHistoryEntries = (value: unknown): value is unknown[][] => {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) => Array.isArray(entry) && entry.every(isValidPatchOperation)
    )
  );
};

export const getTravelPatchesValidationError = <
  P extends PatchesOption = {},
>(
  patches: unknown
): string | null => {
  if (!isObjectRecord(patches)) {
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
  if (metadataInput !== undefined && !Array.isArray(metadataInput)) {
    throw new TravelsPersistenceError(
      'INVALID_SCHEMA',
      "Travels: persisted history 'metadata' must be an array when provided."
    );
  }

  if (
    metadataInput !== undefined &&
    !metadataInput.every(isValidMetadataEntry)
  ) {
    throw new TravelsPersistenceError(
      'INVALID_SCHEMA',
      "Travels: persisted history 'metadata' entries must be objects, null, or undefined."
    );
  }

  const metadata = metadataInput?.map((entry) =>
    entry == null ? undefined : (entry as TravelMetadata)
  );

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

const resolveFallback = <S, P extends PatchesOption = {}>(
  fallback: TravelsDeserializeOptions<S, P>['fallback']
): TravelsSerializedHistory<S, P> | undefined => {
  if (!fallback) {
    return undefined;
  }

  return typeof fallback === 'function' ? fallback() : fallback;
};

export const deserializeTravelsHistory = <
  S,
  P extends PatchesOption = {},
>(
  input: unknown,
  options: TravelsDeserializeOptions<S, P> = {}
): TravelsSerializedHistory<S, P> => {
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

    return normalizeSnapshot<S, P>(migrated);
  } catch (error) {
    const persistenceError =
      error instanceof TravelsPersistenceError
        ? error
        : new TravelsPersistenceError(
            'INVALID_SCHEMA',
            'Travels: persisted history could not be deserialized.',
            { cause: error }
          );

    options.onError?.(persistenceError);

    const fallback = resolveFallback(options.fallback);
    if (fallback) {
      return normalizeSnapshot<S, P>(fallback);
    }

    throw persistenceError;
  }
};
