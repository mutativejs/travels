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
