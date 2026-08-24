/* eslint-disable no-constant-condition -- compile-time-only assertions */
import {
  createTravels,
  Travels,
  type ReadonlyTravelPatches,
  type TravelsSerializedHistory,
} from 'travels';

type State = { count: number };

const travels = createTravels<State>({ count: 0 });
const snapshot: TravelsSerializedHistory<State> = travels.serialize();
const restored = Travels.deserialize<State>(snapshot);
const controls = travels.getControls();
const sharedHistory: readonly State[] = controls.getHistory();
const mutableHistory: State[] = controls.getHistorySnapshot();
void sharedHistory;
void mutableHistory;

travels.subscribe((event) => {
  const patchView: ReadonlyTravelPatches = event.patches;
  void patchView;

  if (false) {
    // @ts-expect-error observer patch group lists are read-only
    event.patches.patches.push([]);
    // @ts-expect-error observer patch groups are read-only
    event.patches.patches[0].push({ op: 'remove', path: ['count'] });
  }
});

travels.setState((draft) => {
  draft.count = restored.state.count + 1;
});

if (false) {
  // @ts-expect-error shared history is not a caller-owned mutable array
  const mutableSharedHistory: State[] = controls.getHistory();
  void mutableSharedHistory;
  // @ts-expect-error controls are a read-only capability object
  controls.position = 1;
  // @ts-expect-error controls methods cannot be replaced
  controls.back = () => undefined;
  // @ts-expect-error state-owned instances do not accept external patch commits
  travels.recordPatches({ count: 1 }, { patches: [], inversePatches: [] });
  // @ts-expect-error Travels exposes persistence helpers, not a constructor
  new Travels({ count: 0 });
}
