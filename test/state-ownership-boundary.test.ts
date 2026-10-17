import { describe, expect, test } from 'vitest';
import {
  createPatchableTravels,
  createTravelJournal,
  createTravels,
  isTravels,
  restoreTravelJournal,
  restoreTravels,
  Travels,
} from '../src/index';

type Constructor = new (...args: unknown[]) => unknown;

describe('state-owning construction boundary', () => {
  test('rejects construction through an instance constructor', () => {
    const travels = createTravels({ count: 0 });
    const Core = travels.constructor as Constructor;

    expect(
      () =>
        new Core(
          { type: 'initial', state: { count: 0 } },
          { history: 'removed', controlledApply: () => ({}) }
        )
    ).toThrowError(
      expect.objectContaining({
        name: 'TravelsError',
        code: 'INVALID_OPERATION',
      })
    );
  });

  test('consumes the construction grant before option hooks run', () => {
    const Core = createTravels({}).constructor as Constructor;
    let nested: unknown;
    createTravels(
      { count: 0 },
      {
        maxHistory: 0,
        onWarning: () => {
          try {
            new Core({ type: 'initial', state: {} }, {});
          } catch (error) {
            nested = error;
          }
        },
      }
    );

    expect(nested).toMatchObject({ code: 'INVALID_OPERATION' });
  });

  test('keeps instances extensible for documented method wrapping', () => {
    const travels = createTravels({ count: 0 });
    const originalGo = travels.go.bind(travels);
    const visited: number[] = [];
    travels.go = (position) => {
      visited.push(position);
      originalGo(position);
    };

    travels.setState({ count: 1 });
    travels.back();

    expect(visited).toEqual([0]);
    expect(travels.getState()).toEqual({ count: 0 });
  });

  test('identifies state-owning timelines without instanceof', () => {
    const travels = createTravels({ count: 0 });
    const snapshot = travels.serialize();
    const apply = ({ state }: { state: { count: number } }) => state;

    expect(isTravels(travels)).toBe(true);
    expect(isTravels(restoreTravels(snapshot))).toBe(true);
    expect(isTravels(createPatchableTravels({ count: 0 }))).toBe(true);

    expect(isTravels(createTravelJournal({ count: 0 }, { apply }))).toBe(false);
    expect(isTravels(restoreTravelJournal(snapshot, { apply }))).toBe(false);
    expect(isTravels(travels.getControls())).toBe(false);
    expect(isTravels(Object.create(travels))).toBe(false);
    expect(isTravels(Travels)).toBe(false);
    expect(isTravels(null)).toBe(false);
    expect(() => {
      // @ts-expect-error Travels is a namespace, not a constructor
      void (travels instanceof Travels);
    }).toThrow(TypeError);
  });
});
