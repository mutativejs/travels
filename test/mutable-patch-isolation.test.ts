import { describe, expect, test, vi } from 'vitest';
import { createTravels, type ReadonlyTravelPatches } from '../src/index';

type State = { item?: { value: number } };

const expectOriginalInverseValue = (patches: ReadonlyTravelPatches): void => {
  expect(patches.inversePatches).toEqual([
    [{ op: 'add', path: ['item'], value: { value: 1 } }],
  ]);
};

describe('mutable patch isolation', () => {
  test('does not clone primitive-only patch groups', () => {
    const travels = createTravels(
      { value: 0 },
      { mutable: true, warnOnUnsupportedState: false }
    );
    const structuredClone = vi.spyOn(globalThis, 'structuredClone');

    travels.setState((draft) => {
      draft.value = 1;
    });

    expect(structuredClone).not.toHaveBeenCalled();
    structuredClone.mockRestore();
  });

  test('detaches archived inverse values from removed live objects', () => {
    const state: State = { item: { value: 1 } };
    const removed = state.item!;
    const travels = createTravels(state, {
      mutable: true,
      warnOnUnsupportedState: false,
    });

    travels.setState((draft) => {
      delete draft.item;
    });
    removed.value = 9;

    expectOriginalInverseValue(travels.getPatches());
    travels.back();
    expect(travels.getState()).toEqual({ item: { value: 1 } });
  });

  test('detaches manual archive history from removed live objects', () => {
    const state: State = { item: { value: 1 } };
    const removed = state.item!;
    const travels = createTravels(state, {
      autoArchive: false,
      mutable: true,
      warnOnUnsupportedState: false,
    });

    travels.setState((draft) => {
      delete draft.item;
    });
    removed.value = 9;
    travels.archive();

    expectOriginalInverseValue(travels.getPatches());
    travels.back();
    expect(travels.getState()).toEqual({ item: { value: 1 } });
  });

  test('detaches transaction history from removed live objects', () => {
    const state: State = { item: { value: 1 } };
    const removed = state.item!;
    const travels = createTravels(state, {
      mutable: true,
      warnOnUnsupportedState: false,
    });

    travels.transaction(() => {
      travels.setState((draft) => {
        delete draft.item;
      });
    });
    removed.value = 9;

    expectOriginalInverseValue(travels.getPatches());
    travels.back();
    expect(travels.getState()).toEqual({ item: { value: 1 } });
  });

  test('keeps history replayed across a root replacement out of the live state', () => {
    type Document = {
      count?: number;
      list?: Array<{ id: number }>;
      flag?: boolean;
    };
    const travels = createTravels<Document>(
      { count: 0 },
      {
        mutable: true,
        warnOnUnsupportedState: false,
        onWarning: () => undefined,
      }
    );

    travels.setState(() => ({ list: [{ id: 1 }] }));
    travels.setState((draft) => {
      draft.flag = true;
    });
    travels.go(0);
    travels.go(2);
    travels.setState((draft) => {
      draft.list![0].id = 99;
    });

    // Replay the root replacement from its stored value.
    travels.go(0);
    travels.go(1);
    expect(travels.getState()).toEqual({ list: [{ id: 1 }] });
    travels.go(3);
    expect(travels.getState()).toEqual({ list: [{ id: 99 }], flag: true });
  });

  test('retains event-time inverse values before lazy materialization', () => {
    const state: State = { item: { value: 1 } };
    const removed = state.item!;
    const travels = createTravels(state, {
      mutable: true,
      warnOnUnsupportedState: false,
    });
    let eventPatches: ReadonlyTravelPatches | undefined;
    travels.subscribe(({ patches }) => {
      eventPatches ??= patches;
    });

    travels.setState((draft) => {
      delete draft.item;
    });
    removed.value = 9;

    expect(eventPatches).toBeDefined();
    expectOriginalInverseValue(eventPatches!);
  });

  test('detaches reset patches from a replaced mutable root', () => {
    const createReplacedRoot = () => {
      const travels = createTravels<number[] | number>([1], {
        mutable: true,
        warnOnUnsupportedState: false,
        onWarning: () => undefined,
      });
      // The baseline is an array, so resetting a primitive root replaces it.
      travels.setState(() => 0);
      return travels;
    };
    const restoredRoot = { op: 'replace', path: [], value: [1] };

    const travels = createReplacedRoot();
    let resetPatches: ReadonlyTravelPatches | undefined;
    travels.subscribe(({ type, patches }) => {
      if (type === 'reset') resetPatches = patches;
    });
    travels.reset();
    travels.setState((draft) => {
      (draft as number[]).push(2);
    });
    expect(resetPatches!.patches[0][0]).toEqual(restoredRoot);

    const transactional = createReplacedRoot();
    let transactionPatches: ReadonlyTravelPatches | undefined;
    transactional.subscribe(({ patches }) => {
      transactionPatches = patches;
    });
    transactional.transaction(() => {
      transactional.reset();
      transactional.setState((draft) => {
        (draft as number[]).push(2);
      });
    });
    expect(transactional.getState()).toEqual([1, 2]);
    expect(transactionPatches!.patches[0][0]).toEqual(restoredRoot);
  });
});
