import { describe, expect, test, vi } from 'vitest';
import {
  createTravels,
  findStateCompatibilityIssues,
  Travels,
  TravelsError,
  type JsonValue,
  type PatchableState,
  type TravelMetadata,
} from '../src/index';

const createCrossRealmCollection = (
  kind: 'Map' | 'Set'
): Map<unknown, unknown> | Set<unknown> => {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const foreignGlobal = iframe.contentWindow as
    | (Window & typeof globalThis)
    | null;
  if (!foreignGlobal) {
    iframe.remove();
    throw new Error('Expected iframe realm to be available');
  }

  const collection =
    kind === 'Map'
      ? new foreignGlobal.Map([['a', { id: 1 }]])
      : new foreignGlobal.Set([{ id: 1 }]);
  iframe.remove();
  return collection;
};

describe('State compatibility warnings', () => {
  test('findStateCompatibilityIssues reports unsupported durable-state values', () => {
    class User {
      name = 'Alice';
    }

    const circular: any = { label: 'root' };
    circular.self = circular;

    const issues = findStateCompatibilityIssues({
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      onClick: () => undefined,
      user: new User(),
      circular,
      ref: document.createElement('div'),
      missing: undefined,
      sparse: new Array(2),
      tags: new Set(['a']),
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'DATE',
        'FUNCTION',
        'CLASS_INSTANCE',
        'CIRCULAR_REFERENCE',
        'DOM_NODE',
        'UNDEFINED',
        'ARRAY_SHAPE',
        'MAP_SET',
      ])
    );
  });

  test('flags sparse arrays without treating explicit undefined as a hole', () => {
    expect(findStateCompatibilityIssues({ items: new Array(2) })).toEqual([
      expect.objectContaining({
        code: 'ARRAY_SHAPE',
        path: '$.items',
      }),
    ]);

    expect(
      findStateCompatibilityIssues({ items: [undefined, undefined] }).map(
        (issue) => issue.code
      )
    ).toEqual(['UNDEFINED', 'UNDEFINED']);
  });

  test('flags primitive values that JSON cannot preserve', () => {
    const issues = findStateCompatibilityIssues({
      bigint: 1n,
      nan: NaN,
      positiveInfinity: Infinity,
      negativeInfinity: -Infinity,
      negativeZero: -0,
      finite: Number.MAX_VALUE,
      zero: 0,
    });

    expect(issues.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: 'BIGINT', path: '$.bigint' },
      { code: 'NON_JSON_NUMBER', path: '$.nan' },
      { code: 'NON_JSON_NUMBER', path: '$.positiveInfinity' },
      { code: 'NON_JSON_NUMBER', path: '$.negativeInfinity' },
      { code: 'NON_JSON_NUMBER', path: '$.negativeZero' },
    ]);
  });

  test('flags non-enumerable array indices lost by snapshot cloning', () => {
    const items: string[] = [];
    Object.defineProperty(items, '0', {
      value: 'kept',
      enumerable: false,
    });

    expect(findStateCompatibilityIssues({ items })).toEqual([
      expect.objectContaining({
        code: 'ARRAY_SHAPE',
        path: '$.items',
      }),
    ]);

    const snapshot = createTravels(
      { items },
      { warnOnUnsupportedState: false }
    ).serialize();
    expect(0 in snapshot.state.items).toBe(false);
    expect(JSON.stringify(snapshot.state)).toBe('{"items":[null]}');
  });

  test('flags custom array properties lost by updates and persistence', () => {
    const items = Object.assign(['a'], { note: 'keep' });
    const hiddenItems = ['a'];
    Object.defineProperty(hiddenItems, 'note', { value: 'keep' });
    const symbolItems = ['a'];
    Object.defineProperty(symbolItems, Symbol('note'), { value: 'keep' });

    expect(findStateCompatibilityIssues({ items })).toEqual([
      expect.objectContaining({
        code: 'ARRAY_SHAPE',
        path: '$.items',
      }),
    ]);
    expect(
      [hiddenItems, symbolItems].map(
        (value) => findStateCompatibilityIssues(value)[0]?.code
      )
    ).toEqual(['ARRAY_SHAPE', 'ARRAY_SHAPE']);

    const travels = createTravels({ items }, { warnOnUnsupportedState: false });
    travels.setState((draft) => {
      draft.items[0] = 'b';
    });
    expect(travels.getState().items.note).toBeUndefined();

    travels.back();
    expect(travels.getState().items).toEqual(['a']);
    expect(travels.getState().items.note).toBeUndefined();
    expect(JSON.stringify(travels.serialize().state)).toBe('{"items":["a"]}');
  });

  test('flags array subclasses whose prototypes are lost by snapshots', () => {
    class Items extends Array<string> {
      first(): string | undefined {
        return this[0];
      }
    }

    const items = new Items('a');
    expect(findStateCompatibilityIssues({ items })).toEqual([
      expect.objectContaining({
        code: 'ARRAY_SHAPE',
        path: '$.items',
      }),
    ]);

    const snapshot = createTravels(
      { items },
      { warnOnUnsupportedState: false }
    ).serialize();
    expect(snapshot.state.items).toEqual(['a']);
    expect(Object.getPrototypeOf(snapshot.state.items)).toBe(Array.prototype);
    expect(
      (snapshot.state.items as unknown as { first?: unknown }).first
    ).toBeUndefined();
  });

  test('flags null-prototype objects that patch updates cannot track', () => {
    const dictionary = Object.assign(Object.create(null), { value: 0 });

    expect(findStateCompatibilityIssues({ dictionary })).toEqual([
      expect.objectContaining({
        code: 'CLASS_INSTANCE',
        path: '$.dictionary',
      }),
    ]);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createTravels({ dictionary });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('$.dictionary')
    );
    warnSpy.mockRestore();
  });

  test('flags property descriptors and integrity levels lost by persistence', () => {
    const hidden = {} as { value: number };
    Object.defineProperty(hidden, 'value', { value: 1 });
    const readonly = {} as { value: number };
    Object.defineProperty(readonly, 'value', {
      configurable: true,
      enumerable: true,
      value: 1,
      writable: false,
    });
    const fixedLength = [1];
    Object.defineProperty(fixedLength, 'length', { writable: false });
    const readonlyIndex = [1];
    Object.defineProperty(readonlyIndex, '0', { writable: false });

    expect(
      [hidden, readonly, Object.preventExtensions({ value: 1 })].map(
        (value) => findStateCompatibilityIssues(value)[0]?.code
      )
    ).toEqual(['OBJECT_SHAPE', 'OBJECT_SHAPE', 'OBJECT_SHAPE']);
    expect(
      [fixedLength, readonlyIndex, Object.preventExtensions([1])].map(
        (value) => findStateCompatibilityIssues(value)[0]?.code
      )
    ).toEqual(['ARRAY_SHAPE', 'ARRAY_SHAPE', 'ARRAY_SHAPE']);
  });

  test('diagnoses accessors without invoking them', () => {
    const objectGetter = vi.fn(() => {
      throw new Error('object getter must not run');
    });
    const arrayGetter = vi.fn(() => {
      throw new Error('array getter must not run');
    });
    const object = {} as { value: unknown };
    Object.defineProperty(object, 'value', {
      configurable: true,
      enumerable: true,
      get: objectGetter,
    });
    const array: unknown[] = [];
    Object.defineProperty(array, '0', {
      configurable: true,
      enumerable: true,
      get: arrayGetter,
    });

    expect(findStateCompatibilityIssues({ object, array })).toEqual([
      expect.objectContaining({ code: 'OBJECT_SHAPE', path: '$.object' }),
      expect.objectContaining({ code: 'ARRAY_SHAPE', path: '$.array' }),
    ]);
    expect(objectGetter).not.toHaveBeenCalled();
    expect(arrayGetter).not.toHaveBeenCalled();
  });

  test('allows intentional auto-frozen durable containers', () => {
    const frozen = Object.freeze({ items: Object.freeze([1]) });
    expect(
      findStateCompatibilityIssues(frozen).map((issue) => issue.code)
    ).toEqual(['OBJECT_SHAPE', 'ARRAY_SHAPE']);
    expect(findStateCompatibilityIssues(frozen, { allowFrozen: true })).toEqual(
      []
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const travels = createTravels({ items: [1] }, { enableAutoFreeze: true });
    travels.setState((draft) => {
      draft.items[0] = 2;
    });
    travels.setState((draft) => {
      draft.items = [3];
    });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('createTravels warns once per incompatible state path in development', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const travels = createTravels({
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      value: 1,
    });

    travels.setState((draft) => {
      draft.createdAt = new Date('2025-01-02T00:00:00.000Z');
    });

    const warnings = warnSpy.mock.calls.map(([message]) => String(message));
    expect(
      warnings.filter((message) => message.includes('$.createdAt'))
    ).toHaveLength(1);
    expect(warnings[0]).toContain('timestamp or ISO string');

    warnSpy.mockRestore();
  });

  test('warns once per incompatible persisted metadata path', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const travels = createTravels({ count: 0 });

    travels.setState(
      (draft) => {
        draft.count = 1;
      },
      {
        requestId: 1n,
        timestamp: NaN,
        nested: { offset: -0 },
      }
    );
    travels.serialize();

    const metadataWarnings = warnSpy.mock.calls
      .map(([message]) => String(message))
      .filter((message) => message.includes('metadata compatibility warning'));
    expect(metadataWarnings).toHaveLength(3);
    expect(metadataWarnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('$.requestId'),
        expect.stringContaining('$.timestamp'),
        expect.stringContaining('$.nested.offset'),
      ])
    );
    expect(() => JSON.stringify(travels.serialize())).toThrow(TypeError);
    expect(warnSpy.mock.calls.map(([message]) => String(message))).toHaveLength(
      3
    );

    warnSpy.mockRestore();
  });

  test('publishes metadata compatibility warnings only after root commit', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const travels = createTravels({ count: 0 });

    expect(() =>
      travels.transaction({ requestId: 1n }, () => {
        travels.setState({ count: 1 });
        throw new Error('rollback');
      })
    ).toThrow(TravelsError);
    expect(warnSpy).not.toHaveBeenCalled();

    travels.transaction({ requestId: 2n }, () => {
      travels.setState({ count: 2 });
    });

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('metadata compatibility warning at $.requestId')
    );

    warnSpy.mockRestore();
  });

  test('checks metadata restored with existing history', () => {
    const source = createTravels(
      { count: 0 },
      { warnOnUnsupportedState: false }
    );
    source.setState({ count: 1 }, { requestId: 1n });
    const snapshot = source.serialize();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createTravels(snapshot.state, { history: snapshot });

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('metadata compatibility warning at $.requestId')
    );
    warnSpy.mockRestore();
  });

  test('checks retained forward and inverse patch payloads', () => {
    const source = createTravels(
      { value: 0 as number | bigint | null },
      { warnOnUnsupportedState: false }
    );
    source.setState({ value: 1n });
    source.setState({ value: null });

    const snapshot = Travels.deserialize(source.serialize(), {
      validation: 'semantic',
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const restored = createTravels(snapshot.state, { history: snapshot });

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'patch compatibility warning at $.patches.patches[0][0].value'
      )
    );
    expect(() => JSON.stringify(restored.serialize())).toThrow(TypeError);

    restored.back();
    expect(restored.getState().value).toBe(1n);
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });

  test.each([
    ['boolean', false],
    ['null', null],
    ['negative integer', -1],
    ['fractional number', 1.5],
    ['plain object', { key: 'x' }],
    ['symbol', Symbol('runtime-key')],
  ] as const)(
    'rejects a non-durable %s terminal patch path',
    (_label, terminalSegment) => {
      const path = [terminalSegment] as unknown as string[];
      expect(() =>
        createTravels<Record<PropertyKey, unknown>>(
          {},
          {
            initialPatches: {
              patches: [[{ op: 'replace', path, value: 1 }]],
              inversePatches: [[{ op: 'replace', path, value: 0 }]],
            },
            strictInitialPatches: true,
          }
        )
      ).toThrow(/initialPatches/);
    }
  );

  test('diagnoses patch-only values that JSON would silently change', () => {
    type Payload = {
      missing: undefined;
      nan: number;
      negativeZero: number;
      createdAt: Date;
    };
    const source = createTravels(
      { payload: null as Payload | null },
      { warnOnUnsupportedState: false }
    );
    source.setState({
      payload: {
        missing: undefined,
        nan: NaN,
        negativeZero: -0,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
    source.setState({ payload: null });

    const snapshot = Travels.deserialize(source.serialize(), {
      validation: 'semantic',
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const restored = createTravels(snapshot.state, { history: snapshot });
    const warnings = warnSpy.mock.calls.map(([message]) => String(message));

    expect(warnings).toHaveLength(4);
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('.value.payload.missing'),
        expect.stringContaining('.value.payload.nan'),
        expect.stringContaining('.value.payload.negativeZero'),
        expect.stringContaining('.value.payload.createdAt'),
      ])
    );

    const jsonRoundTrip = JSON.parse(JSON.stringify(restored.serialize()));
    expect(jsonRoundTrip.patches.patches[0][0].value.payload).toEqual({
      nan: null,
      negativeZero: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    warnSpy.mockRestore();
  });

  test('publishes patch compatibility warnings only after root commit', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const travels = createTravels({ value: null as bigint | null });

    expect(() =>
      travels.transaction(() => {
        travels.setState((draft) => {
          draft.value = 1n;
        });
        travels.setState((draft) => {
          draft.value = null;
        });
        throw new Error('rollback');
      })
    ).toThrow(TravelsError);
    expect(warnSpy).not.toHaveBeenCalled();

    travels.transaction(() => {
      travels.setState((draft) => {
        draft.value = 2n;
      });
      travels.setState((draft) => {
        draft.value = null;
      });
    });

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('patch compatibility warning')
    );

    warnSpy.mockRestore();
  });

  test('does not rescan retained patch payloads or metadata after later commits', () => {
    class RuntimeOnlyValue {
      callback = () => undefined;
    }

    const retainedPatchValue = new RuntimeOnlyValue();
    const retainedMetadata = new RuntimeOnlyValue();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prototypeSpy = vi.spyOn(Object, 'getPrototypeOf');
    const travels = createTravels<{
      count: number;
      value: RuntimeOnlyValue | null;
    }>({ count: 0, value: null }, { maxHistory: 100 });

    travels.setState(
      { count: 0, value: retainedPatchValue },
      retainedMetadata as unknown as TravelMetadata
    );
    travels.setState({ count: 0, value: null });

    const countInspections = (value: object) =>
      prototypeSpy.mock.calls.filter(([candidate]) => candidate === value)
        .length;
    const patchInspections = countInspections(retainedPatchValue);
    const metadataInspections = countInspections(retainedMetadata);

    for (let count = 1; count <= 20; count += 1) {
      travels.setState({ count, value: null });
    }

    const laterPatchInspections = countInspections(retainedPatchValue);
    const laterMetadataInspections = countInspections(retainedMetadata);
    prototypeSpy.mockRestore();
    warnSpy.mockRestore();

    expect(patchInspections).toBeGreaterThan(0);
    expect(metadataInspections).toBeGreaterThan(0);
    expect(laterPatchInspections).toBe(patchInspections);
    expect(laterMetadataInspections).toBe(metadataInspections);
  });

  test('serialize rechecks retained payloads changed through shared references', () => {
    const payload = { nested: 0 as number | bigint };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const travels = createTravels<{ payload: typeof payload | null }>({
      payload: null,
    });

    travels.setState({ payload });
    travels.setState({ payload: null });
    expect(warnSpy).not.toHaveBeenCalled();

    payload.nested = 1n;

    expect(() => JSON.stringify(travels.serialize())).toThrow(TypeError);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('patch compatibility warning')
    );

    warnSpy.mockRestore();
  });

  test('checks entries explicitly archived before a transaction root commits', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const travels = createTravels(
      { marker: 0, value: null as bigint | null },
      { autoArchive: false }
    );

    travels.transaction(() => {
      travels.setState((draft) => {
        draft.value = 1n;
      });
      travels.setState((draft) => {
        draft.value = null;
      });
      travels.archive();
      travels.setState((draft) => {
        draft.marker = 1;
      });
    });

    expect(travels.getPatches().patches).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('patch compatibility warning')
    );

    warnSpy.mockRestore();
  });

  test('does not retain a full-scan request from a rolled-back nested transaction', () => {
    const travels = createTravels(
      { marker: 0, value: null as bigint | null },
      { autoArchive: false }
    );
    const fullScanSpy = vi.spyOn(
      travels as any,
      'warnAboutPersistenceCompatibility'
    );

    travels.transaction(() => {
      try {
        travels.transaction(() => {
          travels.setState((draft) => {
            draft.value = 1n;
          });
          travels.archive();
          throw new Error('rollback nested archive');
        });
      } catch {
        // The root transaction remains active after the nested rollback.
      }

      travels.setState((draft) => {
        draft.marker = 1;
      });
    });

    expect(travels.getState()).toEqual({ marker: 1, value: null });
    expect(travels.getPatches().patches).toHaveLength(1);
    expect(fullScanSpy).not.toHaveBeenCalled();
  });

  test('warnOnUnsupportedState disables runtime compatibility warnings', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createTravels(
      {
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      },
      { warnOnUnsupportedState: false }
    );

    const travels = createTravels(
      { count: 0 },
      { warnOnUnsupportedState: false }
    );
    travels.setState({ count: 1 }, { requestId: 1n });
    travels.setState({ count: 2n as unknown as number });
    travels.serialize();

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('flags Map and Set as unsupported runtime state in every mode', () => {
    const issues = findStateCompatibilityIssues({
      tags: new Set(['a']),
      index: new Map([['a', 1]]),
    });

    expect(issues.map((issue) => issue.code)).toEqual(['MAP_SET', 'MAP_SET']);
    expect(issues.map((issue) => issue.message)).toEqual([
      'Set is unsupported; store values in a dense array.',
      'Map is unsupported; store entries in a plain object or dense array.',
    ]);
  });

  test.each([false, true])(
    'rejects Map and Set when creating a runtime (mutable: %s)',
    (mutable) => {
      const options = { mutable, warnOnUnsupportedState: false };

      expect(() =>
        createTravels({ nested: { value: new Map([['a', 1]]) } }, options)
      ).toThrow(
        'Travels: Map and Set are not supported in state. Normalize collections to plain objects or dense arrays.'
      );
      expect(() =>
        createTravels({ nested: { value: new Set(['a']) } }, options)
      ).toThrow(
        'Travels: Map and Set are not supported in state. Normalize collections to plain objects or dense arrays.'
      );
    }
  );

  test.each(['Map', 'Set'] as const)(
    'rejects cross-realm %s instances throughout runtime boundaries',
    (kind) => {
      const collection = createCrossRealmCollection(kind);
      expect(collection instanceof Map).toBe(false);
      expect(collection instanceof Set).toBe(false);
      expect(findStateCompatibilityIssues({ value: collection })).toEqual([
        expect.objectContaining({
          code: 'MAP_SET',
          path: '$.value',
        }),
      ]);

      for (const mutable of [false, true]) {
        expect(() =>
          createTravels(
            { value: collection },
            { mutable, warnOnUnsupportedState: false }
          )
        ).toThrow('Travels: Map and Set are not supported in state.');

        const travels = createTravels<{ count: number; value: unknown }>(
          { count: 0, value: null },
          { mutable, warnOnUnsupportedState: false }
        );
        expect(() =>
          travels.setState((draft) => {
            draft.count = 1;
            draft.value = collection;
          })
        ).toThrow('Travels: Map and Set are not supported in state.');
        expect(travels.getState()).toEqual({ count: 0, value: null });
        expect(travels.getPosition()).toBe(0);
      }
    }
  );

  test.each(['Map', 'Set'] as const)(
    'rejects cross-realm %s patches before forward replay',
    (kind) => {
      const collection = createCrossRealmCollection(kind);

      expect(() =>
        createTravels(
          { value: null as unknown },
          {
            initialPatches: {
              patches: [
                [{ op: 'replace', path: ['value'], value: collection }],
              ],
              inversePatches: [
                [{ op: 'replace', path: ['value'], value: null }],
              ],
            },
            initialPosition: 0,
            strictInitialPatches: true,
            warnOnUnsupportedState: false,
          }
        )
      ).toThrow('Travels: initialPatches must not contain Map or Set values');
    }
  );

  test('does not reject plain objects with spoofed collection tags', () => {
    const taggedPrototype = {};
    Object.defineProperty(taggedPrototype, Symbol.toStringTag, {
      value: 'Map',
    });
    const values = [
      { [Symbol.toStringTag]: 'Set', label: 'own tag' },
      Object.assign(Object.create(taggedPrototype), {
        label: 'prototype tag',
      }),
    ];

    for (const value of values) {
      expect(() =>
        createTravels({ value }, { warnOnUnsupportedState: false })
      ).not.toThrow();
    }
  });

  test('does not invoke collection-tag accessors while checking state', () => {
    const tagGetter = vi.fn(() => 'Set');
    const prototype = {};
    Object.defineProperty(prototype, Symbol.toStringTag, {
      get: tagGetter,
    });
    const value = Object.create(prototype);

    expect(() =>
      createTravels({ value }, { warnOnUnsupportedState: false })
    ).not.toThrow();
    expect(tagGetter).not.toHaveBeenCalled();
  });

  test.each([
    ['Map', () => new Proxy(new Map(), {})],
    ['Set', () => new Proxy(new Set(), {})],
  ] as const)('rejects a same-realm proxy around %s', (_kind, createValue) => {
    expect(() =>
      createTravels(
        { value: createValue() },
        { warnOnUnsupportedState: false }
      )
    ).toThrow('Travels: Map and Set are not supported in state.');
  });

  test.each([
    ['Map', false, () => new Map([['a', { id: 1 }]])],
    ['Set', false, () => new Set([{ id: 1 }])],
    ['Map', true, () => new Map([['a', { id: 1 }]])],
    ['Set', true, () => new Set([{ id: 1 }])],
  ] as const)(
    'rejects an inserted %s collection atomically (mutable: %s)',
    (_collectionName, mutable, createCollection) => {
      const travels = createTravels<{ count: number; value: unknown }>(
        { count: 0, value: null },
        { mutable, warnOnUnsupportedState: false }
      );
      const initialState = travels.getState();

      expect(() =>
        travels.setState((draft) => {
          draft.count = 1;
          draft.value = createCollection();
        })
      ).toThrow(
        'Travels: Map and Set are not supported in state. Normalize collections to plain objects or dense arrays.'
      );

      expect(travels.getState()).toBe(initialState);
      expect(travels.getState()).toEqual({ count: 0, value: null });
      expect(travels.getPosition()).toBe(0);
      expect(travels.getPatches()).toEqual({
        patches: [],
        inversePatches: [],
      });
    }
  );

  test('rejects collection-bearing imported patches before history cloning', () => {
    expect(() =>
      createTravels(
        { value: null as Set<number> | null },
        {
          initialPatches: {
            patches: [
              [{ op: 'replace', path: ['value'], value: new Set([1]) }],
            ],
            inversePatches: [[{ op: 'replace', path: ['value'], value: null }]],
          },
          initialPosition: 1,
          strictInitialPatches: true,
          warnOnUnsupportedState: false,
        }
      )
    ).toThrow('Travels: initialPatches must not contain Map or Set values');
  });

  test('rejects externally introduced collections at explicit baseline boundaries', () => {
    const state: { value: unknown } = { value: null };
    const travels = createTravels(state, { warnOnUnsupportedState: false });
    state.value = new Set([1]);

    expect(() => travels.replaceStateWithoutHistory(() => undefined)).toThrow(
      'Travels: Map and Set are not supported in state.'
    );
    expect(() => travels.rebase()).toThrow(
      'Travels: Map and Set are not supported in state.'
    );
    expect(() => travels.serialize()).toThrow(
      'Travels: Map and Set are not supported in state.'
    );
  });

  test.each(['Map', 'Set'] as const)(
    'rejects externally introduced cross-realm %s during serialization',
    (kind) => {
      const state: { value: unknown } = { value: null };
      const travels = createTravels(state, {
        warnOnUnsupportedState: false,
      });
      state.value = createCrossRealmCollection(kind);

      expect(() => travels.serialize()).toThrow(
        'Travels: Map and Set are not supported in state.'
      );
    }
  );

  test('JsonValue and PatchableState helpers can constrain user APIs', () => {
    const jsonState = {
      title: 'Draft',
      blocks: [{ id: '1', text: 'Hello' }],
    } satisfies JsonValue;

    const createTypedTravels = <S extends PatchableState>(state: S) =>
      createTravels(state);

    const travels = createTypedTravels(jsonState);
    expect(travels.getState().title).toBe('Draft');
  });
});
