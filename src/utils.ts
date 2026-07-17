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

export const isStandardDenseArray = (value: unknown): value is unknown[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      return false;
    }

    const length = value.length;
    const keys = Reflect.ownKeys(value);
    return (
      keys.length === length + 1 &&
      keys.every((key) => {
        if (key === 'length') {
          return true;
        }
        if (!isArrayIndex(key, length)) {
          return false;
        }

        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return !!(
          descriptor &&
          'value' in descriptor &&
          descriptor.enumerable
        );
      })
    );
  } catch {
    return false;
  }
};

export const getMapOrSetKind = (
  value: object
): 'Map' | 'Set' | undefined => {
  let prototype = Object.getPrototypeOf(value);
  while (prototype) {
    const tag = Object.getOwnPropertyDescriptor(prototype, Symbol.toStringTag);
    if (tag && 'value' in tag && (tag.value === 'Map' || tag.value === 'Set')) {
      const Collection = tag.value === 'Map' ? Map : Set;
      try {
        Collection.prototype.has.call(value, value);
        return tag.value;
      } catch {
        if (value instanceof Collection) {
          return tag.value;
        }
      }
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  return undefined;
};

export const containsMapOrSet = (
  value: unknown,
  seen = new WeakSet<object>()
): boolean => {
  if (!isObjectLike(value) || seen.has(value)) {
    return false;
  }

  // Confirm cross-realm collections without invoking instance accessors.
  if (getMapOrSetKind(value)) {
    return true;
  }

  seen.add(value);

  // Follow only enumerable string data properties: these are the fields that
  // Travels can patch and JSON can retain. Framework objects may keep Maps in
  // hidden or symbol-keyed bookkeeping that is outside the state data graph.
  return Object.keys(value).some((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return !!(
      descriptor &&
      'value' in descriptor &&
      containsMapOrSet(descriptor.value, seen)
    );
  });
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

  if (!isStandardDenseArray(path)) {
    return false;
  }

  for (let index = 0; index < path.length; index += 1) {
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
    if (
      !isJsonPathSegment ||
      isUnsafePatchPathSegment(segment, index, path.length)
    ) {
      return false;
    }
  }

  return true;
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
