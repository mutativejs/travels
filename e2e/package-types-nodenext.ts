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
