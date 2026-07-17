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
