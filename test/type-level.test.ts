import { describe, expectTypeOf, test } from 'vitest';
import {
  createTravels,
  Travels,
  type JsonValue,
  type PatchableState,
  type TravelMetadata,
  type TravelsSerializedHistory,
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
});
