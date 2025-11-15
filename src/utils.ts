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
