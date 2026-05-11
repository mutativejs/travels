import { describe, expect, test } from 'vitest';
import { useTravelsHistory } from '../examples/vue';

describe('Vue integration example', () => {
  test('updates canUndo and canRedo refs after history navigation', () => {
    const history = useTravelsHistory(
      { count: 0 },
      { warnOnUnsupportedState: false }
    );

    expect(history.position.value).toBe(0);
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);

    history.setState((draft) => {
      draft.count = 1;
    });

    expect(history.position.value).toBe(1);
    expect(history.canUndo.value).toBe(true);
    expect(history.canRedo.value).toBe(false);

    history.undo();

    expect(history.position.value).toBe(0);
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(true);

    history.redo();

    expect(history.position.value).toBe(1);
    expect(history.canUndo.value).toBe(true);
    expect(history.canRedo.value).toBe(false);
  });
});
