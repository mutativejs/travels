/**
 * Snapshots Travels itself validated or produced, so restore factories can skip
 * a second structural pass over the same data.
 *
 * A snapshot is trusted only while the fields that structural validation
 * covered are unchanged: the top-level fields and the identity and length of
 * both patch-history arrays. Replacing any of them, or appending or removing
 * an entry, sends the snapshot through full validation again. Mutative still
 * rejects unsafe paths during replay if a caller edits a patch group in place.
 */
type SnapshotFingerprint = readonly unknown[];

const rememberedSnapshots = new WeakMap<object, SnapshotFingerprint>();
const missing = Symbol('missing');

const readOwnData = (value: unknown, key: PropertyKey): unknown => {
  if (typeof value !== 'object' || value === null) {
    return missing;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : missing;
};

const lengthOf = (value: unknown): unknown =>
  Array.isArray(value) ? value.length : missing;

const fingerprint = (snapshot: object): SnapshotFingerprint => {
  const patches = readOwnData(snapshot, 'patches');
  const forward = readOwnData(patches, 'patches');
  const inverse = readOwnData(patches, 'inversePatches');
  const metadata = readOwnData(snapshot, 'metadata');
  return [
    readOwnData(snapshot, 'version'),
    readOwnData(snapshot, 'state'),
    readOwnData(snapshot, 'position'),
    patches,
    forward,
    lengthOf(forward),
    inverse,
    lengthOf(inverse),
    metadata,
    lengthOf(metadata),
  ];
};

export const rememberValidatedSnapshot = <T extends object>(snapshot: T): T => {
  rememberedSnapshots.set(snapshot, fingerprint(snapshot));
  return snapshot;
};

export const isUnchangedValidatedSnapshot = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const remembered = rememberedSnapshots.get(value);
  if (!remembered) {
    return false;
  }
  const current = fingerprint(value);
  return remembered.every((field, index) => Object.is(field, current[index]));
};
