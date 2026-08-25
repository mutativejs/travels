/* eslint-disable no-constant-condition -- `if (false)` blocks hold
   compile-time-only assertions that must never execute at runtime. */
import { describe, expectTypeOf, test } from 'vitest';
import {
  createPatchableTravels,
  createTravelJournal,
  createTravels,
  restoreTravels,
  Travels,
  type JsonValue,
  type PatchableState,
  type ReadonlyState,
  type ReadonlyTravelPatches,
  type StateCompatibilityIssueCode,
  type TravelJournal,
  type TravelMetadata,
  type TravelsControlledTransition,
  type TravelsEvent,
  type TravelsEventType,
  type TravelsOptions,
  type TravelsSerializedHistory,
  type Updater,
} from '../src/index';

describe('Type-level API contracts', () => {
  test('manual archive capabilities follow archive mode', () => {
    const automaticTravels = createTravels({ count: 0 });
    if (false) {
      // @ts-expect-error automatic timelines do not expose manual archive controls
      automaticTravels.archive();
      // @ts-expect-error automatic timelines do not expose manual archive controls
      automaticTravels.canArchive();
    }

    const manualTravels = createTravels(
      { count: 0 },
      { autoArchive: false as const }
    );
    manualTravels.archive();
    expectTypeOf(manualTravels.canArchive()).toEqualTypeOf<boolean>();

    const automaticPatchable = createPatchableTravels({ count: 0 });
    const manualPatchable = createPatchableTravels(
      { count: 0 },
      { autoArchive: false as const }
    );
    const automaticRestored = restoreTravels(automaticTravels.serialize());
    const manualRestored = restoreTravels(automaticTravels.serialize(), {
      autoArchive: false as const,
    });
    manualPatchable.archive();
    manualRestored.archive();

    if (false) {
      // @ts-expect-error automatic patchable timelines omit manual capabilities
      automaticPatchable.archive();
      // @ts-expect-error automatic restored timelines omit manual capabilities
      automaticRestored.archive();
    }

    const automatic = createTravelJournal(
      { count: 0 },
      { apply: ({ state }) => state }
    );
    automatic.reset();
    if (false) {
      // @ts-expect-error automatic journals do not expose manual archive controls
      automatic.archive();
    }

    const manual = createTravelJournal(
      { count: 0 },
      { autoArchive: false as const, apply: ({ state }) => state }
    );
    manual.archive();
    expectTypeOf(manual.canArchive()).toEqualTypeOf<boolean>();
  });

  test('serialize and deserialize preserve generic state shape', () => {
    type State = {
      title: string;
      blocks: Array<{ id: string; text: string }>;
    };

    const travels = createTravels<State>({ title: 'Draft', blocks: [] });
    const snapshot = travels.serialize();
    travels.serialize({ strict: true });
    travels.assertPersistenceCompatible();

    expectTypeOf(snapshot).toEqualTypeOf<TravelsSerializedHistory<State>>();

    const history = Travels.deserialize<State>(snapshot);
    expectTypeOf(history.state).toEqualTypeOf<State>();

    Travels.deserialize<State>(snapshot, { validation: 'structural' });
    Travels.deserialize<State>(snapshot, { validation: 'semantic' });
    if (false) {
      // @ts-expect-error state-owned instances do not expose journal commits
      travels.recordPatches(
        { title: 'Draft', blocks: [] },
        {
          patches: [],
          inversePatches: [],
        }
      );
      // @ts-expect-error Travels is a persistence namespace, not a constructor
      new Travels({ title: 'Draft', blocks: [] });
      // @ts-expect-error validation modes are a closed public contract
      Travels.deserialize<State>(snapshot, { validation: 'unknown' });
      Travels.deserialize<State>(snapshot, {
        // @ts-expect-error auto-freeze is an instance output policy, not replay behavior
        replayOptions: { enableAutoFreeze: true },
      });
      Travels.deserialize<State>(snapshot, {
        // @ts-expect-error migration callbacks must return synchronously
        migrate: async () => snapshot,
      });
      Travels.deserialize<State>('invalid', {
        // @ts-expect-error function fallbacks must return synchronously
        fallback: async () => snapshot,
      });

      const maybeAsyncMigration = (
        _input: unknown
      ):
        | TravelsSerializedHistory<State>
        | Promise<TravelsSerializedHistory<State>> => snapshot;
      Travels.deserialize<State>(snapshot, {
        // @ts-expect-error Promise unions must also be rejected
        migrate: maybeAsyncMigration,
      });
      // @ts-expect-error restore state and history can no longer diverge
      createTravels(history.state, { history });
    }

    restoreTravels(history);
  });

  test('JsonValue and PatchableState constrain reusable helpers', () => {
    const jsonState = {
      title: 'Draft',
      blocks: [{ id: '1', text: 'Hello' }],
    } satisfies JsonValue;

    const createJsonHistory = <S extends PatchableState>(state: S) =>
      createTravels(state);

    const travels = createJsonHistory(jsonState);
    const patchableTravels = createPatchableTravels(jsonState);
    interface DocumentState {
      title: string;
      blocks: Array<{ id: string; text: string }>;
    }
    const interfaceState: DocumentState = jsonState;
    const interfaceTravels = createPatchableTravels(interfaceState);
    interface TreeNode {
      value: string;
      children: TreeNode[];
    }
    const recursiveState: TreeNode = { value: 'root', children: [] };
    const recursiveTravels = createPatchableTravels(recursiveState);
    expectTypeOf(recursiveTravels.getState()).toEqualTypeOf<TreeNode>();
    expectTypeOf(interfaceTravels.getState()).toEqualTypeOf<DocumentState>();
    expectTypeOf(travels.getState().blocks[0].text).toEqualTypeOf<string>();
    expectTypeOf(patchableTravels.getState()).toEqualTypeOf<typeof jsonState>();

    if (false) {
      // @ts-expect-error Map is outside the supported state contract
      createJsonHistory(new Map([['count', 1]]));
      // @ts-expect-error Set is outside the supported state contract
      createJsonHistory(new Set(['selected']));
      // @ts-expect-error the strict factory excludes runtime-only state
      createPatchableTravels({ createdAt: new Date() });
      const broadObject: object = { title: 'not statically inspectable' };
      // @ts-expect-error broad object types are not a durable-state proof
      createPatchableTravels(broadObject);
      const unknownState: unknown = jsonState;
      // @ts-expect-error unknown state must be narrowed before using the strict factory
      createPatchableTravels(unknownState);
      const anyState: any = jsonState;
      // @ts-expect-error any state bypasses the static durable-state contract
      createPatchableTravels(anyState);
    }
  });

  test('state compatibility issue codes match scanner output', () => {
    expectTypeOf<
      Extract<StateCompatibilityIssueCode, 'PATCH_PATH'>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<
        StateCompatibilityIssueCode,
        'MAP_SET_MUTABLE' | 'MAP_SET_PERSISTENCE'
      >
    >().toEqualTypeOf<never>();
  });

  test('controls expose read-only shared views and mutable snapshots', () => {
    const controls = createTravels({ count: 0 }).getControls();

    expectTypeOf(controls.getHistory()).toEqualTypeOf<
      readonly ReadonlyState<{ count: number }>[]
    >();

    // getHistorySnapshot() is the array callers may actually keep or change.
    expectTypeOf(controls.getHistorySnapshot()).toEqualTypeOf<
      { count: number }[]
    >();

    if (false) {
      // @ts-expect-error shared history is not a mutable caller-owned array
      controls.getHistory().push({ count: 1 });
      // @ts-expect-error controls are a stable read-only capability object
      controls.position = 1;
      // @ts-expect-error controls are a stable read-only capability object
      controls.patches = { patches: [], inversePatches: [] };
      // @ts-expect-error controls methods cannot be replaced
      controls.back = () => undefined;
    }
  });

  test('the instance history method stays read-only', () => {
    const travels = createTravels({ nested: { count: 0 } });

    expectTypeOf(travels.getHistory()).toEqualTypeOf<
      readonly ReadonlyState<{ nested: { count: number } }>[]
    >();

    if (false) {
      // @ts-expect-error shared state entries are read-only as well as the array
      travels.getHistory()[0].nested.count = 1;
    }
  });

  test('auto-freeze does not make detached snapshots read-only', () => {
    const travels = createTravels(
      { nested: { count: 0 } },
      { enableAutoFreeze: true }
    );

    expectTypeOf(travels.getState()).toEqualTypeOf<{
      nested: { count: number };
    }>();
    expectTypeOf(travels.getHistorySnapshot()).toEqualTypeOf<
      { nested: { count: number } }[]
    >();
    expectTypeOf(travels.getControls().getHistorySnapshot()).toEqualTypeOf<
      { nested: { count: number } }[]
    >();

    if (false) {
      travels.getHistorySnapshot()[0].nested.count = 1;
      travels.getControls().getHistorySnapshot()[0].nested.count = 1;
      // @ts-expect-error shared entries stay read-only independently of auto-freeze
      travels.getControls().getHistory()[0].nested.count = 1;
    }
  });

  test('manual controls archive accepts metadata', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });

    expectTypeOf(travels.getControls().archive)
      .parameter(0)
      .toEqualTypeOf<TravelMetadata | undefined>();
  });

  test('factory overloads accept dynamic and generic archive modes', () => {
    const dynamicMode = true as boolean;
    const travels = createTravels({ count: 0 }, { autoArchive: dynamicMode });
    const patchableTravels = createPatchableTravels(
      { count: 0 },
      { autoArchive: dynamicMode }
    );
    const forwardOptions = <A extends boolean>(
      options: TravelsOptions<false, A>
    ) => createTravels({ count: 0 }, options);

    expectTypeOf(travels).toEqualTypeOf<
      Travels<{ count: number }, false, boolean>
    >();
    expectTypeOf(patchableTravels).toEqualTypeOf<
      Travels<{ count: number }, false, boolean>
    >();
    expectTypeOf(forwardOptions({ autoArchive: dynamicMode })).toEqualTypeOf<
      Travels<{ count: number }, false, boolean>
    >();
  });

  test('event type remains open to future minor-release operations', () => {
    const acceptEventType = (_type: TravelsEventType) => undefined;

    acceptEventType('setState');
    acceptEventType('futureOperation');
  });

  test('subscribe and devtools share one event contract', () => {
    type State = { count: number };
    const travels = createTravels<State>({ count: 0 });

    travels.subscribe((event) => {
      expectTypeOf(event).toEqualTypeOf<TravelsEvent<State>>();
      expectTypeOf(event.state).toEqualTypeOf<ReadonlyState<State>>();
      expectTypeOf(event.patches).toEqualTypeOf<ReadonlyTravelPatches>();

      if (false) {
        // @ts-expect-error event state is a borrowed read-only view
        event.state.count = 1;
        // @ts-expect-error event patch groups are shared read-only views
        event.patches.patches.push([]);
        // @ts-expect-error individual event patch groups are read-only
        event.patches.patches[0].push({ op: 'remove', path: ['count'] });
        // @ts-expect-error event patch operations are read-only
        event.patches.patches[0][0].op = 'add';
        // @ts-expect-error array patch paths are read-only
        event.patches.patches[0][0].path.push('nested');
        if (event.metadata) {
          // @ts-expect-error event metadata is a shared read-only view
          event.metadata.label = 'changed';
        }
      }
    });
    createTravels<State>(
      { count: 0 },
      {
        devtools(event) {
          expectTypeOf(event).toEqualTypeOf<TravelsEvent<State>>();
        },
      }
    );

    if (false) {
      // @ts-expect-error positional subscribe callbacks were replaced by TravelsEvent
      travels.subscribe((_state, _patches, _position, _historyLength) => {});
    }
  });

  test('controlled journals expose only external-owner-safe operations', () => {
    type State = { count: number };
    const journal = createTravelJournal<State>(
      { count: 0 },
      {
        apply(transition) {
          expectTypeOf(transition).toEqualTypeOf<
            TravelsControlledTransition<State>
          >();
          return transition.state;
        },
      }
    );

    expectTypeOf(journal).toEqualTypeOf<TravelJournal<State>>();
    expectTypeOf(journal.recordPatches).parameter(0).toEqualTypeOf<State>();
    expectTypeOf(journal.reset).toEqualTypeOf<() => void>();

    if (false) {
      // @ts-expect-error the external runtime owns state changes
      journal.setState({ count: 1 });
      // @ts-expect-error replacement must go through the external runtime
      journal.replaceStateWithoutHistory({ count: 1 });
      // @ts-expect-error standard controls expose reset
      journal.getControls();
      // @ts-expect-error journal capabilities cannot be replaced
      journal.back = () => undefined;
      // @ts-expect-error journal ingress cannot be replaced
      journal.recordPatches = () => undefined;
      // @ts-expect-error controlledApply is reserved for createTravelJournal
      createTravels(
        { count: 0 },
        { controlledApply: (transition) => transition.state }
      );
      createTravelJournal(
        { count: 0 },
        {
          // @ts-expect-error controlled application must return synchronously
          apply: async (transition) => transition.state,
        }
      );
    }
  });

  test('async callbacks are rejected while typed updaters remain forwardable', () => {
    type State = { count: number };
    const travels = createTravels<State>({ count: 0 });
    const update = (updater: Updater<State>) => travels.setState(updater);

    update((draft) => {
      draft.count = 1;
    });
    expectTypeOf(update).parameter(0).toEqualTypeOf<Updater<State>>();

    if (false) {
      // @ts-expect-error state callbacks must be synchronous
      travels.setState(async (draft) => {
        draft.count = 1;
      });

      // @ts-expect-error history-free state callbacks must be synchronous
      travels.replaceStateWithoutHistory(async (draft) => {
        draft.count = 1;
      });

      // @ts-expect-error transactions must be synchronous
      travels.transaction(async () => {
        travels.setState((draft) => {
          draft.count = 1;
        });
      });

      const maybeAsyncUpdater = (draft: State): void | Promise<void> => {
        draft.count = 2;
      };
      // @ts-expect-error Promise unions must also be rejected
      travels.setState(maybeAsyncUpdater);
      // @ts-expect-error Promise unions must also be rejected for history-free updates
      travels.replaceStateWithoutHistory(maybeAsyncUpdater);

      const maybeAsyncTransaction = (): void | Promise<void> => undefined;
      // @ts-expect-error Promise unions must also be rejected
      travels.transaction(maybeAsyncTransaction);
    }
  });
});
