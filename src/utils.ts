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

/**
 * Verify the standard dense-array shape and, optionally, inspect each element
 * in the same pass.
 *
 * Callers that need the element values must not walk the array a second time:
 * proving the shape already reads every index descriptor, and repeating that
 * walk doubles the descriptor allocations on hot validation paths.
 */
export const isStandardDenseArrayWhere = (
  value: unknown,
  isValidElement?: (element: unknown, index: number, length: number) => boolean
): value is unknown[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      return false;
    }

    const length = value.length;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1) {
      return false;
    }

    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (key === 'length') {
        continue;
      }
      if (!isArrayIndex(key, length)) {
        return false;
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        return false;
      }
      if (
        isValidElement &&
        !isValidElement(descriptor.value, Number(key), length)
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
};

export const isStandardDenseArray = (value: unknown): value is unknown[] =>
  isStandardDenseArrayWhere(value);

export const getMapOrSetKind = (
  value: object
): 'Map' | 'Set' | undefined => {
  let prototype = Object.getPrototypeOf(value);
  if (
    prototype === null ||
    prototype === Object.prototype ||
    prototype === Array.prototype
  ) {
    return undefined;
  }
  if (prototype === Map.prototype) {
    return 'Map';
  }
  if (prototype === Set.prototype) {
    return 'Set';
  }

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
  seen = new WeakSet<object>(),
  knownCollectionFree?: WeakSet<object>,
  cacheDescendants = true
): boolean => {
  const stack = [value];
  const visited =
    knownCollectionFree && cacheDescendants ? ([] as object[]) : undefined;

  while (stack.length > 0) {
    const current = stack.pop();
    if (
      !isObjectLike(current) ||
      seen.has(current) ||
      knownCollectionFree?.has(current)
    ) {
      continue;
    }

    // Plain objects and arrays return through a fast prototype path while
    // uncommon prototypes still receive cross-realm collection detection.
    if (getMapOrSetKind(current)) {
      return true;
    }

    seen.add(current);
    visited?.push(current);

    // Follow only enumerable string data properties: these are the fields that
    // Travels can patch and JSON can retain. Framework objects may keep Maps in
    // hidden or symbol-keyed bookkeeping that is outside the state data graph.
    for (const key of Object.keys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (
        descriptor &&
        'value' in descriptor &&
        isObjectLike(descriptor.value)
      ) {
        stack.push(descriptor.value);
      }
    }
  }

  if (knownCollectionFree && visited) {
    for (const current of visited) {
      knownCollectionFree.add(current);
    }
  } else if (knownCollectionFree && isObjectLike(value)) {
    knownCollectionFree.add(value);
  }
  return false;
};

/**
 * Split a JSON Patch path into its segments. Returns undefined when the path
 * is neither an array nor a JSON Pointer string.
 */
export const getPatchPathSegments = (
  path: unknown
): Array<string | number> | undefined => {
  if (Array.isArray(path)) {
    return path.slice() as Array<string | number>;
  }

  if (typeof path !== 'string') {
    return undefined;
  }
  if (path === '') {
    return [];
  }

  return path
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
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

  return isStandardDenseArrayWhere(path, (segment, index, length) => {
    const isJsonPathSegment =
      typeof segment === 'string' ||
      (typeof segment === 'number' &&
        Number.isFinite(segment) &&
        Number.isInteger(segment) &&
        segment >= 0);
    return (
      isJsonPathSegment && !isUnsafePatchPathSegment(segment, index, length)
    );
  });
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
