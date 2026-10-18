import { describe, expect, test } from 'vitest';
import { createTravels } from '../src/index';

describe('history patch replay ordering', () => {
  test.each([true, false])(
    'restores array length assignments with pathAsArray=%s',
    (pathAsArray) => {
      const initial = { items: [1, 2, 3, 4] };
      const travels = createTravels(initial, {
        patchesOptions: { pathAsArray },
      });

      travels.setState((draft) => {
        draft.items.length = 1;
      });

      expect(travels.getState()).toEqual({ items: [1] });
      expect(travels.getHistory()).toEqual([initial, { items: [1] }]);

      travels.back();
      expect(travels.getState()).toEqual(initial);

      travels.forward();
      expect(travels.getState()).toEqual({ items: [1] });
    }
  );

  test('matches the recorded model at every position', () => {
    const initial = {
      items: [1, 2, 3, 4],
      nested: { enabled: false, label: 'initial' },
    };
    const travels = createTravels(initial, { maxHistory: 10 });
    const snapshots = [initial];

    travels.setState((draft) => {
      draft.items.length = 2;
      draft.nested.enabled = true;
    });
    snapshots.push({
      items: [1, 2],
      nested: { enabled: true, label: 'initial' },
    });

    travels.setState((draft) => {
      draft.items.splice(0, 1, 9, 8);
      draft.nested.label = 'updated';
    });
    snapshots.push({
      items: [9, 8, 2],
      nested: { enabled: true, label: 'updated' },
    });

    travels.setState((draft) => {
      draft.items.length = 1;
      delete (draft.nested as { enabled: boolean; label?: string }).label;
    });
    snapshots.push({
      items: [9],
      nested: { enabled: true },
    } as (typeof snapshots)[number]);

    expect(travels.getHistory()).toEqual(snapshots);

    for (let position = snapshots.length - 1; position >= 0; position -= 1) {
      travels.go(position);
      expect(travels.getState()).toEqual(snapshots[position]);
      expect(travels.getHistory()[position]).toEqual(travels.getState());
    }

    for (let position = 0; position < snapshots.length; position += 1) {
      travels.go(position);
      expect(travels.getState()).toEqual(snapshots[position]);
    }
  });
});

describe('history entries with more operations than a call accepts', () => {
  // Engines cap how many arguments a call takes, at roughly 125k elements in
  // V8, so this entry is too large to spread into push().
  const length = 130_000;
  const createInitialState = () => ({
    items: Array.from({ length }, (_, index) => index),
  });
  const rewriteEveryItem = (draft: { items: number[] }) => {
    for (let index = 0; index < length; index += 1) {
      draft.items[index] = -index;
    }
  };

  test('undoes and redoes the entry', () => {
    const travels = createTravels(createInitialState(), {
      warnOnUnsupportedState: false,
    });

    travels.setState(rewriteEveryItem);
    expect(travels.getPatches().patches[0]).toHaveLength(length);

    travels.back();
    expect(travels.getState().items[1]).toBe(1);

    travels.forward();
    expect(travels.getState().items[1]).toBe(-1);
  });

  test('commits the entry from a transaction', () => {
    const travels = createTravels(createInitialState(), {
      warnOnUnsupportedState: false,
    });

    travels.transaction(() => {
      travels.setState(rewriteEveryItem);
    });

    expect(travels.getPosition()).toBe(1);
    expect(travels.getPatches().patches[0]).toHaveLength(length);

    travels.back();
    expect(travels.getState().items[1]).toBe(1);
  });

  test('composes the entry while it is pending in manual mode', () => {
    const travels = createTravels(createInitialState(), {
      autoArchive: false,
      warnOnUnsupportedState: false,
    });

    travels.setState(rewriteEveryItem);

    expect(travels.canForward()).toBe(false);
    expect(travels.getPatches().patches[0]).toHaveLength(length);
    expect(travels.serialize().position).toBe(1);

    travels.archive();
    travels.back();
    expect(travels.getState().items[1]).toBe(1);
  });
});
