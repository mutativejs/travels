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
        'MAP_SET_PERSISTENCE',
      ])
    );
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
