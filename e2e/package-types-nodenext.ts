/* eslint-disable no-constant-condition -- compile-time-only assertions */
import {
  createTravels,
  Travels,
  type TravelsSerializedHistory,
} from 'travels';

type State = { count: number };

const travels = createTravels<State>({ count: 0 });
const snapshot: TravelsSerializedHistory<State> = travels.serialize();
const restored = Travels.deserialize<State>(snapshot);

travels.setState((draft) => {
  draft.count = restored.state.count + 1;
});

if (false) {
  // @ts-expect-error state-owned instances do not accept external patch commits
  travels.recordPatches({ count: 1 }, { patches: [], inversePatches: [] });
  // @ts-expect-error Travels exposes persistence helpers, not a constructor
  new Travels({ count: 0 });
}
