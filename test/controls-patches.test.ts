import { describe, expect, test, vi } from 'vitest';
import { createTravels } from '../src/index';

describe('controls.patches view', () => {
  test('keeps one frozen reference until history changes', () => {
    const travels = createTravels({ items: [] as number[] });
    const controls = travels.getControls();
    travels.setState((draft) => {
      draft.items.push(1);
    });

    const view = controls.patches;
    expect(controls.patches).toBe(view);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.patches)).toBe(true);
    expect(Object.isFrozen(view.patches[0])).toBe(true);
    expect(Object.isFrozen(view.patches[0][0])).toBe(true);
    expect(view).toEqual(travels.getPatches());

    travels.setState((draft) => {
      draft.items.push(2);
    });
    expect(controls.patches).not.toBe(view);
    expect(controls.patches.patches).toHaveLength(2);

    travels.back();
    const afterBack = controls.patches;
    expect(afterBack).toEqual(travels.getPatches());
    travels.reset();
    expect(controls.patches).not.toBe(afterBack);
    expect(controls.patches.patches).toHaveLength(0);
  });

  test('clones history once per change rather than once per read', () => {
    const travels = createTravels({ count: 0 });
    const controls = travels.getControls();
    travels.setState({ count: 1 });
    const getPatches = vi.spyOn(travels, 'getPatches');

    for (let index = 0; index < 10; index += 1) {
      void controls.patches;
    }

    expect(getPatches).toHaveBeenCalledTimes(1);
  });

  test('does not let view mutation reach retained history', () => {
    const travels = createTravels({ nested: { count: 0 } });
    travels.setState((draft) => {
      draft.nested = { count: 1 };
    });
    const view = travels.getControls().patches;
    const value = view.patches[0][0].value as { count: number };

    value.count = 99;

    expect(travels.getPatches().patches[0][0]).toMatchObject({
      value: { count: 1 },
    });
    travels.back();
    travels.forward();
    expect(travels.getState()).toEqual({ nested: { count: 1 } });
  });

  test('includes pending manual work and follows transactions', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });
    const controls = travels.getControls();

    travels.setState({ count: 1 });
    expect(controls.patches.patches).toHaveLength(1);
    travels.archive();
    const archived = controls.patches;
    expect(archived.patches).toHaveLength(1);

    expect(() =>
      travels.transaction(() => {
        travels.setState({ count: 2 });
        expect(controls.patches.patches).toHaveLength(2);
        throw new Error('rollback');
      })
    ).toThrow();
    expect(controls.patches).toEqual(archived);
    expect(controls.patches.patches).toHaveLength(1);
  });
});
