export const isObjectLike = (
  value: unknown
): value is Record<PropertyKey, unknown> => {
  return typeof value === 'object' && value !== null;
};

export const isPlainObject = (
  value: unknown
): value is Record<PropertyKey, unknown> => {
  if (!isObjectLike(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  if (proto === null) {
    return true;
  }

  return proto === Object.prototype;
};

export const isArrayIndex = (key: PropertyKey, length: number): boolean => {
  if (typeof key !== 'string') {
    return false;
  }

  const index = Number(key);
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < length &&
    String(index) === key
  );
};

export const containsMapOrSet = (
  value: unknown,
  seen = new WeakSet<object>()
): boolean => {
  if (value instanceof Map || value instanceof Set) {
    return true;
  }

  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  ) {
    return false;
  }

  const object = value as object;
  if (seen.has(object)) {
    return false;
  }
  seen.add(object);

  // Follow only enumerable string data properties: these are the fields that
  // Travels can patch and JSON can retain. Framework objects may keep Maps in
  // hidden or symbol-keyed bookkeeping that is outside the state data graph.
  for (const key of Object.keys(object)) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (
      descriptor &&
      'value' in descriptor &&
      containsMapOrSet(descriptor.value, seen)
    ) {
      return true;
    }
  }

  return false;
};

const isUnsafePatchPathSegment = (
  segment: unknown,
  index: number,
  length: number
): boolean =>
  segment === '__proto__' || (segment === 'constructor' && index < length - 1);

export const isValidPatchPath = (path: unknown): boolean => {
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
      const descriptor = Object.getOwnPropertyDescriptor(path, String(index));
      if (!descriptor || !('value' in descriptor)) {
        return false;
      }

      const segment = descriptor.value;
      const isJsonPathSegment =
        typeof segment === 'string' ||
        (typeof segment === 'number' &&
          Number.isFinite(segment) &&
          Number.isInteger(segment) &&
          segment >= 0);
      return (
        isJsonPathSegment &&
        !isUnsafePatchPathSegment(segment, index, path.length)
      );
    })
  );
};

/**
 * Observe a Promise-like rejection without allowing the rejection handler to
 * create another unhandled failure. Returns whether the value is Promise-like.
 */
export const consumePromiseLikeRejection = (
  value: unknown,
  onRejected: (error: unknown) => void
): boolean => {
  const rejectSafely = (error: unknown): void => {
    try {
      onRejected(error);
    } catch {
      // Rejection handling must not create a second unhandled failure.
    }
  };

  const isPromiseCandidate =
    value !== null &&
    (typeof value === 'object' || typeof value === 'function');
  if (!isPromiseCandidate) {
    return false;
  }

  try {
    void Promise.prototype.then.call(
      value as Promise<unknown>,
      undefined,
      rejectSafely
    );
    return true;
  } catch {
    // Non-native thenables need to be assimilated through Promise.resolve().
  }

  let isThenable: boolean;
  try {
    isThenable = typeof (value as { then?: unknown }).then === 'function';
  } catch (error) {
    rejectSafely(error);
    return true;
  }

  if (!isThenable) {
    return false;
  }

  try {
    const promise = Promise.resolve(value);
    void Promise.prototype.then.call(promise, undefined, rejectSafely);
  } catch (error) {
    rejectSafely(error);
  }

  return true;
};
