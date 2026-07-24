import { describe, expectTypeOf, test } from 'vitest';
import {
  createPatchableTravels,
  createTravelJournal,
  createTravels,
  Travels,
  type JsonValue,
  type PatchableState,
  type StateCompatibilityIssueCode,
  type TravelJournal,
  type TravelMetadata,
  type TravelsControlledTransition,
  type TravelsDevtoolsEvent,
  type TravelsEvent,
  type TravelsEventType,
  type TravelsSerializedHistory,
  type Updater,
} from '../src/index';

describe('Type-level API contracts', () => {
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
      ): TravelsSerializedHistory<State> |
        Promise<TravelsSerializedHistory<State>> => snapshot;
      Travels.deserialize<State>(snapshot, {
        // @ts-expect-error Promise unions must also be rejected
        migrate: maybeAsyncMigration,
      });
    }

    createTravels(history.state, { history });
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
    expectTypeOf<Extract<StateCompatibilityIssueCode, 'PATCH_PATH'>>()
      .toEqualTypeOf<never>();
    expectTypeOf<
      Extract<
        StateCompatibilityIssueCode,
        'MAP_SET_MUTABLE' | 'MAP_SET_PERSISTENCE'
      >
    >().toEqualTypeOf<never>();
  });

  test('controls expose history as read-only', () => {
    const controls = createTravels({ count: 0 }).getControls();

    expectTypeOf(controls.getHistory()).toEqualTypeOf<
      readonly { count: number }[]
    >();

    if (false) {
      // @ts-expect-error history snapshots are shared read-only cache entries
      controls.getHistory().push({ count: 1 });
    }
  });

  test('manual controls archive accepts metadata', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });

    expectTypeOf(travels.getControls().archive)
      .parameter(0)
      .toEqualTypeOf<TravelMetadata | undefined>();
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
    });
    createTravels<State>(
      { count: 0 },
      {
        devtools(event) {
          expectTypeOf(event).toEqualTypeOf<TravelsDevtoolsEvent<State>>();
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

    if (false) {
      // @ts-expect-error the external runtime owns state changes
      journal.setState({ count: 1 });
      // @ts-expect-error reset would bypass the external runtime
      journal.reset();
      // @ts-expect-error replacement must go through the external runtime
      journal.replaceStateWithoutHistory({ count: 1 });
      // @ts-expect-error standard controls expose reset
      journal.getControls();
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

      // @ts-expect-error transactions must be synchronous
      travels.transaction(async () => {
        travels.setState((draft) => {
          draft.count = 1;
        });
      });

      const maybeAsyncUpdater = (
        draft: State
      ): void | Promise<void> => {
        draft.count = 2;
      };
      // @ts-expect-error Promise unions must also be rejected
      travels.setState(maybeAsyncUpdater);

      const maybeAsyncTransaction = (): void | Promise<void> => undefined;
      // @ts-expect-error Promise unions must also be rejected
      travels.transaction(maybeAsyncTransaction);
    }
  });
});
