import { describe, expect, test } from 'vitest';
import { createTravels } from '../src/index';

type CountState = { count: number };

const buildCountHistory = (steps: number) => {
  const patches: Array<Array<{ op: 'replace'; path: (string | number)[]; value: number }>> = [];
  const inversePatches: Array<
    Array<{ op: 'replace'; path: (string | number)[]; value: number }>
  > = [];

  for (let i = 0; i < steps; i++) {
    patches.push([{ op: 'replace', path: ['count'], value: i + 1 }]);
    inversePatches.push([{ op: 'replace', path: ['count'], value: i }]);
  }

  return { patches, inversePatches };
};

const rehydrateCountHistory = ({
  totalSteps,
  maxHistory,
  position,
  current = totalSteps,
}: {
  totalSteps: number;
  maxHistory: number;
  position: number;
  current?: number;
}) =>
  createTravels<CountState>(
    { count: current },
    {
      maxHistory,
      initialPatches: buildCountHistory(totalSteps),
      initialPosition: position,
    }
  );

describe('Rehydration maxHistory normalization', () => {
  test('trims initial history and adjusts position', () => {
    const travels = rehydrateCountHistory({
      totalSteps: 12,
      maxHistory: 5,
      position: 12,
    });

    expect(travels.getPatches().patches.length).toBe(5);
    expect(travels.getPosition()).toBe(5);

    const observed: Array<{ position: number; count: number }> = [];

    for (let i = 0; i <= 5; i++) {
      observed.push({
        position: travels.getPosition(),
        count: travels.getState().count,
      });

      if (i < 5) {
        travels.back();
      }
    }

    expect(observed).toEqual([
      { position: 5, count: 12 },
      { position: 4, count: 11 },
      { position: 3, count: 10 },
      { position: 2, count: 9 },
      { position: 1, count: 8 },
      { position: 0, count: 7 },
    ]);
  });

  test('getHistory only returns the retained window', () => {
    const travels = rehydrateCountHistory({
      totalSteps: 12,
      maxHistory: 5,
      position: 12,
    });

    expect(travels.getHistory().map((state) => state.count)).toEqual([
      7, 8, 9, 10, 11, 12,
    ]);
  });

  test('reset keeps the normalized history', () => {
    const travels = rehydrateCountHistory({
      totalSteps: 12,
      maxHistory: 5,
      position: 12,
    });

    travels.reset();

    expect(travels.getPosition()).toBe(5);
    expect(travels.getPatches().patches.length).toBe(5);
    expect(travels.getState().count).toBe(12);

    travels.back();
    expect(travels.getPosition()).toBe(4);
    expect(travels.getState().count).toBe(11);
  });

  test('positions before the retained tail keep a contiguous future window', () => {
    const travels = rehydrateCountHistory({
      totalSteps: 12,
      maxHistory: 5,
      position: 6,
      current: 6,
    });

    expect(travels.getPatches().patches.length).toBe(5);
    expect(travels.getPosition()).toBe(0);
    expect(travels.getState().count).toBe(6);
    expect(travels.getHistory().map((state) => state.count)).toEqual([
      6, 7, 8, 9, 10, 11,
    ]);

    travels.forward();
    expect(travels.getPosition()).toBe(1);
    expect(travels.getState().count).toBe(7);
  });

  test('restored undone snapshots do not jump across trimmed gaps', () => {
    const travels = rehydrateCountHistory({
      totalSteps: 10,
      maxHistory: 5,
      position: 2,
      current: 2,
    });

    expect(travels.getPosition()).toBe(0);
    expect(travels.getState().count).toBe(2);
    expect(travels.getHistory().map((state) => state.count)).toEqual([
      2, 3, 4, 5, 6, 7,
    ]);

    travels.forward();
    expect(travels.getPosition()).toBe(1);
    expect(travels.getState().count).toBe(3);
  });
});
