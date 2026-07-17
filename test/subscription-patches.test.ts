import { describe, expect, test, vi } from 'vitest';
import { createTravels, type TravelPatches } from '../src/index';

describe('subscription patch snapshots', () => {
  test('does not clone history when observers ignore the patches argument', () => {
    const travels = createTravels({ count: 0 }, { maxHistory: 1_000 });
    const getPatches = vi.spyOn(travels, 'getPatches');
    travels.subscribe(() => {
      // State invalidation subscribers commonly need no patch history.
    });

    for (let count = 1; count <= 1_000; count += 1) {
      travels.setState((draft) => {
        draft.count = count;
      });
    }

    expect(getPatches).not.toHaveBeenCalled();
    expect(travels.getPosition()).toBe(1_000);
  });

  test('materializes one shared full-history snapshot on first access', () => {
    const snapshots: TravelPatches[] = [];
    const travels = createTravels({ count: 0 }, { maxHistory: 10 });

    travels.subscribe((_state, patches) => {
      snapshots.push(patches);
      expect(patches.patches).toBe(patches.patches);
    });
    travels.subscribe((_state, patches) => snapshots.push(patches));

    travels.setState((draft) => {
      draft.count = 1;
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toBe(snapshots[1]);
    expect(snapshots[0].patches).toHaveLength(1);
    expect(snapshots[0].inversePatches).toHaveLength(1);
  });

  test('retains the event-time history across appends and branch replacement', () => {
    let firstSnapshot: TravelPatches | undefined;
    const travels = createTravels({ count: 0 }, { maxHistory: 10 });

    travels.subscribe((_state, patches) => {
      firstSnapshot ??= patches;
    });

    travels.setState((draft) => {
      draft.count = 1;
    });
    travels.setState((draft) => {
      draft.count = 2;
    });
    travels.back();
    travels.setState((draft) => {
      draft.count = 3;
    });

    expect(firstSnapshot).toBeDefined();
    expect(firstSnapshot!.patches).toEqual([
      [{ op: 'replace', path: ['count'], value: 1 }],
    ]);
    expect(firstSnapshot!.inversePatches).toEqual([
      [{ op: 'replace', path: ['count'], value: 0 }],
    ]);

    firstSnapshot!.patches[0].length = 0;
    travels.back();
    expect(travels.getState()).toEqual({ count: 1 });
  });

  test('retains an unarchived manual snapshot across later pending updates', () => {
    let firstSnapshot: TravelPatches | undefined;
    const travels = createTravels(
      { count: 0 },
      { autoArchive: false, maxHistory: 10 }
    );
    travels.subscribe((_state, patches) => {
      firstSnapshot ??= patches;
    });

    travels.setState((draft) => {
      draft.count = 1;
    });
    travels.setState((draft) => {
      draft.count = 2;
    });

    expect(firstSnapshot!.patches).toEqual([
      [{ op: 'replace', path: ['count'], value: 1 }],
    ]);
    expect(travels.getPatches().patches[0]).toHaveLength(2);
  });
});
