import { describe, expect, test } from 'vitest';
import { nextTick, reactive, watchEffect } from 'vue';
import {
  createTravelJournal,
  createTravels,
  restoreTravelJournal,
  restoreTravels,
  Travels,
  type TravelsSerializedHistory,
} from '../src/index';

type Doc = { title: string; tags: string[] };

const createSnapshot = (): TravelsSerializedHistory<Doc> => {
  const source = createTravels<Doc>({ title: 'draft', tags: [] });
  source.setState((draft) => {
    draft.title = 'saved';
  });
  source.setState((draft) => {
    draft.tags.push('a');
  });
  return source.serialize();
};

describe('restoreTravels state ownership', () => {
  test('does not mutate a reused fallback snapshot in mutable mode', () => {
    const empty: TravelsSerializedHistory<Doc> = {
      version: 1,
      state: { title: '', tags: [] },
      patches: { patches: [], inversePatches: [] },
      position: 0,
    };
    const restore = () =>
      restoreTravels(
        Travels.deserialize<Doc>('not json', {
          fallback: empty,
          onError: () => undefined,
        }),
        { mutable: true }
      );

    const first = restore();
    first.setState((draft) => {
      draft.title = 'document A';
      draft.tags.push('a');
    });

    expect(empty.state).toEqual({ title: '', tags: [] });
    expect(restore().getState()).toEqual({ title: '', tags: [] });
  });

  test('keeps restored timelines independent of each other', () => {
    const snapshot = createSnapshot();
    const left = restoreTravels(snapshot, { mutable: true });
    const right = restoreTravels(snapshot, { mutable: true });

    left.setState((draft) => {
      draft.title = 'left';
    });

    expect(left.getState()).not.toBe(snapshot.state);
    expect(right.getState().title).toBe('saved');
    expect(snapshot.state.title).toBe('saved');
  });

  test('restores into an explicit live target and navigates in place', () => {
    const snapshot = createSnapshot();
    const store: Doc = { title: 'stale', tags: ['stale', 'values'] };
    const travels = restoreTravels(snapshot, { mutable: true, target: store });

    expect(travels.getState()).toBe(store);
    expect(store).toEqual({ title: 'saved', tags: ['a'] });
    expect(store.tags).not.toBe(snapshot.state.tags);

    travels.back();
    expect(travels.getState()).toBe(store);
    expect(store).toEqual({ title: 'saved', tags: [] });

    travels.reset();
    expect(store).toEqual({ title: 'saved', tags: ['a'] });
    expect(snapshot.state).toEqual({ title: 'saved', tags: ['a'] });
  });

  test('keeps a Vue reactive target observable across restore and undo', async () => {
    const snapshot = createSnapshot();
    const store = reactive<Doc>({ title: '', tags: [] });
    const titles: string[] = [];
    const stop = watchEffect(() => {
      titles.push(`${store.title}:${store.tags.length}`);
    });

    const travels = restoreTravels(snapshot, { mutable: true, target: store });
    await nextTick();
    travels.back();
    await nextTick();

    expect(travels.getState()).toBe(store);
    expect(titles).toEqual([':0', 'saved:1', 'saved:0']);
    stop();
  });

  test('rejects a target without mutable mode or with a mismatched root', () => {
    const snapshot = createSnapshot();

    expect(() =>
      restoreTravels(snapshot, { target: { title: '', tags: [] } })
    ).toThrowError(expect.objectContaining({ code: 'INVALID_OPTION' }));
    expect(() =>
      restoreTravels(snapshot, {
        mutable: true,
        target: [] as unknown as Doc,
      })
    ).toThrowError(expect.objectContaining({ code: 'INVALID_OPTION' }));
  });

  test('rejects a target when either root has an own __proto__ key', () => {
    // JSON.parse defines __proto__ as an own data property.
    const parse = (title: string): Doc =>
      JSON.parse(`{"__proto__":{},"title":"${title}","tags":[]}`);
    const snapshotOf = (state: Doc): TravelsSerializedHistory<Doc> => ({
      version: 1,
      state,
      patches: { patches: [], inversePatches: [] },
      position: 0,
    });
    const store: Doc = { title: 'live', tags: [] };

    for (const [state, target] of [
      [parse('saved'), store],
      [{ title: 'saved', tags: [] }, parse('live')],
    ]) {
      expect(() =>
        restoreTravels(snapshotOf(state), { mutable: true, target })
      ).toThrowError(expect.objectContaining({ code: 'INVALID_OPTION' }));
    }
    expect(store).toEqual({ title: 'live', tags: [] });
  });

  test('leaves the target untouched when the snapshot is rejected', () => {
    const store: Doc = { title: 'live', tags: [] };

    expect(() =>
      restoreTravels(
        {
          version: 1,
          state: store,
          patches: null,
        } as unknown as TravelsSerializedHistory<Doc>,
        { mutable: true, target: store }
      )
    ).toThrow();
    expect(store).toEqual({ title: 'live', tags: [] });
  });

  test('accepts target only on restoreTravels', () => {
    const state: Doc = { title: '', tags: [] };
    const apply = () => state;

    for (const create of [
      () => createTravels(state, { target: state } as never),
      () => createTravelJournal(state, { apply, target: state } as never),
      () =>
        restoreTravelJournal(createSnapshot(), {
          apply,
          target: state,
        } as never),
    ]) {
      expect(create).toThrowError(
        expect.objectContaining({ code: 'INVALID_OPTION' })
      );
    }
  });
});

describe('restoring deserialized snapshots', () => {
  test('revalidates patch operations edited in place after deserialize', () => {
    const editors: Array<(snapshot: TravelsSerializedHistory<Doc>) => void> = [
      (snapshot) => {
        (snapshot.patches.patches[0][0] as { value: unknown }).value =
          new Set();
      },
      (snapshot) => {
        snapshot.patches.patches[0][0].path = ['__proto__', 'polluted'];
      },
      (snapshot) => {
        (snapshot.patches.patches[0][0] as { op: string }).op = 'unknown';
      },
    ];

    for (const edit of editors) {
      const decoded = Travels.deserialize<Doc>(createSnapshot());
      edit(decoded);
      expect(() => restoreTravels(decoded)).toThrowError(
        expect.objectContaining({ code: 'INVALID_PATCHES' })
      );
    }
  });
});
