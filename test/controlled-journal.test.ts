import { apply, create, type Draft, type Patches } from 'mutative';
import { describe, expect, test, vi } from 'vitest';
import {
  createTravelJournal,
  createTravels,
  Travels,
  TravelsError,
  TravelsTypeError,
  type TravelHistoryEntry,
} from '../src/index';

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

  test('revalidates reused external state references after mutation', () => {
    type MutableOwnerState = { count: number; unsupported?: Map<string, number> };
    const authoritativeState: MutableOwnerState = { count: 0 };
    const journal = createTravelJournal(authoritativeState, {
      apply({ patches }) {
        const next = apply(authoritativeState, patches);
        Object.assign(authoritativeState, next);
        authoritativeState.unsupported = new Map([['value', 1]]);
        return authoritativeState;
      },
    });
    authoritativeState.count = 1;
    journal.recordPatches(authoritativeState, {
      patches: [{ op: 'replace', path: ['count'], value: 1 }],
      inversePatches: [{ op: 'replace', path: ['count'], value: 0 }],
    });

    expect(() => journal.back()).toThrow(
      'Map and Set are not supported in state'
    );
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

  test('exposes stable error codes for integration failures', () => {
    const initialState: State = { count: 0, label: 'initial' };
    const journal = createTravelJournal(initialState, {
      apply: ({ state }) => state,
    });

    try {
      journal.recordPatches(
        { count: 1, label: 'initial' },
        {
          patches: [{ op: 'move', path: ['count'] }] as unknown as Patches,
          inversePatches: [],
        }
      );
      throw new Error('expected recordPatches to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(TravelsTypeError);
      expect((error as TravelsTypeError).code).toBe('INVALID_PATCH_ENTRY');
    }

    const widened = journal as unknown as Travels<State>;
    try {
      widened.setState({ count: 1, label: 'changed' });
      throw new Error('expected controlled setState to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(TravelsError);
      expect((error as TravelsError).code).toBe(
        'CONTROLLED_OPERATION_UNAVAILABLE'
      );
    }
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

  test('rejects patch values that cannot be safely detached', () => {
    const initialState: State & { value?: unknown } = {
      count: 0,
      label: 'initial',
    };
    const journal = createTravelJournal(initialState, {
      apply: ({ state }) => state,
      warnOnUnsupportedState: false,
    });

    for (const value of [() => 'behavior', new WeakMap<object, unknown>()]) {
      expect(() =>
        journal.recordPatches(
          { ...initialState, value },
          {
            patches: [{ op: 'add', path: ['value'], value }],
            inversePatches: [{ op: 'remove', path: ['value'] }],
          }
        )
      ).toThrowError(
        expect.objectContaining<Partial<TravelsTypeError>>({
          code: 'UNCLONEABLE_PATCH_VALUE',
        })
      );
      expect(journal.getState()).toBe(initialState);
      expect(journal.getPosition()).toBe(0);
      expect(journal.getHistoryEntries()).toEqual([]);
    }
  });

  test('preserves aliases within a detached controlled patch group', () => {
    type AliasState = {
      left: { id: number } | null;
      right: { id: number } | null;
    };
    const shared = { id: 1 };
    let authoritativeState: AliasState = { left: shared, right: shared };
    const observedValues: unknown[][] = [];
    const journal = createTravelJournal(authoritativeState, {
      warnOnUnsupportedState: false,
      apply: ({ patches }) => {
        observedValues.push(
          patches.map((patch) => (patch as { value?: unknown }).value)
        );
        authoritativeState = apply(authoritativeState, patches);
        return authoritativeState;
      },
    });
    journal.recordPatches(authoritativeState, {
      patches: [
        { op: 'replace', path: ['left'], value: shared },
        { op: 'replace', path: ['right'], value: shared },
      ],
      inversePatches: [
        { op: 'replace', path: ['right'], value: null },
        { op: 'replace', path: ['left'], value: null },
      ],
    });

    journal.back();
    journal.forward();

    // The guarantee under test is the shape of the patch group handed to the
    // external owner: repeated references inside one group stay aliased and
    // detached from the caller's object. How the owner's own apply()
    // reconstructs state from those operations is outside Travels' control.
    const forwardValues = observedValues[observedValues.length - 1];
    expect(forwardValues).toHaveLength(2);
    expect(forwardValues[0]).toBe(forwardValues[1]);
    expect(forwardValues[0]).not.toBe(shared);
    expect(forwardValues[0]).toEqual(shared);
    expect(authoritativeState.left).not.toBe(shared);
  });

  test('rejects controlled initial history with uncloneable values', () => {
    const value = () => 'behavior';

    expect(() =>
      createTravelJournal(
        { count: 1, label: 'initial', value },
        {
          apply: ({ state }) => state,
          initialPatches: {
            patches: [[{ op: 'add', path: ['value'], value }]],
            inversePatches: [[{ op: 'remove', path: ['value'] }]],
          },
          initialPosition: 1,
          warnOnUnsupportedState: false,
        }
      )
    ).toThrowError(
      expect.objectContaining<Partial<TravelsTypeError>>({
        code: 'UNCLONEABLE_PATCH_VALUE',
      })
    );
  });

  test('isolates retained history from controlled apply patch mutation', () => {
    let authoritativeState: State = { count: 0, label: 'initial' };
    const journal = createTravelJournal(authoritativeState, {
      apply: ({ patches, inversePatches }) => {
        authoritativeState = apply(authoritativeState, patches);
        patches[0].op = 'remove';
        patches[0].path[0] = 'label';
        (patches[0] as { value?: unknown }).value = 999;
        inversePatches[0].op = 'remove';
        inversePatches[0].path[0] = 'label';
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

    journal.back();
    expect(authoritativeState).toEqual({ count: 0, label: 'initial' });
    journal.forward();
    expect(authoritativeState).toEqual({ count: 1, label: 'initial' });
    expect(journal.getHistoryEntries()[0].patches).toEqual([
      { op: 'replace', path: ['count'], value: 1 },
    ]);
  });

  test('isolates nested retained patch values from controlled apply mutation', () => {
    type NestedState = { item: { count: number } };
    let authoritativeState: NestedState = { item: { count: 0 } };
    const journal = createTravelJournal(authoritativeState, {
      apply: ({ patches }) => {
        authoritativeState = apply(authoritativeState, patches);
        const value = (patches[0] as { value?: { count?: number } }).value;
        if (value) value.count = 999;
        return authoritativeState;
      },
    });
    const [nextState, patches, inversePatches] = create(
      authoritativeState,
      (draft) => {
        draft.item = { count: 1 };
      },
      { enablePatches: true }
    ) as [NestedState, Patches, Patches];
    authoritativeState = nextState;
    journal.recordPatches(authoritativeState, { patches, inversePatches });

    journal.back();
    journal.forward();
    expect(authoritativeState).toEqual({ item: { count: 1 } });
    expect(
      (journal.getHistoryEntries()[0].patches[0] as { value?: unknown }).value
    ).toEqual({ count: 1 });
  });

  test('reads controlled entry metadata only once before committing state', () => {
    const journal = createTravelJournal(
      { count: 0 },
      {
        apply({ state, patches }) {
          return apply(state, patches);
        },
      }
    );
    let metadataReads = 0;
    const entry = {
      patches: [{ op: 'replace', path: ['count'], value: 1 }],
      inversePatches: [{ op: 'replace', path: ['count'], value: 0 }],
    } as TravelHistoryEntry;
    Object.defineProperty(entry, 'metadata', {
      enumerable: true,
      get() {
        metadataReads += 1;
        if (metadataReads > 1) {
          throw new Error('metadata was read more than once');
        }
        return { label: 'increment' };
      },
    });

    expect(() => journal.recordPatches({ count: 1 }, entry)).not.toThrow();
    expect(metadataReads).toBe(1);
    expect(journal.getState()).toEqual({ count: 1 });
    expect(journal.getHistoryEntries()[0].metadata).toEqual({
      label: 'increment',
    });
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

  test('rejects malformed controlled patch entries without evaluating accessors', () => {
    const initialState: State = { count: 0, label: 'initial' };
    const journal = createTravelJournal(initialState, {
      apply: ({ state }) => state,
    });
    const validInverse = [
      { op: 'replace', path: ['count'], value: 0 },
    ] as Patches;
    const invalidEntries: unknown[] = [
      {
        patches: [{ op: 'move', path: ['count'], value: 1 }],
        inversePatches: validInverse,
      },
      {
        patches: [{ op: 'replace', path: ['count'] }],
        inversePatches: validInverse,
      },
      {
        patches: [{ op: 'add', path: '', value: 1 }],
        inversePatches: validInverse,
      },
      {
        patches: [{ op: 'replace', path: ['__proto__'], value: 1 }],
        inversePatches: validInverse,
      },
      {
        patches: new Array(1),
        inversePatches: validInverse,
      },
      {
        patches: [{ op: 'replace', path: ['count'], value: 1 }],
        inversePatches: [],
      },
    ];

    const customPath = ['count'] as string[] & { extra?: boolean };
    customPath.extra = true;
    invalidEntries.push({
      patches: [{ op: 'replace', path: customPath, value: 1 }],
      inversePatches: validInverse,
    });

    const accessorOperation = {};
    const opGetter = vi.fn(() => 'replace');
    Object.defineProperties(accessorOperation, {
      op: { enumerable: true, get: opGetter },
      path: { enumerable: true, value: ['count'] },
      value: { enumerable: true, value: 1 },
    });
    invalidEntries.push({
      patches: [accessorOperation],
      inversePatches: validInverse,
    });

    for (const entry of invalidEntries) {
      expect(() =>
        journal.recordPatches(
          { count: 1, label: 'initial' },
          entry as { patches: Patches; inversePatches: Patches }
        )
      ).toThrow('invalid patch entry');
      expect(journal.getState()).toBe(initialState);
      expect(journal.getPosition()).toBe(0);
      expect(journal.getHistoryEntries()).toEqual([]);
    }
    expect(opGetter).not.toHaveBeenCalled();
  });

  test('rejects accessor-backed controlled entry fields without evaluating them', () => {
    const initialState: State = { count: 0, label: 'initial' };
    const journal = createTravelJournal(initialState, {
      apply: ({ state }) => state,
    });
    const patchesGetter = vi.fn(() => [
      { op: 'replace', path: ['count'], value: 1 },
    ]);
    const entry = {};
    Object.defineProperties(entry, {
      patches: { enumerable: true, get: patchesGetter },
      inversePatches: {
        enumerable: true,
        value: [{ op: 'replace', path: ['count'], value: 0 }],
      },
    });

    expect(() =>
      journal.recordPatches(
        { count: 1, label: 'initial' },
        entry as { patches: Patches; inversePatches: Patches }
      )
    ).toThrow('invalid patch entry');
    expect(patchesGetter).not.toHaveBeenCalled();
    expect(journal.getState()).toBe(initialState);
  });

  test('rejects unsupported collection values in externally committed state', () => {
    const initialState: State = { count: 0, label: 'initial' };
    const journal = createTravelJournal(initialState, {
      apply: ({ state }) => state,
    });
    const [nextState, patches, inversePatches] = produceCommit(
      initialState,
      (draft) => {
        draft.count = 1;
      }
    );
    const unsupportedState = {
      ...nextState,
      hiddenCollection: new Map([['count', 1]]),
    } as unknown as State;

    expect(() =>
      journal.recordPatches(unsupportedState, { patches, inversePatches })
    ).toThrow('Map and Set are not supported');
    expect(journal.getState()).toBe(initialState);
    expect(journal.getPosition()).toBe(0);
    expect(journal.getHistoryEntries()).toEqual([]);
  });

  test('rejects unsupported state returned by controlled apply atomically', () => {
    const initialState: State = { count: 0, label: 'initial' };
    let authoritativeState = initialState;
    const journal = createTravelJournal(initialState, {
      apply: ({ patches }) => {
        authoritativeState = apply(authoritativeState, patches);
        return {
          ...authoritativeState,
          hiddenCollection: new Set([1]),
        } as unknown as State;
      },
    });
    const [nextState, patches, inversePatches] = produceCommit(
      initialState,
      (draft) => {
        draft.count = 1;
      }
    );
    authoritativeState = nextState;
    journal.recordPatches(authoritativeState, { patches, inversePatches });

    expect(() => journal.back()).toThrow('Map and Set are not supported');
    expect(journal.getState()).toBe(nextState);
    expect(journal.getPosition()).toBe(1);
    expect(journal.getHistoryEntries()).toHaveLength(1);
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
    ).toThrow('cannot be safely detached');
  });
});

describe('controlled journal state validation boundaries', () => {
  // The per-transition state scan is a development diagnostic, so the checks
  // that keep history and persistence sound must not depend on it.
  test('durable exits reject a smuggled collection on their own', () => {
    type SmuggledState = { count: number; hidden?: Set<number> };
    let authoritative: SmuggledState = { count: 0 };
    const journal = createTravelJournal<SmuggledState>(authoritative, {
      warnOnUnsupportedState: false,
      apply: ({ patches }) => {
        authoritative = apply(authoritative, patches) as SmuggledState;
        return authoritative;
      },
    });
    journal.recordPatches(
      { count: 1 },
      {
        patches: [{ op: 'replace', path: ['count'], value: 1 }],
        inversePatches: [{ op: 'replace', path: ['count'], value: 0 }],
      }
    );

    // Reach past every commit-time check the way a misbehaving owner would.
    (journal.getState() as SmuggledState).hidden = new Set([1]);

    expect(() => journal.serialize()).toThrow(
      'Map and Set are not supported in state'
    );
    expect(() => journal.getHistorySnapshot()).toThrow(
      'cannot detach non-durable history'
    );

    // Retained history never absorbed it: controlled entries only ever hold
    // the patch values Travels validated.
    expect(JSON.stringify(journal.getPatches())).not.toContain('hidden');
  });

  test('patch values stay validated independently of the state scan', () => {
    const journal = createTravelJournal<{ value: unknown }>(
      { value: null },
      { warnOnUnsupportedState: false, apply: ({ state }) => state }
    );

    expect(() =>
      journal.recordPatches(
        { value: null },
        {
          patches: [
            { op: 'replace', path: ['value'], value: new Set([1]) },
          ],
          inversePatches: [{ op: 'replace', path: ['value'], value: null }],
        }
      )
    ).toThrow('cannot be safely detached');
  });
});
