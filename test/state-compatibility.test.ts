import { describe, expect, test, vi } from 'vitest';
import {
  createTravels,
  findStateCompatibilityIssues,
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
    expect(warnings[0]).toContain('Date values can be cloned');

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
