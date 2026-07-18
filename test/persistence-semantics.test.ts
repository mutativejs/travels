import { describe, expect, test, vi } from 'vitest';
import {
  createTravels,
  Travels,
  TravelsPersistenceError,
  type TravelsSerializedHistory,
} from '../src/index';

const emptySnapshot = <S>(state: S): TravelsSerializedHistory<S> => ({
  version: 1,
  state,
  patches: { patches: [], inversePatches: [] },
  position: 0,
});

const singleValueSnapshot = <S>(state: S, forward: S, inverse: S) => ({
  version: 1 as const,
  state: { value: state },
  position: 1,
  patches: {
    patches: [[{ op: 'replace' as const, path: ['value'], value: forward }]],
    inversePatches: [
      [{ op: 'replace' as const, path: ['value'], value: inverse }],
    ],
  },
});

const semanticValidation = { validation: 'semantic' as const };
const semanticIsolationError = () =>
  expect.objectContaining<Partial<TravelsPersistenceError>>({
    code: 'INVALID_HISTORY',
    message:
      'Travels: persisted history semantic validation graph could not be isolated.',
    entryIndex: undefined,
    direction: undefined,
  });
const unsupportedCollectionStateError = () =>
  expect.objectContaining<Partial<TravelsPersistenceError>>({
    code: 'INVALID_SCHEMA',
    message:
      'Travels: persisted history state must not contain Map or Set values.',
    entryIndex: undefined,
    direction: undefined,
  });
const unsupportedCollectionPatchesError = () =>
  expect.objectContaining<Partial<TravelsPersistenceError>>({
    code: 'INVALID_PATCHES',
    message: 'Travels: patches must not contain Map or Set values.',
    entryIndex: undefined,
    direction: undefined,
  });

