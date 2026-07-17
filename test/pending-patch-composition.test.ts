import { describe, expect, test } from 'vitest';
import { createTravels } from '../src/index';

const isRootReplacement = (operation: { op: string; path: unknown }) =>
  operation.op === 'replace' &&
  (operation.path === '' ||
    (Array.isArray(operation.path) && operation.path.length === 0));

describe('pending patch composition', () => {
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

    travels.back();
    expect(travels.getState()).toEqual(initial);
    travels.forward();
    expect(travels.getState()).toEqual({ items: [4], label: 'final' });
  });
});
