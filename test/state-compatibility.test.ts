import { describe, expect, test, vi } from 'vitest';
import {
  createTravels,
  findStateCompatibilityIssues,
  TravelsError,
  type JsonValue,
  type PatchableState,
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
