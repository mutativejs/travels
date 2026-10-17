import { describe, expect, test } from 'vitest';
import { createTravels, restoreTravels, Travels } from '../src/index';

// Mutative 1.x recorded these updates with patches that could not undo them,
// which is why Travels requires Mutative 2.
type State = { list: Array<number | undefined> };

const signed = (value: unknown) =>
  JSON.stringify(value, (_key, item) => (Object.is(item, -0) ? '-0' : item));

describe.each([false, true])('undo after replay (mutable: %s)', (mutable) => {
  const roundTrip = (initialState: State, recipe: (draft: State) => void) => {
    const before = signed(initialState);
    const travels = createTravels<State>(structuredClone(initialState), {
      mutable,
      warnOnUnsupportedState: false,
    });
    travels.setState((draft) => {
      recipe(draft);
    });
    const after = signed(travels.getState());

    travels.back();
    expect(signed(travels.getState())).toBe(before);
    travels.forward();
    expect(signed(travels.getState())).toBe(after);

    const restored = restoreTravels(
      Travels.deserialize<State>(travels.serialize(), {
        validation: 'semantic',
      }),
      { mutable, warnOnUnsupportedState: false }
    );
    restored.back();
    expect(signed(restored.getState())).toBe(before);
  };

  test('restores an array shortened and lengthened again', () => {
    roundTrip({ list: [1, 2, 3, 4] }, (draft) => {
      draft.list.length = 1;
      draft.list.length = 3;
    });
  });

  test('restores 0 after an element changed to -0', () => {
    roundTrip({ list: [0, 1] }, (draft) => {
      draft.list[0] = -0;
    });
  });
});
