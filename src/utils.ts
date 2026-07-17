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

const isUnsafePatchPathSegment = (
  segment: unknown,
  index: number,
  length: number
): boolean =>
  segment === '__proto__' || (segment === 'constructor' && index < length - 1);

export const isValidPatchPath = (
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
      const isRuntimeTerminalSegment =
        allowNonJsonPathSegments && index === path.length - 1;
      return (
        (isJsonPathSegment || isRuntimeTerminalSegment) &&
        !isUnsafePatchPathSegment(segment, index, path.length)
      );
    })
  );
};

export const consumePromiseLikeRejection = (
  value: unknown,
  onRejected: (error: unknown) => void
): void => {
  const rejectSafely = (error: unknown): void => {
    try {
      onRejected(error);
    } catch {
      // Rejection handling must not create a second unhandled failure.
    }
  };

  let isThenable = false;
  try {
    isThenable =
      value !== null &&
      (typeof value === 'object' || typeof value === 'function') &&
      typeof (value as { then?: unknown }).then === 'function';
  } catch (error) {
    rejectSafely(error);
    return;
  }

  if (!isThenable) {
    return;
  }

  try {
    const promise = Promise.resolve(value);
    void Promise.prototype.then.call(promise, undefined, rejectSafely);
  } catch (error) {
    rejectSafely(error);
  }
};