describe('persisted history semantic validation', () => {
  test('v1 accepts an internally consistent alternative past without provenance', () => {
    const onError = vi.fn();
    const fallback = emptySnapshot({ count: -1 });
    const history = Travels.deserialize(
      {
        version: 1,
        state: { count: 1 },
        position: 1,
        patches: {
          patches: [[{ op: 'replace', path: ['count'], value: 1 }]],
          inversePatches: [[{ op: 'replace', path: ['count'], value: 999 }]],
        },
      },
      { fallback, onError, ...semanticValidation }
    );
    const restored = createTravels(history.state, { history });

    expect(onError).not.toHaveBeenCalled();
    expect(history.state).toEqual({ count: 1 });

    restored.back();
    expect(restored.getState()).toEqual({ count: 999 });
    restored.forward();
    expect(restored.getState()).toEqual({ count: 1 });
  });

  test('rejects an inverse patch that cannot be applied at the anchor state', () => {
    expect(() =>
      Travels.deserialize(
        {
          version: 1,
          state: { count: 1 },
          position: 1,
          patches: {
            patches: [
              [{ op: 'replace', path: ['missing', 'value'], value: 1 }],
            ],
            inversePatches: [
              [{ op: 'replace', path: ['missing', 'value'], value: 0 }],
            ],
          },
        },
        semanticValidation
      )
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'inverse',
      })
    );
  });

  test('rejects a future patch that cannot be applied', () => {
    expect(() =>
      Travels.deserialize(
        {
          version: 1,
          state: { count: 0 },
          position: 0,
          patches: {
            patches: [
              [{ op: 'replace', path: ['missing', 'value'], value: 1 }],
            ],
            inversePatches: [
              [{ op: 'replace', path: ['missing', 'value'], value: 0 }],
            ],
          },
        },
        semanticValidation
      )
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'forward',
      })
    );
  });

  test('uses structural validation by default and allows semantic opt-in', () => {
    const snapshot = {
      version: 1 as const,
      state: { count: 0 },
      position: 0,
      patches: {
        patches: [
          [{ op: 'replace' as const, path: ['missing', 'value'], value: 1 }],
        ],
        inversePatches: [
          [{ op: 'replace' as const, path: ['missing', 'value'], value: 0 }],
        ],
      },
    };

    expect(Travels.deserialize(snapshot)).toEqual(snapshot);
    expect(() =>
      Travels.deserialize(snapshot, semanticValidation)
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
      })
    );
  });

  test('uses the selected validation mode for fallback snapshots', () => {
    const structurallyValidFallback = {
      version: 1 as const,
      state: { count: 0 },
      position: 0,
      patches: {
        patches: [
          [{ op: 'replace' as const, path: ['missing', 'value'], value: 1 }],
        ],
        inversePatches: [
          [{ op: 'replace' as const, path: ['missing', 'value'], value: 0 }],
        ],
      },
    };

    expect(
      Travels.deserialize('not-json', {
        fallback: structurallyValidFallback,
        validation: 'structural',
      })
    ).toEqual(structurallyValidFallback);
  });

  test('rejects unknown validation modes as configuration errors', () => {
    const onError = vi.fn();

    expect(() =>
      Travels.deserialize(emptySnapshot({ count: 0 }), {
        fallback: emptySnapshot({ count: -1 }),
        onError,
        validation: 'unknown' as 'semantic',
      })
    ).toThrow(TypeError);
    expect(onError).not.toHaveBeenCalled();
  });

  test('rejects state anchors that do not match their patch history', () => {
    expect(() =>
      Travels.deserialize(
        {
          version: 1,
          state: { count: 2, label: 'current' },
          position: 1,
          patches: {
            patches: [[{ op: 'replace', path: ['count'], value: 1 }]],
            inversePatches: [
              [
                { op: 'replace', path: ['count'], value: 0 },
                { op: 'replace', path: ['label'], value: 'corrupt' },
              ],
            ],
          },
        },
        semanticValidation
      )
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'forward',
      })
    );
  });

  test('rejects opaque internal-slot values that cannot be compared safely', () => {
    const buffer = (value: number) => Uint8Array.of(value).buffer;

    expect(() =>
      Travels.deserialize(
        {
          version: 1,
          state: { data: buffer(2) },
          position: 1,
          patches: {
            patches: [[{ op: 'replace', path: ['data'], value: buffer(9) }]],
            inversePatches: [
              [{ op: 'replace', path: ['data'], value: buffer(0) }],
            ],
          },
        },
        semanticValidation
      )
    ).toThrowError(semanticIsolationError());
  });

  test('rejects RegExp cursors that snapshot cloning cannot preserve', () => {
    const pattern = (lastIndex: number) => {
      const value = /a/g;
      value.lastIndex = lastIndex;
      return value;
    };

    expect(() =>
      Travels.deserialize(
        singleValueSnapshot(pattern(2), pattern(9), pattern(0)),
        semanticValidation
      )
    ).toThrowError(semanticIsolationError());
  });

  test('rejects hidden state on subclasses of supported built-ins', () => {
    class TaggedDate extends Date {
      readonly #tag: string;

      constructor(tag: string) {
        super(1);
        this.#tag = tag;
      }

      get tag(): string {
        return this.#tag;
      }
    }

    expect(() =>
      Travels.deserialize(
        singleValueSnapshot(
          new TaggedDate('expected'),
          new TaggedDate('corrupt'),
          new TaggedDate('before')
        ),
        semanticValidation
      )
    ).toThrowError(semanticIsolationError());
  });

  const accessorValues = new WeakMap<object, number>();
  const readAccessorValue = function (this: object) {
    return accessorValues.get(this);
  };
  const createAccessorValue = (value: number) => {
    const result = {};
    accessorValues.set(result, value);
    Object.defineProperty(result, 'value', {
      enumerable: true,
      get: readAccessorValue,
    });
    return result;
  };
  class TaggedArray extends Array<number> {
    readonly #tag: number;

    constructor(tag: number) {
      super();
      this.#tag = tag;
    }

    get tag(): number {
      return this.#tag;
    }
  }

  test.each([
    [
      'non-enumerable plain-object property',
      (value: number) => {
        const result = {} as { hidden: number };
        Object.defineProperty(result, 'hidden', { value, enumerable: false });
        return result;
      },
    ],
    [
      'non-enumerable array property',
      (value: number) => {
        const result = [0] as number[] & { hidden: number };
        Object.defineProperty(result, 'hidden', { value, enumerable: false });
        return result;
      },
    ],
    ['accessor-backed plain-object property', createAccessorValue],
    [
      'custom own property on an exact built-in',
      (value: number) => {
        const result = new Date(1) as Date & {
          tag: number;
        };
        result.tag = value;
        return result;
      },
    ],
    ['private state on an Array subclass', (value) => new TaggedArray(value)],
  ] as const)('rejects unverifiable %s', (_name, createValue) => {
    expect(() =>
      Travels.deserialize(
        singleValueSnapshot(createValue(2), createValue(9), createValue(0)),
        semanticValidation
      )
    ).toThrowError(semanticIsolationError());
  });

  test.each([
    [
      'non-writable data properties',
      () => {
        const value = {} as { restored: number };
        Object.defineProperty(value, 'restored', {
          configurable: true,
          enumerable: true,
          value: 1,
          writable: false,
        });
        return value;
      },
    ],
    ['non-extensible objects', () => Object.preventExtensions({ restored: 1 })],
  ] as const)('rejects replay that changes %s', (_name, createValue) => {
    expect(() =>
      Travels.deserialize(
        {
          version: 1,
          state: { value: createValue() },
          position: 1,
          patches: {
            patches: [[{ op: 'add', path: ['value', 'restored'], value: 1 }]],
            inversePatches: [[{ op: 'remove', path: ['value', 'restored'] }]],
          },
        },
        semanticValidation
      )
    ).toThrowError(semanticIsolationError());
  });

  test('rejects replay that changes the array length descriptor', () => {
    const items = [1];
    Object.defineProperty(items, 'length', { writable: false });

    expect(() =>
      Travels.deserialize(
        {
          version: 1,
          state: { items },
          position: 1,
          patches: {
            patches: [[{ op: 'replace', path: ['items', 0], value: 1 }]],
            inversePatches: [[{ op: 'replace', path: ['items', 0], value: 0 }]],
          },
        },
        semanticValidation
      )
    ).toThrowError(semanticIsolationError());
  });

  test('rejects an observable negative-zero RegExp cursor', () => {
    const pattern = (lastIndex: number) => {
      const value = /a/g;
      value.lastIndex = lastIndex;
      return value;
    };

    expect(() =>
      Travels.deserialize(
        singleValueSnapshot(pattern(-0), pattern(0), pattern(0)),
        semanticValidation
      )
    ).toThrowError(semanticIsolationError());
  });

  test.each([
    ['Date', () => new Date(1), () => new Date(0)],
    ['RegExp', () => /after/g, () => /before/g],
  ] as const)(
    'continues to compare exact %s instances by their intrinsic state',
    (_name, createAfter, createBefore) => {
      expect(() =>
        Travels.deserialize(
          singleValueSnapshot(createAfter(), createAfter(), createBefore()),
          semanticValidation
        )
      ).not.toThrow();
    }
  );

  test.each([
    ['Map', () => new Map([['value', 1]])],
    ['Set', () => new Set([1])],
  ] as const)(
    'rejects unsupported exact %s instances',
    (_name, createValue) => {
      expect(() =>
        Travels.deserialize(
          singleValueSnapshot(createValue(), createValue(), createValue()),
          semanticValidation
        )
      ).toThrowError(unsupportedCollectionStateError());
    }
  );

  test.each([
    ['Map', () => new Map([['value', 1]])],
    ['Set', () => new Set([1])],
  ] as const)(
    'rejects unsupported %s state in an empty history',
    (_name, createValue) => {
      expect(() =>
        Travels.deserialize(
          emptySnapshot({ value: createValue() }),
          semanticValidation
        )
      ).toThrowError(unsupportedCollectionStateError());
    }
  );

  test('rejects unsupported custom prototype state in an empty history', () => {
    const value = Object.create({ inherited: true }) as Record<string, unknown>;

    expect(() =>
      Travels.deserialize(emptySnapshot({ value }), semanticValidation)
    ).toThrowError(semanticIsolationError());
  });

  test('rejects an empty-history accessor without invoking it and uses fallback', () => {
    let getterCalls = 0;
    const value = {} as { unsafe: unknown };
    Object.defineProperty(value, 'unsafe', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('accessor should not run');
      },
    });
    const fallback = emptySnapshot({ safe: true });
    const onError = vi.fn();

    const history = Travels.deserialize(emptySnapshot({ value }), {
      ...semanticValidation,
      fallback,
      onError,
    });

    expect(history).toEqual(fallback);
    expect(getterCalls).toBe(0);
    expect(onError).toHaveBeenCalledWith(semanticIsolationError());
  });

  test.each([
    ['Map', () => new Map([['value', 1]])],
    ['Set', () => new Set([1])],
    [
      'custom prototype',
      () => Object.create({ inherited: true }) as Record<string, unknown>,
    ],
  ] as const)(
    'rejects unsupported %s values in metadata',
    (_name, createValue) => {
      expect(() =>
        Travels.deserialize(
          {
            ...singleValueSnapshot(1, 1, 0),
            metadata: [{ value: createValue() }],
          },
          semanticValidation
        )
      ).toThrowError(semanticIsolationError());
    }
  );

  test('rejects metadata accessors without invoking them and uses fallback', () => {
    let getterCalls = 0;
    const value = {} as { unsafe: unknown };
    Object.defineProperty(value, 'unsafe', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('metadata accessor should not run');
      },
    });
    const fallback = emptySnapshot({ value: -1 });
    const onError = vi.fn();

    const history = Travels.deserialize(
      {
        ...singleValueSnapshot(1, 1, 0),
        metadata: [{ value }],
      },
      { ...semanticValidation, fallback, onError }
    );

    expect(history).toEqual(fallback);
    expect(getterCalls).toBe(0);
    expect(onError).toHaveBeenCalledWith(semanticIsolationError());
  });

  test('keeps valid metadata caller-owned after semantic isolation', () => {
    const metadata = { label: 'edit', nested: { source: 'test' } };
    const snapshot = {
      ...singleValueSnapshot(1, 1, 0),
      metadata: [metadata],
    };

    const history = Travels.deserialize(snapshot, semanticValidation);

    expect(history.metadata?.[0]).toBe(metadata);
    expect(history.metadata?.[0]).toEqual({
      label: 'edit',
      nested: { source: 'test' },
    });
    expect(Object.isFrozen(metadata)).toBe(false);
    expect(Object.isFrozen(metadata.nested)).toBe(false);
  });

  test('does not attribute a later patch isolation failure to the first replay entry', () => {
    const snapshot = {
      version: 1 as const,
      state: { count: 0, value: null as Set<number> | null },
      position: 0,
      patches: {
        patches: [
          [{ op: 'replace' as const, path: ['count'], value: 1 }],
          [
            {
              op: 'replace' as const,
              path: ['value'],
              value: new Set([1]),
            },
          ],
        ],
        inversePatches: [
          [{ op: 'replace' as const, path: ['count'], value: 0 }],
          [{ op: 'replace' as const, path: ['value'], value: null }],
        ],
      },
    };

    expect(() =>
      Travels.deserialize(snapshot, semanticValidation)
    ).toThrowError(unsupportedCollectionPatchesError());
  });

  test('does not assign a replay direction to metadata isolation failures', () => {
    const snapshot = {
      version: 1 as const,
      state: { count: 1 },
      position: 1,
      patches: {
        patches: [
          [{ op: 'replace' as const, path: ['count'], value: 1 }],
          [{ op: 'replace' as const, path: ['count'], value: 2 }],
        ],
        inversePatches: [
          [{ op: 'replace' as const, path: ['count'], value: 0 }],
          [{ op: 'replace' as const, path: ['count'], value: 1 }],
        ],
      },
      metadata: [{ label: 'first' }, { value: new Map([['x', 1]]) }],
    };

    expect(() =>
      Travels.deserialize(snapshot, semanticValidation)
    ).toThrowError(semanticIsolationError());
  });

  test('accepts a round trip that changes plain-object own-key order', () => {
    const reorderA = () => [
      { op: 'remove' as const, path: ['a'] },
      { op: 'add' as const, path: ['a'], value: 1 },
    ];

    // Removing then re-adding a key re-appends it, so replay cannot preserve
    // enumeration order. The key set and values still round-trip, so the
    // history is internally reversible and must be accepted.
    expect(() =>
      Travels.deserialize(
        {
          version: 1,
          state: { a: 1, b: 2 },
          position: 0,
          patches: {
            patches: [reorderA()],
            inversePatches: [reorderA()],
          },
        },
        semanticValidation
      )
    ).not.toThrow();
  });

  test('accepts a serialized history whose replay reorders object keys', () => {
    const travels = createTravels({ c: 1 } as Record<string, number>, {
      warnOnUnsupportedState: false,
    });
    travels.setState((draft) => {
      draft.b = 2;
    });
    travels.setState((draft) => {
      delete draft.c;
    });

    expect(() =>
      Travels.deserialize(travels.serialize(), semanticValidation)
    ).not.toThrow();
  });

  test('rejects a non-reversible inverse entry in future history', () => {
    expect(() =>
      Travels.deserialize(
        {
          version: 1,
          state: { count: 0, label: 'before' },
          position: 0,
          patches: {
            patches: [
              [
                { op: 'replace', path: ['count'], value: 1 },
                { op: 'replace', path: ['label'], value: 'after' },
              ],
            ],
            inversePatches: [[{ op: 'replace', path: ['count'], value: 0 }]],
          },
        },
        semanticValidation
      )
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'inverse',
      })
    );
  });

  test('rejects history that changes only a sparse array length', () => {
    expect(() =>
      Travels.deserialize(
        {
          version: 1,
          state: { items: new Array(2) },
          position: 1,
          patches: {
            patches: [[{ op: 'replace', path: ['items', 'length'], value: 1 }]],
            inversePatches: [
              [{ op: 'replace', path: ['items', 'length'], value: 1 }],
            ],
          },
        },
        semanticValidation
      )
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'forward',
      })
    );
  });

  test('distinguishes unchanged hole topology in direct snapshot replay', () => {
    const items = new Array<string>(3);
    const travels = createTravels(
      { items, count: 0 },
      { warnOnUnsupportedState: false }
    );
    travels.setState((draft) => {
      draft.count = 1;
    });

    const history = Travels.deserialize(
      travels.serialize(),
      semanticValidation
    );
    const restored = createTravels(history.state, {
      history,
      warnOnUnsupportedState: false,
    });

    restored.back();
    expect(restored.getState().items).toHaveLength(3);
    expect(0 in restored.getState().items).toBe(false);
    expect(1 in restored.getState().items).toBe(false);
    expect(2 in restored.getState().items).toBe(false);
    expect(restored.getState().count).toBe(0);

    restored.forward();
    expect(restored.getState().items).toHaveLength(3);
    expect(0 in restored.getState().items).toBe(false);
    expect(1 in restored.getState().items).toBe(false);
    expect(2 in restored.getState().items).toBe(false);
    expect(restored.getState().count).toBe(1);
  });

  test('rejects a generated history that cannot preserve an expanded array hole', () => {
    const travels = createTravels(
      { items: [1] },
      {
        warnOnUnsupportedState: false,
      }
    );
    travels.setState((draft) => {
      draft.items.length = 2;
    });

    expect(() =>
      Travels.deserialize(travels.serialize(), semanticValidation)
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'forward',
      })
    );
  });

  test('validates every past and future entry without changing the snapshot', () => {
    const travels = createTravels(
      { items: [1, 2, 3, 4], count: 0 },
      { maxHistory: 10 }
    );
    travels.setState((draft) => {
      draft.items.length = 2;
    });
    travels.setState((draft) => {
      draft.count = 1;
      draft.items.splice(0, 1, 9, 8);
    });
    travels.setState((draft) => {
      draft.items.length = 1;
    });
    travels.go(1);

    const serialized = JSON.stringify(travels.serialize());
    const history = Travels.deserialize<{
      items: number[];
      count: number;
    }>(serialized, semanticValidation);
    const restored = createTravels(history.state, { history, maxHistory: 10 });

    expect(JSON.stringify(history)).toBe(serialized);
    expect(restored.getHistory()).toEqual(travels.getHistory());
    expect(restored.getPosition()).toBe(1);
  });

  test('isolates a plain replay graph once regardless of entry count', () => {
    const entryCount = 20;
    const position = entryCount / 2;
    const snapshot: TravelsSerializedHistory<{ count: number }> = {
      version: 1,
      state: { count: position },
      position,
      patches: {
        patches: Array.from({ length: entryCount }, (_, index) => [
          { op: 'replace', path: ['count'], value: index + 1 },
        ]),
        inversePatches: Array.from({ length: entryCount }, (_, index) => [
          { op: 'replace', path: ['count'], value: index },
        ]),
      },
    };
    const structuredCloneSpy = vi.spyOn(globalThis, 'structuredClone');

    try {
      expect(() =>
        Travels.deserialize(snapshot, semanticValidation)
      ).not.toThrow();
      expect(structuredCloneSpy).toHaveBeenCalledTimes(1);
    } finally {
      structuredCloneSpy.mockRestore();
    }
  });

  test('does not freeze caller-owned snapshots during semantic replay', () => {
    const sharedChild = { nested: { value: 1 } };
    const snapshot: TravelsSerializedHistory<{
      count: number;
      sharedChild: typeof sharedChild;
    }> = {
      version: 1,
      state: { count: 0, sharedChild },
      position: 0,
      patches: {
        patches: [[{ op: 'replace', path: ['count'], value: 1 }]],
        inversePatches: [[{ op: 'replace', path: ['count'], value: 0 }]],
      },
    };

    const history = Travels.deserialize(snapshot, semanticValidation);

    expect(history.state.sharedChild).toBe(sharedChild);
    expect(Object.isFrozen(snapshot.state)).toBe(false);
    expect(Object.isFrozen(sharedChild)).toBe(false);
    expect(Object.isFrozen(sharedChild.nested)).toBe(false);
  });

  test('rejects opaque state before replay can invoke its setters', () => {
    let setterCalls = 0;
    class Box {
      private current = 0;

      get value() {
        return this.current;
      }

      set value(next: number) {
        setterCalls += 1;
        this.current = next;
      }
    }

    const box = new Box();
    const snapshot: TravelsSerializedHistory<{ box: Box }> = {
      version: 1,
      state: { box },
      position: 0,
      patches: {
        patches: [[{ op: 'replace', path: ['box', 'value'], value: 1 }]],
        inversePatches: [[{ op: 'replace', path: ['box', 'value'], value: 0 }]],
      },
    };

    expect(() =>
      Travels.deserialize(snapshot, semanticValidation)
    ).toThrowError(semanticIsolationError());
    expect(setterCalls).toBe(0);
    expect(box.value).toBe(0);
    expect(snapshot.state.box).toBe(box);
  });

  test('fails closed when native replay isolation is unavailable', () => {
    vi.stubGlobal('structuredClone', undefined);
    try {
      expect(() =>
        Travels.deserialize(singleValueSnapshot(0, 1, 0), semanticValidation)
      ).toThrowError(semanticIsolationError());
      expect(() =>
        Travels.deserialize(emptySnapshot({ count: 0 }), semanticValidation)
      ).toThrowError(semanticIsolationError());
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('isolates intrinsic state while rejecting an in-place inverse', () => {
    const pattern = /a/g;
    const snapshot: TravelsSerializedHistory<{ pattern: RegExp }> = {
      version: 1,
      state: { pattern },
      position: 0,
      patches: {
        patches: [
          [{ op: 'replace', path: ['pattern', 'lastIndex'], value: 0 }],
        ],
        inversePatches: [
          [{ op: 'replace', path: ['pattern', 'lastIndex'], value: 999 }],
        ],
      },
    };
    const fallback = emptySnapshot({ pattern: /fallback/g });
    const onError = vi.fn();

    const history = Travels.deserialize(snapshot, {
      ...semanticValidation,
      fallback,
      onError,
    });

    expect(history).toEqual(fallback);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'inverse',
      })
    );
    expect(pattern.lastIndex).toBe(0);
    expect(snapshot.state.pattern).toBe(pattern);
  });

  test('preserves state-to-patch aliases inside isolated replay', () => {
    const pattern = /a/g;
    const state = { pattern };
    const snapshot: TravelsSerializedHistory<typeof state> = {
      version: 1,
      state,
      position: 1,
      patches: {
        patches: [[{ op: 'replace', path: [], value: state }]],
        inversePatches: [
          [{ op: 'replace', path: ['pattern', 'lastIndex'], value: 999 }],
        ],
      },
    };

    expect(() =>
      Travels.deserialize(snapshot, semanticValidation)
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'forward',
      })
    );
    expect(pattern.lastIndex).toBe(0);
    expect(snapshot.state).toBe(state);
    expect((snapshot.patches.patches[0][0] as { value: unknown }).value).toBe(
      state
    );
    expect(snapshot.patches.patches[0][0]).toEqual({
      op: 'replace',
      path: [],
      value: state,
    });
  });

  test('does not mutate object-valued patch payloads during replay', () => {
    const pattern = /a/g;
    const replacement = { pattern };
    const snapshot: TravelsSerializedHistory<{
      pattern: RegExp | null;
    }> = {
      version: 1,
      state: { pattern: null },
      position: 0,
      patches: {
        patches: [[{ op: 'replace', path: [], value: replacement }]],
        inversePatches: [
          [{ op: 'replace', path: ['pattern', 'lastIndex'], value: 999 }],
        ],
      },
    };

    expect(() =>
      Travels.deserialize(snapshot, semanticValidation)
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'inverse',
      })
    );
    expect(pattern.lastIndex).toBe(0);
    expect(snapshot.patches.patches[0][0]).toEqual({
      op: 'replace',
      path: [],
      value: replacement,
    });
  });

  test('ignores unsupported replay options without mutating the snapshot', () => {
    const travels = createTravels({ nested: { value: 0 } });
    travels.setState((draft) => {
      draft.nested.value = 1;
    });
    const snapshot = travels.serialize();
    // Wider option bags remain assignable in TypeScript and are common in JS.
    const replayOptions = { strict: false, mutable: true };

    const history = Travels.deserialize(snapshot, {
      validation: 'semantic',
      replayOptions,
    });
    const restored = createTravels(history.state, { history });

    expect(snapshot.state).toEqual({ nested: { value: 1 } });
    restored.back();
    expect(restored.getState()).toEqual({ nested: { value: 0 } });
    restored.forward();
    expect(restored.getState()).toEqual({ nested: { value: 1 } });
  });

  test('uses the same semantic pipeline for fallback snapshots', () => {
    const errors: string[] = [];
    const fallback = emptySnapshot({ count: 0 });

    const history = Travels.deserialize(
      {
        version: 1,
        state: { count: 1 },
        position: 1,
        patches: {
          patches: [[{ op: 'replace', path: ['missing', 'value'], value: 1 }]],
          inversePatches: [
            [{ op: 'replace', path: ['missing', 'value'], value: 0 }],
          ],
        },
      },
      {
        ...semanticValidation,
        fallback,
        onError(error) {
          errors.push((error as TravelsPersistenceError).code);
        },
      }
    );

    expect(history).toEqual(fallback);
    expect(errors).toEqual(['INVALID_HISTORY']);
  });

  test('reports FALLBACK_FAILED when fallback semantics are invalid', () => {
    const invalidFallback = {
      version: 1 as const,
      state: { count: 0 },
      position: 0,
      patches: {
        patches: [
          [{ op: 'replace' as const, path: ['missing', 'value'], value: 1 }],
        ],
        inversePatches: [
          [{ op: 'replace' as const, path: ['missing', 'value'], value: 0 }],
        ],
      },
    };

    try {
      Travels.deserialize('not-json', {
        ...semanticValidation,
        fallback: invalidFallback,
      });
      throw new Error('Expected semantic fallback validation to fail');
    } catch (error) {
      expect(error).toEqual(
        expect.objectContaining<Partial<TravelsPersistenceError>>({
          code: 'FALLBACK_FAILED',
          cause: expect.objectContaining({ code: 'INVALID_HISTORY' }),
        })
      );
    }
  });
});
