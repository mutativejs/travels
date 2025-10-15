export const isObjectLike = (
  value: unknown
): value is Record<PropertyKey, unknown> => {
  return typeof value === 'object' && value !== null;
};
