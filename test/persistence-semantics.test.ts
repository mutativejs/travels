import { describe, expect, test } from 'vitest';
import {
  createTravels,
  Travels,
  TravelsPersistenceError,
  type TravelsSerializedHistory,
} from '../src/index';

const emptySnapshot = <S>(state: S): TravelsSerializedHistory<S> => ({
  version: 1,
  state,
  patches: { patches: [], inversePatches: [] },
  position: 0,
});

describe('persisted history semantic validation', () => {
  test('rejects an inverse patch that cannot be applied at the anchor state', () => {
    expect(() =>
      Travels.deserialize({
        version: 1,
        state: { count: 1 },
        position: 1,
        patches: {
          patches: [
            [{ op: 'replace', path: ['missing', 'value'], value: 1 }],
          ],
          inversePatches: [
            [{ op: 'replace', path: ['missing', 'value'], value: 0 }],
          ],
        },
      })
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'inverse',
      })
    );
  });

  test('rejects a future patch that cannot be applied', () => {
    expect(() =>
      Travels.deserialize({
        version: 1,
        state: { count: 0 },
        position: 0,
        patches: {
          patches: [
            [{ op: 'replace', path: ['missing', 'value'], value: 1 }],
          ],
          inversePatches: [
            [{ op: 'replace', path: ['missing', 'value'], value: 0 }],
          ],
        },
      })
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'forward',
      })
    );
  });

  test('rejects state anchors that do not match their patch history', () => {
    expect(() =>
      Travels.deserialize({
        version: 1,
        state: { count: 2, label: 'current' },
        position: 1,
        patches: {
          patches: [
            [{ op: 'replace', path: ['count'], value: 1 }],
          ],
          inversePatches: [
            [
              { op: 'replace', path: ['count'], value: 0 },
              { op: 'replace', path: ['label'], value: 'corrupt' },
            ],
          ],
        },
      })
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'forward',
      })
    );
  });

  test('rejects a non-reversible inverse entry in future history', () => {
    expect(() =>
      Travels.deserialize({
        version: 1,
        state: { count: 0, label: 'before' },
        position: 0,
        patches: {
          patches: [
            [
              { op: 'replace', path: ['count'], value: 1 },
              { op: 'replace', path: ['label'], value: 'after' },
            ],
          ],
          inversePatches: [
            [{ op: 'replace', path: ['count'], value: 0 }],
          ],
        },
      })
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'inverse',
      })
    );
  });

  test('rejects history that changes only a sparse array length', () => {
    expect(() =>
      Travels.deserialize({
        version: 1,
        state: { items: new Array(2) },
        position: 1,
        patches: {
          patches: [
            [{ op: 'replace', path: ['items', 'length'], value: 1 }],
          ],
          inversePatches: [
            [{ op: 'replace', path: ['items', 'length'], value: 1 }],
          ],
        },
      })
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'INVALID_HISTORY',
        entryIndex: 0,
        direction: 'forward',
      })
    );
  });

  test('preserves valid sparse array lengths and hole positions', () => {
    const items = new Array<string>(3);
    const travels = createTravels({ items, count: 0 });
    travels.setState((draft) => {
      draft.count = 1;
    });

    const history = Travels.deserialize(travels.serialize());
    const restored = createTravels(history.state, { history });

    restored.back();
    expect(restored.getState().items).toHaveLength(3);
    expect(0 in restored.getState().items).toBe(false);
    expect(1 in restored.getState().items).toBe(false);
    expect(2 in restored.getState().items).toBe(false);
    expect(restored.getState().count).toBe(0);

    restored.forward();
    expect(restored.getState().items).toHaveLength(3);
    expect(0 in restored.getState().items).toBe(false);
    expect(1 in restored.getState().items).toBe(false);
    expect(2 in restored.getState().items).toBe(false);
    expect(restored.getState().count).toBe(1);
  });

  test('validates every past and future entry without changing the snapshot', () => {
    const travels = createTravels(
      { items: [1, 2, 3, 4], count: 0 },
      { maxHistory: 10 }
    );
    travels.setState((draft) => {
      draft.items.length = 2;
    });
    travels.setState((draft) => {
      draft.count = 1;
      draft.items.splice(0, 1, 9, 8);
    });
    travels.setState((draft) => {
      draft.items.length = 1;
    });
    travels.go(1);

    const serialized = JSON.stringify(travels.serialize());
    const history = Travels.deserialize<{
      items: number[];
      count: number;
    }>(serialized);
    const restored = createTravels(history.state, { history, maxHistory: 10 });

    expect(JSON.stringify(history)).toBe(serialized);
    expect(restored.getHistory()).toEqual(travels.getHistory());
    expect(restored.getPosition()).toBe(1);
  });

  test('does not freeze caller-owned snapshots during semantic replay', () => {
    const sharedChild = { nested: { value: 1 } };
    const snapshot: TravelsSerializedHistory<{
      count: number;
      sharedChild: typeof sharedChild;
    }> = {
      version: 1,
      state: { count: 0, sharedChild },
      position: 0,
      patches: {
        patches: [[{ op: 'replace', path: ['count'], value: 1 }]],
        inversePatches: [[{ op: 'replace', path: ['count'], value: 0 }]],
      },
    };

    const history = Travels.deserialize(snapshot);

    expect(history.state.sharedChild).toBe(sharedChild);
    expect(Object.isFrozen(snapshot.state)).toBe(false);
    expect(Object.isFrozen(sharedChild)).toBe(false);
    expect(Object.isFrozen(sharedChild.nested)).toBe(false);
  });

  test('uses the same semantic pipeline for fallback snapshots', () => {
    const errors: string[] = [];
    const fallback = emptySnapshot({ count: 0 });

    const history = Travels.deserialize(
      {
        version: 1,
        state: { count: 1 },
        position: 1,
        patches: {
          patches: [
            [{ op: 'replace', path: ['missing', 'value'], value: 1 }],
          ],
          inversePatches: [
            [{ op: 'replace', path: ['missing', 'value'], value: 0 }],
          ],
        },
      },
      {
        fallback,
        onError(error) {
          errors.push((error as TravelsPersistenceError).code);
        },
      }
    );

    expect(history).toEqual(fallback);
    expect(errors).toEqual(['INVALID_HISTORY']);
  });

  test('reports FALLBACK_FAILED when fallback semantics are invalid', () => {
    const invalidFallback = {
      version: 1 as const,
      state: { count: 0 },
      position: 0,
      patches: {
        patches: [
          [{ op: 'replace' as const, path: ['missing', 'value'], value: 1 }],
        ],
        inversePatches: [
          [{ op: 'replace' as const, path: ['missing', 'value'], value: 0 }],
        ],
      },
    };

    try {
      Travels.deserialize('not-json', { fallback: invalidFallback });
      throw new Error('Expected semantic fallback validation to fail');
    } catch (error) {
      expect(error).toEqual(
        expect.objectContaining<Partial<TravelsPersistenceError>>({
          code: 'FALLBACK_FAILED',
          cause: expect.objectContaining({ code: 'INVALID_HISTORY' }),
        })
      );
    }
  });
});
