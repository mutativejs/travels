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
        'MAP_SET_PERSISTENCE',
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
    'diagnoses a JSON-encodable but non-durable %s terminal patch path',
    (_label, terminalSegment) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const path = [terminalSegment] as unknown as string[];
      const travels = createTravels<Record<PropertyKey, unknown>>(
        {},
        {
          initialPatches: {
            patches: [[{ op: 'replace', path, value: 1 }]],
            inversePatches: [[{ op: 'replace', path, value: 0 }]],
          },
          strictInitialPatches: true,
        }
      );

      const encoded = JSON.stringify(travels.serialize());

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'patch compatibility warning at $.patches.patches[0][0].path'
        )
      );
      expect(() => Travels.deserialize(encoded)).toThrowError(
        expect.objectContaining({ code: 'INVALID_PATCHES' })
      );

      warnSpy.mockRestore();
    }
  );

  test('diagnoses patch-only values that JSON would silently change', () => {
    type Payload = {
      missing: undefined;
      nan: number;
      negativeZero: number;
      createdAt: Date;
      tags: Map<string, number>;
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
        tags: new Map([['one', 1]]),
      },
    });
    source.setState({ payload: null });

    const snapshot = Travels.deserialize(source.serialize(), {
      validation: 'semantic',
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const restored = createTravels(snapshot.state, { history: snapshot });
    const warnings = warnSpy.mock.calls.map(([message]) => String(message));

    expect(warnings).toHaveLength(5);
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('.value.payload.missing'),
        expect.stringContaining('.value.payload.nan'),
        expect.stringContaining('.value.payload.negativeZero'),
        expect.stringContaining('.value.payload.createdAt'),
        expect.stringContaining('.value.payload.tags'),
      ])
    );

    const jsonRoundTrip = JSON.parse(JSON.stringify(restored.serialize()));
    expect(jsonRoundTrip.patches.patches[0][0].value.payload).toEqual({
      nan: null,
      negativeZero: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      tags: {},
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

  test('mutable mode flags Map and Set as unsupported runtime state', () => {
    const issues = findStateCompatibilityIssues(
      {
        tags: new Set(['a']),
        index: new Map([['a', 1]]),
      },
      { mutable: true }
    );

    expect(issues.map((issue) => issue.code)).toEqual([
      'MAP_SET_MUTABLE',
      'MAP_SET_MUTABLE',
    ]);
  });

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
