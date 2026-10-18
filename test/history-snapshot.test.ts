import { describe, expect, test } from 'vitest';
import { createTravelJournal, createTravels, TravelsTypeError } from '../src/index';

describe('detached history snapshots', () => {
  test('returns independent arrays and state trees', () => {
    const travels = createTravels({ nested: { count: 0 } }, {
      warnOnUnsupportedState: false,
    });
    travels.setState((draft) => {
      draft.nested.count = 1;
    });

    const first = travels.getHistorySnapshot();
    const second = travels.getHistorySnapshot();

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first[0].nested).not.toBe(second[0].nested);

    first[0].nested.count = 99;
    first.push({ nested: { count: 100 } });

    expect(travels.getHistory().map((state) => state.nested.count)).toEqual([
      0, 1,
    ]);
    expect(travels.getState().nested.count).toBe(1);
  });

  test('is available through controls and controlled journals', () => {
    const travels = createTravels({ count: 0 }, {
      warnOnUnsupportedState: false,
    });
    travels.setState((draft) => {
      draft.count = 1;
    });
    expect(travels.getControls().getHistorySnapshot()).toEqual([
      { count: 0 },
      { count: 1 },
    ]);

    const journal = createTravelJournal(
      { count: 0 },
      {
        warnOnUnsupportedState: false,
        apply: ({ state }) => state,
      }
    );
    expect(journal.getHistorySnapshot()).toEqual([{ count: 0 }]);
  });

  test('copies values that JSON would not keep', () => {
    const shared = { label: 'shared' };
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const state = {
      optional: undefined as string | undefined,
      createdAt,
      notANumber: NaN,
      negativeZero: -0,
      big: 1n,
      first: shared,
      second: shared,
      dictionary: Object.assign(Object.create(null) as object, { key: 1 }),
      self: null as unknown,
    };
    state.self = state;
    const travels = createTravels(state, { warnOnUnsupportedState: false });

    const [snapshot] = travels.getHistorySnapshot();

    expect(snapshot).not.toBe(state);
    expect(Object.keys(snapshot)).toEqual(Object.keys(state));
    expect(snapshot.optional).toBeUndefined();
    expect(snapshot.createdAt).not.toBe(createdAt);
    expect(snapshot.createdAt).toBeInstanceOf(Date);
    expect(snapshot.createdAt.getTime()).toBe(createdAt.getTime());
    expect(snapshot.notANumber).toBeNaN();
    expect(Object.is(snapshot.negativeZero, -0)).toBe(true);
    expect(snapshot.big).toBe(1n);
    expect(snapshot.first).not.toBe(shared);
    expect(snapshot.second).toBe(snapshot.first);
    expect(snapshot.dictionary).not.toBe(state.dictionary);
    expect(Object.getPrototypeOf(snapshot.dictionary)).toBeNull();
    expect(snapshot.self).toBe(snapshot);
  });

  test('returns writable copies of frozen history', () => {
    const travels = createTravels(
      { nested: { count: 0 }, items: [0] },
      { enableAutoFreeze: true, warnOnUnsupportedState: false }
    );
    travels.setState((draft) => {
      draft.nested.count = 1;
    });
    expect(Object.isFrozen(travels.getState().nested)).toBe(true);

    const snapshot = travels.getHistorySnapshot();
    snapshot[1].nested.count = 2;
    snapshot[1].items.push(1);

    expect(snapshot[1]).toEqual({ nested: { count: 2 }, items: [0, 1] });
    expect(travels.getState()).toEqual({ nested: { count: 1 }, items: [0] });
  });

  test('fails instead of sharing values it cannot copy', () => {
    class Point {
      x = 1;
    }
    const withAccessor = {};
    Object.defineProperty(withAccessor, 'value', {
      enumerable: true,
      get: () => 1,
    });

    for (const value of [() => 1, new Point(), withAccessor, /pattern/]) {
      const travels = createTravels(
        { value },
        { warnOnUnsupportedState: false }
      );

      expect(() => travels.getHistorySnapshot()).toThrowError(
        expect.objectContaining<Partial<TravelsTypeError>>({
          code: 'PERSISTENCE_INCOMPATIBLE',
        })
      );
    }
  });
});
