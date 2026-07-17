import { describe, expect, test, vi } from 'vitest';
import {
  createTravels,
  TravelsError,
  type TravelsObserverErrorEvent,
} from '../src/index';

describe('observer publication atomicity', () => {
  test('a throwing branch observer cannot interrupt a committed transition', () => {
    const observerErrors: TravelsObserverErrorEvent[] = [];
    const listener = vi.fn();
    const devtools = vi.fn();
    const travels = createTravels(
      { count: 0 },
      {
        maxHistory: 10,
        onBranchDiscard() {
          throw new Error('branch observer failed');
        },
        onObserverError(event) {
          observerErrors.push(event);
        },
        devtools,
      }
    );
    travels.subscribe(listener);

    travels.setState((draft) => {
      draft.count = 1;
    });
    travels.setState((draft) => {
      draft.count = 2;
    });
    travels.back();
    listener.mockClear();
    devtools.mockClear();

    expect(() =>
      travels.setState((draft) => {
        draft.count = 3;
      })
    ).not.toThrow();

    expect(travels.getState()).toEqual({ count: 3 });
    expect(travels.getPosition()).toBe(2);
    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 1, 3]);
    expect(travels.canForward()).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0]).toEqual({ count: 3 });
    expect(listener.mock.calls[0][2]).toBe(2);
    expect(listener.mock.calls[0][1].patches).toHaveLength(2);
    expect(devtools).toHaveBeenCalledOnce();
    expect(observerErrors).toHaveLength(1);
    expect(observerErrors[0].source).toBe('onBranchDiscard');
  });

  test('listener and devtools failures are isolated from other observers', () => {
    const sources: string[] = [];
    const healthyListener = vi.fn();
    const travels = createTravels(
      { count: 0 },
      {
        devtools() {
          throw new Error('devtools failed');
        },
        onObserverError(event) {
          sources.push(event.source);
        },
      }
    );

    travels.subscribe(() => {
      throw new Error('listener failed');
    });
    travels.subscribe(healthyListener);

    expect(() =>
      travels.setState((draft) => {
        draft.count = 1;
      })
    ).not.toThrow();

    expect(healthyListener).toHaveBeenCalledOnce();
    expect(healthyListener.mock.calls[0][0]).toEqual({ count: 1 });
    expect(sources).toEqual(['listener', 'devtools']);
    expect(travels.getState()).toEqual({ count: 1 });
  });

  test('publishes one final observer event after a root transaction commits', () => {
    const listenerSnapshots: Array<{
      count: number;
      position: number;
      historyLength: number;
    }> = [];
    const devtoolsEvents: Array<{
      type: string;
      count: number;
      position: number;
      historyLength: number;
    }> = [];
    const travels = createTravels(
      { count: 0 },
      {
        devtools(event) {
          devtoolsEvents.push({
            type: event.type,
            count: event.state.count,
            position: event.position,
            historyLength: event.patches.patches.length,
          });
        },
      }
    );
    travels.subscribe((state, patches, position) => {
      listenerSnapshots.push({
        count: state.count,
        position,
        historyLength: patches.patches.length,
      });
    });

    travels.transaction({ label: 'committed' }, () => {
      travels.setState({ count: 1 });
      travels.setState({ count: 2 });
      expect(listenerSnapshots).toEqual([]);
      expect(devtoolsEvents).toEqual([]);
    });

    expect(listenerSnapshots).toEqual([
      { count: 2, position: 1, historyLength: 1 },
    ]);
    expect(devtoolsEvents).toEqual([
      {
        type: 'transaction',
        count: 2,
        position: 1,
        historyLength: 1,
      },
    ]);
  });

  test('does not publish provisional or rollback events for failed transactions', () => {
    const listener = vi.fn();
    const devtools = vi.fn();
    const travels = createTravels({ count: 0 }, { devtools });
    travels.subscribe(listener);

    expect(() =>
      travels.transaction(() => {
        travels.setState({ count: 1 });
        expect(listener).not.toHaveBeenCalled();
        expect(devtools).not.toHaveBeenCalled();
        throw new Error('rollback');
      })
    ).toThrow(TravelsError);

    expect(travels.getState()).toEqual({ count: 0 });
    expect(travels.getPosition()).toBe(0);
    expect(travels.getPatches().patches).toHaveLength(0);
    expect(listener).not.toHaveBeenCalled();
    expect(devtools).not.toHaveBeenCalled();
  });

  test('restores nested observer effects before the outer transaction commits', () => {
    const observedCounts: number[] = [];
    const eventTypes: string[] = [];
    const travels = createTravels(
      { count: 0 },
      {
        devtools(event) {
          eventTypes.push(event.type);
        },
      }
    );
    travels.subscribe((state) => observedCounts.push(state.count));

    travels.transaction(() => {
      travels.setState({ count: 1 });
      try {
        travels.transaction(() => {
          travels.setState({ count: 2 });
          throw new Error('nested rollback');
        });
      } catch {
        // Keep the root transaction alive.
      }
      travels.setState({ count: 3 });
    });

    expect(observedCounts).toEqual([3]);
    expect(eventTypes).toEqual(['transaction']);
  });

  test('publishes committed non-archive transaction changes once', () => {
    const listener = vi.fn();
    const eventTypes: string[] = [];
    const travels = createTravels(
      { count: 0 },
      {
        devtools(event) {
          eventTypes.push(event.type);
        },
      }
    );
    travels.subscribe(listener);
    travels.setState({ count: 1 });
    listener.mockClear();
    eventTypes.length = 0;

    travels.transaction(() => {
      travels.reset();
    });

    expect(travels.getState()).toEqual({ count: 0 });
    expect(listener).toHaveBeenCalledOnce();
    expect(eventTypes).toEqual(['transaction']);
  });

  test('reports asynchronous observer rejections without leaving them unhandled', async () => {
    const listenerFailure = new Error('async listener failed');
    const devtoolsFailure = new Error('async devtools failed');
    const branchFailure = new Error('async branch observer failed');
    const operationFailure = new Error('async operation observer failed');
    const observerErrors: TravelsObserverErrorEvent[] = [];
    const travels = createTravels(
      { count: 0 },
      {
        async devtools(event) {
          if (event.type === 'setState' && event.state.count === 3) {
            throw devtoolsFailure;
          }
        },
        async onBranchDiscard() {
          throw branchFailure;
        },
        async onError() {
          throw operationFailure;
        },
        async onObserverError(event) {
          observerErrors.push(event);
          throw new Error('async observer reporter failed');
        },
      }
    );
    const unsubscribe = travels.subscribe(async (state) => {
      if (state.count === 3) {
        throw listenerFailure;
      }
    });

    travels.setState({ count: 1 });
    travels.setState({ count: 2 });
    travels.back();
    travels.setState({ count: 3 });

    await vi.waitFor(() => {
      expect(observerErrors).toHaveLength(3);
    });
    expect(observerErrors).toEqual(
      expect.arrayContaining([
        { source: 'listener', error: listenerFailure },
        { source: 'devtools', error: devtoolsFailure },
        { source: 'onBranchDiscard', error: branchFailure },
      ])
    );

    unsubscribe();
    expect(() =>
      travels.transaction(() => {
        throw new Error('transaction failed');
      })
    ).toThrow(TravelsError);

    await vi.waitFor(() => {
      expect(observerErrors).toHaveLength(4);
    });
    expect(observerErrors[3]).toEqual({
      source: 'onError',
      error: operationFailure,
    });
  });

  test('synchronous writes during publication are rejected without mixing events', () => {
    const observerErrors: TravelsObserverErrorEvent[] = [];
    const snapshots: Array<{
      state: number;
      position: number;
      historyLength: number;
    }> = [];
    const travels = createTravels(
      { count: 0 },
      {
        onObserverError(event) {
          observerErrors.push(event);
        },
      }
    );

    travels.subscribe((state) => {
      if (state.count === 1) {
        travels.setState((draft) => {
          draft.count = 2;
        });
      }
    });
    travels.subscribe((state, patches, position) => {
      snapshots.push({
        state: state.count,
        position,
        historyLength: patches.patches.length,
      });
    });

    travels.setState((draft) => {
      draft.count = 1;
    });

    expect(travels.getState()).toEqual({ count: 1 });
    expect(snapshots).toEqual([{ state: 1, position: 1, historyLength: 1 }]);
    expect(observerErrors).toHaveLength(1);
    expect(observerErrors[0].source).toBe('listener');
    expect(observerErrors[0].error).toEqual(
      expect.objectContaining({
        message:
          'Travels: setState cannot be called while observers are being notified.',
      })
    );

    travels.setState((draft) => {
      draft.count = 2;
    });
    expect(travels.getState()).toEqual({ count: 2 });
    expect(snapshots[1]).toEqual({
      state: 2,
      position: 2,
      historyLength: 2,
    });
  });

  test('error observers cannot mutate rollback state or replace failures', () => {
    const observerErrors: TravelsObserverErrorEvent[] = [];
    let travels: ReturnType<typeof createTravels<{ count: number }>>;
    travels = createTravels(
      { count: 0 },
      {
        onError() {
          travels.setState((draft) => {
            draft.count = 99;
          });
        },
        onObserverError(event) {
          observerErrors.push(event);
          throw new Error('observer error reporter failed');
        },
      }
    );

    expect(() =>
      travels.transaction(() => {
        travels.setState((draft) => {
          draft.count = 1;
        });
        throw new Error('transaction failed');
      })
    ).toThrow(TravelsError);

    expect(travels.getState()).toEqual({ count: 0 });
    expect(travels.getPosition()).toBe(0);
    expect(travels.getPatches().patches).toHaveLength(0);
    expect(observerErrors).toHaveLength(1);
    expect(observerErrors[0].source).toBe('onError');
  });
});
