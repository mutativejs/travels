import { apply, create, type Draft, type Patches } from 'mutative';
import { describe, expect, test, vi } from 'vitest';
import { createTravelJournal, createTravels, Travels } from '../src/index';

type State = {
  count: number;
  label: string;
};

const produceCommit = (state: State, recipe: (draft: Draft<State>) => void) =>
  create(state, recipe, { enablePatches: true }) as [State, Patches, Patches];

describe('controlled travel journal', () => {
  test('records externally committed patches and delegates navigation', () => {
    let authoritativeState: State = { count: 0, label: 'initial' };
    const applyTransition = vi.fn(({ patches }: { patches: Patches }) => {
      authoritativeState = apply(authoritativeState, patches);
      return authoritativeState;
    });
    const journal = createTravelJournal(authoritativeState, {
      apply: applyTransition,
      maxHistory: 10,
    });

    const [nextState, patches, inversePatches] = produceCommit(
      authoritativeState,
      (draft) => {
        draft.count = 1;
      }
    );
    authoritativeState = nextState;
    journal.recordPatches(authoritativeState, {
      patches,
      inversePatches,
      metadata: { label: 'increment' },
    });

    expect(journal.getState()).toBe(authoritativeState);
    expect(journal.getPosition()).toBe(1);
    expect(journal.getHistoryEntries()[0].metadata?.label).toBe('increment');

    journal.back();
    expect(authoritativeState.count).toBe(0);
    expect(journal.getState()).toBe(authoritativeState);
    expect(journal.getPosition()).toBe(0);

    journal.forward();
    expect(authoritativeState.count).toBe(1);
    expect(journal.getPosition()).toBe(1);
    expect(applyTransition).toHaveBeenCalledTimes(2);
  });

  test('keeps state and cursor unchanged when controlled apply fails', () => {
    let authoritativeState: State = { count: 0, label: 'initial' };
    const journal = createTravelJournal(authoritativeState, {
      apply: () => {
        throw new Error('authority rejected transition');
      },
    });
    const [nextState, patches, inversePatches] = produceCommit(
      authoritativeState,
      (draft) => {
        draft.count = 1;
      }
    );
    authoritativeState = nextState;
    journal.recordPatches(authoritativeState, { patches, inversePatches });

    expect(() => journal.back()).toThrow('authority rejected transition');
    expect(journal.getState()).toBe(authoritativeState);
    expect(journal.getPosition()).toBe(1);
  });

  test('rejects asynchronous controlled apply results atomically', () => {
    let authoritativeState: State = { count: 0, label: 'initial' };
    const journal = createTravelJournal(authoritativeState, {
      apply: (() =>
        Promise.resolve(authoritativeState)) as unknown as () => State,
    });
    const [nextState, patches, inversePatches] = produceCommit(
      authoritativeState,
      (draft) => {
        draft.count = 1;
      }
    );
    authoritativeState = nextState;
    journal.recordPatches(authoritativeState, { patches, inversePatches });

    expect(() => journal.back()).toThrow(
      'controlledApply callback must be synchronous'
    );
    expect(journal.getState()).toBe(authoritativeState);
    expect(journal.getPosition()).toBe(1);
  });

  test('rejects state-owning operations even when the journal is widened', () => {
    const journal = createTravelJournal<State>(
      { count: 0, label: 'initial' },
      { apply: ({ state }) => state }
    ) as unknown as Travels<State>;
    const unsupportedOperations = [
      () => journal.setState({ count: 1, label: 'changed' }),
      () => journal.reset(),
      () => journal.replaceStateWithoutHistory({ count: 1, label: 'changed' }),
      () => journal.transaction(() => undefined),
      () => journal.batch(() => undefined),
      () => journal.pauseTracking(),
      () => journal.resumeTracking(),
      () => journal.archive(),
      () => journal.getControls().reset(),
    ];

    for (const operation of unsupportedOperations) {
      expect(operation).toThrow('is not available on a controlled journal');
    }

    expect(journal.getState()).toEqual({ count: 0, label: 'initial' });
    expect(journal.getPosition()).toBe(0);
  });

  test('reserves recordPatches for controlled journals', () => {
    const travels = createTravels({ count: 0, label: 'initial' });

    expect(() =>
      travels.recordPatches(
        { count: 1, label: 'initial' },
        { patches: [], inversePatches: [] }
      )
    ).toThrow('recordPatches is only available on a controlled journal');
  });

  test('requires an apply callback at runtime', () => {
    expect(() =>
      createTravelJournal(
        { count: 0, label: 'initial' },
        { apply: undefined as unknown as () => State }
      )
    ).toThrow('requires a synchronous apply function');
  });

  test('detaches recorded patch inputs from later caller mutation', () => {
    let authoritativeState: State = { count: 0, label: 'initial' };
    const journal = createTravelJournal(authoritativeState, {
      apply: ({ patches }) => {
        authoritativeState = apply(authoritativeState, patches);
        return authoritativeState;
      },
    });
    const [nextState, patches, inversePatches] = produceCommit(
      authoritativeState,
      (draft) => {
        draft.count = 1;
      }
    );
    authoritativeState = nextState;
    journal.recordPatches(authoritativeState, { patches, inversePatches });

    (patches[0] as { value?: unknown }).value = 999;
    patches[0].path[0] = 'label';
    patches[0].op = 'remove';
    (inversePatches[0] as { value?: unknown }).value = 999;
    inversePatches[0].path[0] = 'label';
    inversePatches[0].op = 'remove';

    journal.back();
    expect(authoritativeState.count).toBe(0);
    journal.forward();
    expect(authoritativeState.count).toBe(1);
  });

  test('keeps journal state and history unchanged when metadata cloning fails', () => {
    const initialState: State = { count: 0, label: 'initial' };
    const journal = createTravelJournal(initialState, {
      apply: ({ patches }) => apply(initialState, patches),
    });
    const [nextState, patches, inversePatches] = produceCommit(
      initialState,
      (draft) => {
        draft.count = 1;
      }
    );
    const metadata = {} as { label?: string };
    Object.defineProperty(metadata, 'label', {
      enumerable: true,
      get() {
        throw new Error('metadata getter failed');
      },
    });

    expect(() =>
      journal.recordPatches(nextState, {
        patches,
        inversePatches,
        metadata,
      })
    ).toThrow('metadata getter failed');

    expect(journal.getState()).toBe(initialState);
    expect(journal.getPosition()).toBe(0);
    expect(journal.getHistoryEntries()).toEqual([]);
  });

  test('discards a future branch when a new external commit is recorded', () => {
    let authoritativeState: State = { count: 0, label: 'initial' };
    const discarded = vi.fn();
    const journal = createTravelJournal(authoritativeState, {
      apply: ({ patches }) => {
        authoritativeState = apply(authoritativeState, patches);
        return authoritativeState;
      },
      maxHistory: 10,
      onBranchDiscard: discarded,
    });
    const commitCount = (count: number) => {
      const [nextState, patches, inversePatches] = produceCommit(
        authoritativeState,
        (draft) => {
          draft.count = count;
        }
      );
      authoritativeState = nextState;
      journal.recordPatches(authoritativeState, { patches, inversePatches });
    };

    commitCount(1);
    commitCount(2);
    journal.back();
    commitCount(3);

    expect(journal.getState().count).toBe(3);
    expect(journal.canForward()).toBe(false);
    expect(journal.getHistoryEntries()).toHaveLength(2);
    expect(discarded).toHaveBeenCalledTimes(1);
  });

  test('publishes recordPatches and go events with transition patches', () => {
    let authoritativeState: State = { count: 0, label: 'initial' };
    const journal = createTravelJournal(authoritativeState, {
      apply: ({ patches }) => {
        authoritativeState = apply(authoritativeState, patches);
        return authoritativeState;
      },
    });
    const events: Array<{ type: string; patchCount: number }> = [];
    journal.subscribe((event) => {
      events.push({
        type: event.type,
        patchCount: event.patches.patches[0]?.length ?? 0,
      });
    });
    const [nextState, patches, inversePatches] = produceCommit(
      authoritativeState,
      (draft) => {
        draft.count = 1;
      }
    );
    authoritativeState = nextState;

    journal.recordPatches(authoritativeState, { patches, inversePatches });
    journal.back();

    expect(events).toEqual([
      { type: 'recordPatches', patchCount: 1 },
      { type: 'go', patchCount: 1 },
    ]);
  });

  test('rejects unsupported collection values from external patches', () => {
    const state = { value: null as null | Map<string, number> };
    const journal = createTravelJournal(state, {
      apply: ({ patches }) => apply(state, patches),
    });

    expect(() =>
      journal.recordPatches(
        { value: new Map([['count', 1]]) },
        {
          patches: [
            {
              op: 'replace',
              path: ['value'],
              value: new Map([['count', 1]]),
            },
          ],
          inversePatches: [{ op: 'replace', path: ['value'], value: null }],
        }
      )
    ).toThrow('Map and Set are not supported');
  });
});
