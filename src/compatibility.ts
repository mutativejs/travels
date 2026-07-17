import { isArrayIndex } from './utils.js';

export type StateCompatibilityIssueCode =
  | 'CIRCULAR_REFERENCE'
  | 'DATE'
  | 'FUNCTION'
  | 'CLASS_INSTANCE'
  | 'DOM_NODE'
  | 'MAP_SET_MUTABLE'
  | 'MAP_SET_PERSISTENCE'
  | 'BIGINT'
  | 'NON_JSON_NUMBER'
  | 'ARRAY_SHAPE'
  | 'OBJECT_SHAPE'
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
  allowFrozen?: boolean;
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

type DataPropertyDescriptor = PropertyDescriptor & { value: unknown };
type PropertyDescriptors = Record<PropertyKey, PropertyDescriptor>;

const isDataPropertyDescriptor = (
  descriptor: PropertyDescriptor | undefined
): descriptor is DataPropertyDescriptor =>
  descriptor !== undefined && 'value' in descriptor;

const isDurableDataProperty = (
  descriptor: PropertyDescriptor | undefined,
  frozen: boolean
): descriptor is DataPropertyDescriptor =>
  isDataPropertyDescriptor(descriptor) &&
  !!descriptor.enumerable &&
  (frozen || (!!descriptor.writable && !!descriptor.configurable));

const hasNonDurableArrayShape = (
  value: unknown[],
  descriptors: PropertyDescriptors,
  keys: PropertyKey[],
  allowFrozen: boolean
): boolean => {
  const frozen = allowFrozen && Object.isFrozen(value);
  return (
    Object.getPrototypeOf(value) !== Array.prototype ||
    (!frozen && !Object.isExtensible(value)) ||
    keys.length !== value.length + 1 ||
    (!frozen && !descriptors.length.writable) ||
    keys.some(
      (key) =>
        key !== 'length' &&
        (!isArrayIndex(key, value.length) ||
          !isDurableDataProperty(descriptors[key], frozen))
    )
  );
};

const hasNonDurableObjectShape = (
  value: object,
  descriptors: PropertyDescriptors,
  keys: PropertyKey[],
  allowFrozen: boolean
): boolean => {
  const frozen = allowFrozen && Object.isFrozen(value);
  return (
    (!frozen && !Object.isExtensible(value)) ||
    keys.some(
      (key) =>
        typeof key === 'string' &&
        !isDurableDataProperty(descriptors[key], frozen)
    )
  );
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
      addIssue('UNDEFINED', path, 'use null; undefined is not durable data.');
      return;
    }

    if (typeof current === 'function') {
      addIssue('FUNCTION', path, 'functions are not durable data.');
      return;
    }

    if (typeof current === 'symbol') {
      addIssue('SYMBOL', path, 'symbols are not durable data.');
      return;
    }

    if (typeof current === 'bigint') {
      addIssue(
        'BIGINT',
        path,
        'encode bigint as a string before JSON persistence.'
      );
      return;
    }

    if (
      typeof current === 'number' &&
      (!Number.isFinite(current) || Object.is(current, -0))
    ) {
      addIssue(
        'NON_JSON_NUMBER',
        path,
        'JSON does not preserve NaN, Infinity, or -0.'
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
        'circular references are not durable data.'
      );
      return;
    }

    seen.add(current);

    if (current instanceof Date) {
      addIssue('DATE', path, 'use a timestamp or ISO string for Date.');
      return;
    }

    if (current instanceof WeakMap || current instanceof WeakSet) {
      addIssue(
        'WEAK_COLLECTION',
        path,
        'WeakMap and WeakSet are not durable data.'
      );
      return;
    }

    if (current instanceof Map) {
      addIssue(
        options.mutable ? 'MAP_SET_MUTABLE' : 'MAP_SET_PERSISTENCE',
        path,
        options.mutable
          ? 'Map is unsupported in mutable mode; use entries or immutable mode.'
          : 'Map persistence requires a codec.'
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
          ? 'Set is unsupported in mutable mode; use values or immutable mode.'
          : 'Set persistence requires a codec.'
      );
      let index = 0;
      current.forEach((entryValue) => {
        visit(entryValue, path.concat(index));
        index += 1;
      });
      return;
    }

    if (isDomNode(current)) {
      addIssue('DOM_NODE', path, 'DOM nodes and refs are not durable data.');
      return;
    }

    if (Array.isArray(current)) {
      const descriptors = Object.getOwnPropertyDescriptors(
        current
      ) as unknown as PropertyDescriptors;
      const keys = Reflect.ownKeys(descriptors);
      if (
        hasNonDurableArrayShape(
          current,
          descriptors,
          keys,
          options.allowFrozen === true
        )
      ) {
        addIssue(
          'ARRAY_SHAPE',
          path,
          'use a plain dense array with standard data properties.'
        );
      }

      for (const key of keys) {
        if (!isArrayIndex(key, current.length)) {
          continue;
        }
        const descriptor = descriptors[key];
        if (isDataPropertyDescriptor(descriptor)) {
          visit(descriptor.value, path.concat(Number(key)));
        }
      }
      return;
    }

    if (Object.getPrototypeOf(current) !== Object.prototype) {
      addIssue(
        'CLASS_INSTANCE',
        path,
        'class instances and custom prototypes are not durable data.'
      );
      return;
    }

    const descriptors = Object.getOwnPropertyDescriptors(
      current
    ) as PropertyDescriptors;
    const keys = Reflect.ownKeys(descriptors);
    if (
      hasNonDurableObjectShape(
        current,
        descriptors,
        keys,
        options.allowFrozen === true
      )
    ) {
      addIssue(
        'OBJECT_SHAPE',
        path,
        'use a plain object with standard data properties.'
      );
    }

    for (const key of keys) {
      if (typeof key === 'symbol') {
        addIssue('SYMBOL', path, 'symbol keys are not durable data.');
        continue;
      }

      const descriptor = descriptors[key];
      if (isDataPropertyDescriptor(descriptor)) {
        visit(descriptor.value, path.concat(key));
      }
    }
  };

  visit(value, []);
  return issues;
};
