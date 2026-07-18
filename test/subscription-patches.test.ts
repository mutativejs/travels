import { describe, expect, test, vi } from 'vitest';
import {
  createTravels,
  type TravelPatches,
  type TravelsEvent,
} from '../src/index';

describe('subscription patch snapshots', () => {
  type RootSwitchState = { items: number[] } | number[];

  test('does not clone history when observers ignore event patches', () => {
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

  test('materializes one shared event-local delta on first access', () => {
    const snapshots: TravelPatches[] = [];
    const travels = createTravels({ count: 0 }, { maxHistory: 10 });

    travels.subscribe(({ patches }) => {
      snapshots.push(patches);
      expect(patches.patches).toBe(patches.patches);
    });
    travels.subscribe(({ patches }) => snapshots.push(patches));

    travels.setState((draft) => {
      draft.count = 1;
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toBe(snapshots[1]);
    expect(snapshots[0].patches).toHaveLength(1);
    expect(snapshots[0].inversePatches).toHaveLength(1);
  });

  test('shares one frozen event envelope with subscribers and devtools', () => {
    const events: TravelsEvent<{ count: number }>[] = [];
    const travels = createTravels(
      { count: 0 },
      {
        devtools(event) {
          events.push(event);
        },
      }
    );

    travels.subscribe((event) => events.push(event));
    travels.subscribe((event) => events.push(event));
    travels.setState(
      (draft) => {
        draft.count = 1;
      },
      { label: 'increment' }
    );

    expect(events).toHaveLength(3);
    expect(events[0]).toBe(events[1]);
    expect(events[1]).toBe(events[2]);
    expect(Object.isFrozen(events[0])).toBe(true);
    expect(events[0]).toMatchObject({
      type: 'setState',
      state: { count: 1 },
      position: 1,
      historyLength: 1,
      metadata: { label: 'increment' },
    });
    expect(Object.getOwnPropertyDescriptor(events[0], 'patches')).toMatchObject(
      { enumerable: true, get: expect.any(Function) }
    );
    expect(events[0].patches).toBe(events[0].patches);
  });

  test('keeps patch reads constant as retained history grows', () => {
    let latest:
      | { patches: TravelPatches; historyLength: number }
      | undefined;
    const travels = createTravels({ count: 0 }, { maxHistory: 100 });
    travels.subscribe(({ patches, historyLength }) => {
      latest = { patches, historyLength };
    });

    for (let count = 1; count <= 100; count += 1) {
      travels.setState((draft) => {
        draft.count = count;
      });
    }

    expect(latest?.historyLength).toBe(100);
    expect(latest?.patches.patches).toHaveLength(1);
    expect(latest?.patches.inversePatches).toHaveLength(1);
    expect(travels.getPatches().patches).toHaveLength(100);
  });

  test('publishes composed transaction deltas and empty archive deltas', () => {
    const events: Array<{
      type: TravelsEvent<unknown>['type'];
      patches: TravelPatches;
      historyLength: number;
    }> = [];
    const travels = createTravels(
      { count: 0 },
      { autoArchive: false, maxHistory: 10 }
    );
    travels.subscribe(({ type, patches, historyLength }) => {
      events.push({ type, patches, historyLength });
    });

    travels.transaction(() => {
      travels.setState({ count: 1 });
      travels.setState({ count: 2 });
    });
    travels.setState({ count: 3 });
    travels.archive();

    expect(events).toHaveLength(3);
    expect(events.map((event) => event.type)).toEqual([
      'transaction',
      'setState',
      'archive',
    ]);
    expect(events[0].patches.patches).toHaveLength(1);
    expect(events[0].patches.patches[0]).toEqual([
      { op: 'replace', path: [], value: { count: 2 } },
    ]);
    expect(events[0].patches.inversePatches[0]).toEqual([
      { op: 'replace', path: [], value: { count: 0 } },
    ]);
    expect(events[0].historyLength).toBe(1);
    expect(events[1].patches.patches).toHaveLength(1);
    expect(events[1].historyLength).toBe(2);
    expect(events[2].patches).toEqual({ patches: [], inversePatches: [] });
    expect(events[2].historyLength).toBe(2);
  });

  test('retains the event-time delta across appends and branch replacement', () => {
    let firstSnapshot: TravelPatches | undefined;
    const travels = createTravels({ count: 0 }, { maxHistory: 10 });

    travels.subscribe(({ patches }) => {
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

  test('captures event-time patches before their lazy first read', () => {
    let firstEvent: TravelsEvent<{ count: number }> | undefined;
    const travels = createTravels({ count: 0 }, { maxHistory: 10 });

    travels.subscribe((event) => {
      firstEvent ??= event;
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

    expect(firstEvent?.patches.patches).toEqual([
      [{ op: 'replace', path: ['count'], value: 1 }],
    ]);
    expect(firstEvent?.patches.inversePatches).toEqual([
      [{ op: 'replace', path: ['count'], value: 0 }],
    ]);
  });

  test('retains an unarchived manual delta across later pending updates', () => {
    let firstSnapshot: TravelPatches | undefined;
    const travels = createTravels(
      { count: 0 },
      { autoArchive: false, maxHistory: 10 }
    );
    travels.subscribe(({ patches }) => {
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

  test('retains mutable root replacement values across later updates', () => {
    let firstSnapshot: TravelPatches | undefined;
    const travels = createTravels<RootSwitchState>(
      { items: [0] },
      { mutable: true, maxHistory: 10, warnOnUnsupportedState: false }
    );
    travels.subscribe(({ patches }) => {
      firstSnapshot ??= patches;
    });

    travels.setState([1, 2]);
    travels.setState((draft) => {
      if (Array.isArray(draft)) {
        draft.push(3);
      }
    });

    expect(firstSnapshot!.patches).toEqual([
      [{ op: 'replace', path: [], value: [1, 2] }],
    ]);

    travels.go(0);
    travels.go(1);
    expect(travels.getState()).toEqual([1, 2]);
    travels.forward();
    expect(travels.getState()).toEqual([1, 2, 3]);
  });
});
