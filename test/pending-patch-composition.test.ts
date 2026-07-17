import { describe, expect, test } from 'vitest';
import { createTravels, Travels } from '../src/index';

const isRootReplacement = (operation: { op: string; path: unknown }) =>
  operation.op === 'replace' &&
  (operation.path === '' ||
    (Array.isArray(operation.path) && operation.path.length === 0));

describe('pending patch composition', () => {
  type RootSwitchState = { items: number[] } | number[];

  test('manual archive preserves granular patches and exact inverse order', () => {
    const initial = {
      payload: 'x'.repeat(100_000),
      count: 0,
      items: [1, 2, 3, 4],
    };
    const travels = createTravels(initial, {
      autoArchive: false,
      maxHistory: 10,
    });

    travels.setState((draft) => {
      draft.count = 1;
    });
    travels.setState((draft) => {
      draft.items.length = 1;
    });
    travels.archive();

    const patches = travels.getPatches();
    expect(patches.patches).toHaveLength(1);
    expect(patches.patches[0].some(isRootReplacement)).toBe(false);
    expect(JSON.stringify(patches).length).toBeLessThan(2_000);
    expect(travels.getHistory()).toEqual([
      initial,
      { ...initial, count: 1, items: [1] },
    ]);

    travels.back();
    expect(travels.getState()).toEqual(initial);
    travels.forward();
    expect(travels.getState()).toEqual({
      ...initial,
      count: 1,
      items: [1],
    });
  });

  test('transaction commits granular changes as one reversible entry', () => {
    const initial = {
      payload: 'x'.repeat(100_000),
      count: 0,
      items: [1, 2, 3, 4],
    };
    const travels = createTravels(initial, { maxHistory: 10 });

    travels.transaction(() => {
      travels.setState((draft) => {
        draft.count = 1;
      });
      travels.setState((draft) => {
        draft.items.length = 2;
      });
    });

    const patches = travels.getPatches();
    expect(patches.patches).toHaveLength(1);
    expect(patches.patches[0].some(isRootReplacement)).toBe(false);
    expect(JSON.stringify(patches).length).toBeLessThan(2_000);

    travels.back();
    expect(travels.getState()).toEqual(initial);
    travels.forward();
    expect(travels.getState()).toEqual({
      ...initial,
      count: 1,
      items: [1, 2],
    });
  });

  test('manual archive detaches mutable root replacements before composition', () => {
    const travels = createTravels<RootSwitchState>(
      { items: [0] },
      {
        autoArchive: false,
        mutable: true,
        warnOnUnsupportedState: false,
      }
    );

    travels.setState([1, 2]);
    travels.setState((draft) => {
      if (Array.isArray(draft)) {
        draft.push(3);
      }
    });
    travels.archive();

    expect(travels.getState()).toEqual([1, 2, 3]);
    expect(() =>
      Travels.deserialize(travels.serialize(), { validation: 'semantic' })
    ).not.toThrow();

    travels.back();
    expect(travels.getState()).toEqual({ items: [0] });
    travels.forward();
    expect(travels.getState()).toEqual([1, 2, 3]);
  });

  test('transaction detaches mutable root replacements before composition', () => {
    const travels = createTravels<RootSwitchState>(
      { items: [0] },
      { mutable: true, warnOnUnsupportedState: false }
    );

    travels.transaction(() => {
      travels.setState([1, 2]);
      travels.setState((draft) => {
        if (Array.isArray(draft)) {
          draft.push(3);
        }
      });
    });

    expect(travels.getState()).toEqual([1, 2, 3]);
    expect(() =>
      Travels.deserialize(travels.serialize(), { validation: 'semantic' })
    ).not.toThrow();

    travels.back();
    expect(travels.getState()).toEqual({ items: [0] });
    travels.forward();
    expect(travels.getState()).toEqual([1, 2, 3]);
  });

  test('root replacement followed by nested edits remains reversible', () => {
    const initial = { items: [1, 2, 3], label: 'initial' };
    const travels = createTravels(initial, { autoArchive: false });

    travels.setState({ items: [4, 5, 6], label: 'replacement' });
    travels.setState((draft) => {
      draft.items.length = 1;
      draft.label = 'final';
    });
    travels.archive();

    expect(travels.getHistory()).toEqual([
      initial,
      { items: [4], label: 'final' },
    ]);
    expect(
      travels.getPatches().patches[0].filter(isRootReplacement)
    ).toHaveLength(1);
    expect(travels.getPatches().inversePatches[0]).toHaveLength(1);

    travels.back();
    expect(travels.getState()).toEqual(initial);
    travels.forward();
    expect(travels.getState()).toEqual({ items: [4], label: 'final' });
  });

  test.each([true, false])(
    'drops superseded root replacements with pathAsArray=%s',
    (pathAsArray) => {
      const payloadSize = 100_000;
      const makePayload = (index: number) =>
        String(index).padStart(4, '0') + 'x'.repeat(payloadSize - 4);
      const initial = { payload: makePayload(0) };
      const travels = createTravels(initial, {
        maxHistory: 10,
        patchesOptions: { pathAsArray },
      });

      travels.transaction(() => {
        for (let index = 1; index <= 20; index += 1) {
          travels.setState({ payload: makePayload(index) });
        }
      });

      const patches = travels.getPatches();
      expect(patches.patches[0]).toHaveLength(1);
      expect(patches.inversePatches[0]).toHaveLength(1);
      expect(JSON.stringify(travels.serialize()).length).toBeLessThan(400_000);

      travels.back();
      expect(travels.getState()).toEqual(initial);
      travels.forward();
      expect(travels.getState()).toEqual({ payload: makePayload(20) });
    }
  );
});
