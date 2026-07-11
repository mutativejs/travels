import { describe, expectTypeOf, test } from 'vitest';
import {
  createTravels,
  Travels,
  type JsonValue,
  type PatchableState,
  type TravelMetadata,
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

    expectTypeOf(snapshot).toEqualTypeOf<TravelsSerializedHistory<State>>();

    const history = Travels.deserialize<State>(snapshot);
    expectTypeOf(history.state).toEqualTypeOf<State>();

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
    expectTypeOf(travels.getState().blocks[0].text).toEqualTypeOf<string>();
  });

  test('manual controls archive accepts metadata', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });

    expectTypeOf(travels.getControls().archive)
      .parameter(0)
      .toEqualTypeOf<TravelMetadata | undefined>();
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
