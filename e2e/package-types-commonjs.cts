// A CommonJS consumer compiled with module: node16 resolves the `require`
// condition and cannot import declarations that TypeScript reads as ES modules.
import {
  createTravels,
  restoreTravels,
  Travels,
  type ReadonlyState,
  type TravelsSerializedHistory,
} from 'travels';

type State = { count: number };

const travels = createTravels<State>({ count: 0 });
const snapshot: TravelsSerializedHistory<State> = travels.serialize();
const restored = restoreTravels(Travels.deserialize<State>(snapshot));
const history: readonly ReadonlyState<State>[] = restored.getHistory();
void history;
