export type StateCompatibilityIssueCode =
  | 'CIRCULAR_REFERENCE'
  | 'DATE'
  | 'FUNCTION'
  | 'CLASS_INSTANCE'
  | 'DOM_NODE'
  | 'MAP_SET_MUTABLE'
  | 'MAP_SET_PERSISTENCE'
  | 'SPARSE_ARRAY'
  | 'WEAK_COLLECTION'
  | 'SYMBOL'
  | 'UNDEFINED';

export type StateCompatibilityIssue = {
  code: StateCompatibilityIssueCode;
  path: string;
  message: string;
};

type CompatibilityOptions = {
  mutable?: boolean;
  maxIssues?: number;
};

const formatPath = (segments: Array<string | number>): string => {
  if (segments.length === 0) {
    return '$';
  }

  return segments.reduce<string>((path, segment) => {
    if (typeof segment === 'number') {
      return `${path}[${segment}]`;
    }

    return `${path}.${segment}`;
  }, '$');
};

const isDomNode = (value: unknown): boolean => {
  return (
    typeof Node !== 'undefined' &&
    typeof value === 'object' &&
    value !== null &&
    value instanceof Node
  );
};

const isPlainObjectOrNullProto = (value: object): boolean => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const hasArrayHoles = (value: unknown[]): boolean => {
  let presentIndices = 0;

  // Snapshot cloning can drop non-enumerable indices, so only normal enumerable
  // array elements belong to the durable dense-array contract.
  for (const key of Object.keys(value)) {
    const index = Number(key);
    if (
      Number.isInteger(index) &&
      index >= 0 &&
      index < value.length &&
      String(index) === key
    ) {
      presentIndices += 1;
    }
  }

  return presentIndices !== value.length;
};

export const findStateCompatibilityIssues = (
  value: unknown,
  options: CompatibilityOptions = {}
): StateCompatibilityIssue[] => {
  const maxIssues = options.maxIssues ?? 20;
  const seen = new WeakSet<object>();
  const issues: StateCompatibilityIssue[] = [];
  const addIssue = (
    code: StateCompatibilityIssueCode,
    path: Array<string | number>,
    message: string
  ) => {
    if (issues.length >= maxIssues) {
      return;
    }

    issues.push({
      code,
      path: formatPath(path),
      message,
    });
  };

  const visit = (current: unknown, path: Array<string | number>) => {
    if (issues.length >= maxIssues) {
      return;
    }

    if (typeof current === 'undefined') {
      addIssue(
        'UNDEFINED',
        path,
        'undefined is removed by JSON persistence; use null for intentional empty values.'
      );
      return;
    }

    if (typeof current === 'function') {
      addIssue(
        'FUNCTION',
        path,
        'functions cannot be patched or persisted as state data.'
      );
      return;
    }

    if (typeof current === 'symbol') {
      addIssue(
        'SYMBOL',
        path,
        'symbols cannot be represented in JSON Patch persistence.'
      );
      return;
    }

    if (current === null || typeof current !== 'object') {
      return;
    }

    if (seen.has(current)) {
      addIssue(
        'CIRCULAR_REFERENCE',
        path,
        'circular references are not supported by JSON persistence.'
      );
      return;
    }

    seen.add(current);

    if (current instanceof Date) {
      addIssue(
        'DATE',
        path,
        'Date values can be cloned, but JSON persistence restores them as strings; store timestamps or ISO strings explicitly.'
      );
      return;
    }

    if (current instanceof WeakMap || current instanceof WeakSet) {
      addIssue(
        'WEAK_COLLECTION',
        path,
        'WeakMap and WeakSet cannot be inspected, patched, or persisted safely.'
      );
      return;
    }

    if (current instanceof Map) {
      addIssue(
        options.mutable ? 'MAP_SET_MUTABLE' : 'MAP_SET_PERSISTENCE',
        path,
        options.mutable
          ? 'Map is not supported in mutable mode; store entries as arrays or use immutable mode.'
          : 'Map works in immutable runtime mode, but JSON persistence requires a custom codec.'
      );
      current.forEach((entryValue, entryKey) => {
        visit(entryKey, path.concat('<map-key>'));
        visit(entryValue, path.concat(String(entryKey)));
      });
      return;
    }

    if (current instanceof Set) {
      addIssue(
        options.mutable ? 'MAP_SET_MUTABLE' : 'MAP_SET_PERSISTENCE',
        path,
        options.mutable
          ? 'Set is not supported in mutable mode; store values as arrays or use immutable mode.'
          : 'Set works in immutable runtime mode, but JSON persistence requires a custom codec.'
      );
      let index = 0;
      current.forEach((entryValue) => {
        visit(entryValue, path.concat(index));
        index += 1;
      });
      return;
    }

    if (isDomNode(current)) {
      addIssue(
        'DOM_NODE',
        path,
        'DOM nodes and refs should be stored outside Travels state.'
      );
      return;
    }

    if (Array.isArray(current)) {
      if (hasArrayHoles(current)) {
        addIssue(
          'SPARSE_ARRAY',
          path,
          'sparse array holes cannot be represented faithfully by JSON persistence; use null for empty slots.'
        );
      }
      current.forEach((item, index) => visit(item, path.concat(index)));
      return;
    }

    if (!isPlainObjectOrNullProto(current)) {
      addIssue(
        'CLASS_INSTANCE',
        path,
        'class instances and custom prototypes lose methods/prototypes during JSON persistence.'
      );
      return;
    }

    for (const key of Reflect.ownKeys(current)) {
      if (typeof key === 'symbol') {
        addIssue(
          'SYMBOL',
          path,
          'symbol keys cannot be represented in JSON Patch persistence.'
        );
        continue;
      }

      visit((current as Record<string, unknown>)[key], path.concat(key));
    }
  };

  visit(value, []);
  return issues;
};
