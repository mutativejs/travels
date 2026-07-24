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

  test('fails instead of returning partially shared runtime-only values', () => {
    const travels = createTravels(
      { createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { warnOnUnsupportedState: false }
    );

    expect(() => travels.getHistorySnapshot()).toThrowError(
      expect.objectContaining<Partial<TravelsTypeError>>({
        code: 'PERSISTENCE_INCOMPATIBLE',
      })
    );
  });
});
