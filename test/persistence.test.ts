import { expect, describe, test, beforeEach, afterEach, vi } from 'vitest';
import {
  createTravels,
  Travels,
  TravelsPersistenceError,
  TRAVELS_HISTORY_SCHEMA_VERSION,
  type TravelPatches,
  type TravelsSerializedHistory,
} from '../src/index';

/**
 * Test suite for persistence.ts example
 * This tests the state persistence demonstrated in examples/persistence.ts
 */
describe('Persistence Example - State Persistence', () => {
  interface AppState {
    user: {
      name: string;
      preferences: {
        theme: 'light' | 'dark';
        notifications: boolean;
      };
    };
    notes: Array<{
      id: number;
      title: string;
      content: string;
      createdAt: string;
    }>;
  }

  const STORAGE_KEY = 'test-travels-app-state';

  // Mock localStorage
  let storage: { [key: string]: string } = {};

  beforeEach(() => {
    storage = {};
    global.localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        storage = {};
      },
      length: Object.keys(storage).length,
      key: (index: number) => Object.keys(storage)[index] || null,
    } as Storage;
  });

  afterEach(() => {
    storage = {};
  });

  test('should save state to localStorage', () => {
    const travels = createTravels<AppState>({
      user: {
        name: 'Guest',
        preferences: { theme: 'light', notifications: true },
      },
      notes: [],
    });

    travels.setState((draft) => {
      draft.user.name = 'Alice';
    });

    const data = {
      state: travels.getState(),
      patches: travels.getPatches(),
      position: travels.getPosition(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.state.user.name).toBe('Alice');
    expect(parsed.position).toBe(1);
  });

  test('should load state from localStorage', () => {
    const initialTravels = createTravels<AppState>(
      {
        user: {
          name: 'Guest',
          preferences: { theme: 'light', notifications: true },
        },
        notes: [],
      },
      { maxHistory: 50 }
    );

    initialTravels.setState((draft) => {
      draft.user.name = 'Alice';
      draft.user.preferences.theme = 'dark';
    });

    initialTravels.setState((draft) => {
      draft.notes.push({
        id: 1,
        title: 'Meeting Notes',
        content: 'Discussed project roadmap',
        createdAt: new Date().toISOString(),
      });
    });

    // Save to storage
    const data = {
      state: initialTravels.getState(),
      patches: initialTravels.getPatches(),
      position: initialTravels.getPosition(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Load from storage
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsedData = JSON.parse(stored!);

    const reloadedTravels = createTravels(parsedData.state, {
      initialPatches: parsedData.patches,
      initialPosition: parsedData.position,
      maxHistory: 50,
    });

    expect(reloadedTravels.getState().user.name).toBe('Alice');
    expect(reloadedTravels.getState().user.preferences.theme).toBe('dark');
    expect(reloadedTravels.getState().notes).toHaveLength(1);
    expect(reloadedTravels.getPosition()).toBe(2);
  });

  test('should restore undo/redo functionality after reload', () => {
    const initialTravels = createTravels<AppState>(
      {
        user: {
          name: 'Guest',
          preferences: { theme: 'light', notifications: true },
        },
        notes: [],
      },
      { maxHistory: 50 }
    );

    initialTravels.setState((draft) => {
      draft.user.name = 'Alice';
    });

    initialTravels.setState((draft) => {
      draft.notes.push({
        id: 1,
        title: 'Note 1',
        content: 'Content 1',
        createdAt: new Date().toISOString(),
      });
    });

    initialTravels.setState((draft) => {
      draft.notes.push({
        id: 2,
        title: 'Note 2',
        content: 'Content 2',
        createdAt: new Date().toISOString(),
      });
    });

    // Save to storage
    const data = {
      state: initialTravels.getState(),
      patches: initialTravels.getPatches(),
      position: initialTravels.getPosition(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Load from storage
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsedData = JSON.parse(stored!);

    const reloadedTravels = createTravels(parsedData.state, {
      initialPatches: parsedData.patches,
      initialPosition: parsedData.position,
      maxHistory: 50,
    });

    // Test undo
    reloadedTravels.back(2);
    expect(reloadedTravels.getState().notes).toHaveLength(0);

    // Test redo
    reloadedTravels.forward();
    expect(reloadedTravels.getState().notes).toHaveLength(1);
  });

  test('should maintain full history after reload', () => {
    const initialTravels = createTravels<AppState>(
      {
        user: {
          name: 'Guest',
          preferences: { theme: 'light', notifications: true },
        },
        notes: [],
      },
      { maxHistory: 50 }
    );

    initialTravels.setState((draft) => {
      draft.user.name = 'Alice';
    });

    initialTravels.setState((draft) => {
      draft.user.preferences.theme = 'dark';
    });

    // Save and reload
    const data = {
      state: initialTravels.getState(),
      patches: initialTravels.getPatches(),
      position: initialTravels.getPosition(),
    };

    const reloadedTravels = createTravels(data.state, {
      initialPatches: data.patches,
      initialPosition: data.position,
      maxHistory: 50,
    });

    const history = reloadedTravels.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].user.name).toBe('Guest');
    expect(history[1].user.name).toBe('Alice');
    expect(history[2].user.preferences.theme).toBe('dark');
  });

  test('should export data for backup', () => {
    const travels = createTravels<AppState>({
      user: {
        name: 'Alice',
        preferences: { theme: 'dark', notifications: true },
      },
      notes: [
        {
          id: 1,
          title: 'Note',
          content: 'Content',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const exportData = {
      state: travels.getState(),
      patches: travels.getPatches(),
      position: travels.getPosition(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    expect(exportData.state.user.name).toBe('Alice');
    expect(exportData.state.notes).toHaveLength(1);
    expect(exportData.version).toBe('1.0.0');
    expect(exportData.exportedAt).toBeTruthy();
  });

  test('should handle complex state updates with persistence', () => {
    const travels = createTravels<AppState>(
      {
        user: {
          name: 'Guest',
          preferences: { theme: 'light', notifications: true },
        },
        notes: [],
      },
      { maxHistory: 50 }
    );

    // Update user preferences
    travels.setState((draft) => {
      draft.user.name = 'Alice';
      draft.user.preferences.theme = 'dark';
    });

    // Add notes
    travels.setState((draft) => {
      draft.notes.push({
        id: 1,
        title: 'Meeting Notes',
        content: 'Discussed project roadmap',
        createdAt: new Date().toISOString(),
      });
    });

    travels.setState((draft) => {
      draft.notes.push({
        id: 2,
        title: 'Ideas',
        content: 'New feature ideas',
        createdAt: new Date().toISOString(),
      });
    });

    // Modify a note
    travels.setState((draft) => {
      draft.notes[0].content += '\n- Action item: Review designs';
    });

    expect(travels.getState().notes).toHaveLength(2);
    expect(travels.getState().notes[0].content).toContain('Action item');

    // Persist and reload
    const data = {
      state: travels.getState(),
      patches: travels.getPatches(),
      position: travels.getPosition(),
    };

    const reloadedTravels = createTravels(data.state, {
      initialPatches: data.patches,
      initialPosition: data.position,
      maxHistory: 50,
    });

    expect(reloadedTravels.getState().notes[0].content).toContain(
      'Action item'
    );
    expect(reloadedTravels.getPatches().patches).toHaveLength(4);
  });

  test('should clear storage when needed', () => {
    localStorage.setItem(STORAGE_KEY, 'some data');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('some data');

    localStorage.removeItem(STORAGE_KEY);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test('serialize() should export a versioned snapshot with cloned state and patches', () => {
    const travels = createTravels<AppState>(
      {
        user: {
          name: 'Guest',
          preferences: { theme: 'light', notifications: true },
        },
        notes: [],
      },
      { maxHistory: 50 }
    );

    travels.setState((draft) => {
      draft.user.name = 'Alice';
    });

    const snapshot = travels.serialize();
    expect(snapshot.version).toBe(TRAVELS_HISTORY_SCHEMA_VERSION);
    expect(snapshot.state.user.name).toBe('Alice');
    expect(snapshot.position).toBe(1);
    expect(snapshot.patches.patches).toHaveLength(1);

    snapshot.state.user.name = 'Mutated outside';
    snapshot.patches.patches.length = 0;

    expect(travels.getState().user.name).toBe('Alice');
    expect(travels.getPatches().patches).toHaveLength(1);
  });

  test('Travels.deserialize() should restore history through the history option', () => {
    const initialTravels = createTravels<AppState>(
      {
        user: {
          name: 'Guest',
          preferences: { theme: 'light', notifications: true },
        },
        notes: [],
      },
      { maxHistory: 50 }
    );

    initialTravels.setState((draft) => {
      draft.user.name = 'Alice';
    });
    initialTravels.setState((draft) => {
      draft.notes.push({
        id: 1,
        title: 'Restored',
        content: 'From serialized history',
        createdAt: new Date().toISOString(),
      });
    });

    const stored = JSON.stringify(initialTravels.serialize());
    const history = Travels.deserialize<AppState>(stored);
    const reloadedTravels = createTravels(history.state, {
      history,
      maxHistory: 50,
      strictInitialPatches: true,
    });

    expect(reloadedTravels.getState().user.name).toBe('Alice');
    expect(reloadedTravels.getState().notes).toHaveLength(1);
    expect(reloadedTravels.getPosition()).toBe(2);

    reloadedTravels.back();
    expect(reloadedTravels.getState().notes).toHaveLength(0);

    reloadedTravels.forward();
    expect(reloadedTravels.getState().notes).toHaveLength(1);
  });

  test('serialize() should include metadata placeholders for pending manual patches', () => {
    const travels = createTravels(
      { count: 0 },
      { autoArchive: false, maxHistory: 10 }
    );

    travels.setState((draft) => {
      draft.count = 1;
    });

    const snapshot = travels.serialize();
    expect(snapshot.patches.patches).toHaveLength(1);
    expect(snapshot.metadata).toHaveLength(snapshot.patches.patches.length);

    const history = Travels.deserialize<typeof snapshot.state>(snapshot);
    const reloadedTravels = createTravels(history.state, {
      autoArchive: false,
      history,
    });

    expect(reloadedTravels.getState()).toEqual({ count: 1 });
    reloadedTravels.back();
    expect(reloadedTravels.getState()).toEqual({ count: 0 });
  });

  test('serialize() should persist multi-update pending manual patches in replayable order', () => {
    const travels = createTravels(
      { items: [] as string[] },
      { autoArchive: false, maxHistory: 10 }
    );

    travels.setState((draft) => {
      draft.items.push('a');
    });
    travels.setState((draft) => {
      draft.items.push('b');
    });

    const history = Travels.deserialize<{ items: string[] }>(
      JSON.stringify(travels.serialize())
    );
    const reloadedTravels = createTravels(history.state, {
      autoArchive: false,
      history,
      maxHistory: 10,
    });

    expect(reloadedTravels.getState()).toEqual({ items: ['a', 'b'] });
    reloadedTravels.back();
    expect(reloadedTravels.getState()).toEqual({ items: [] });
    reloadedTravels.forward();
    expect(reloadedTravels.getState()).toEqual({ items: ['a', 'b'] });
  });

  test('serialize() keeps a pending manual entry aligned at maxHistory capacity', () => {
    const travels = createTravels(
      { count: 0 },
      { autoArchive: false, maxHistory: 2 }
    );

    for (const count of [1, 2]) {
      travels.setState((draft) => {
        draft.count = count;
      });
      travels.archive();
    }

    travels.setState((draft) => {
      draft.count = 3;
    });

    const snapshot = travels.serialize();
    expect(snapshot.position).toBe(2);
    expect(snapshot.patches.patches).toHaveLength(2);
    expect(snapshot.metadata).toHaveLength(2);

    const history = Travels.deserialize<{ count: number }>(
      JSON.stringify(snapshot)
    );
    const restored = createTravels(history.state, {
      autoArchive: false,
      history,
      maxHistory: 2,
    });

    expect(restored.getHistory().map((state) => state.count)).toEqual([1, 2, 3]);
    restored.back();
    expect(restored.getState()).toEqual({ count: 2 });
    restored.forward();
    expect(restored.getState()).toEqual({ count: 3 });
  });

  test('serialize() should align metadata for history restored without metadata', () => {
    const initialTravels = createTravels({ count: 0 });
    initialTravels.setState((draft) => {
      draft.count = 1;
    });

    const reloadedTravels = createTravels(initialTravels.getState(), {
      history: {
        patches: initialTravels.getPatches(),
        position: initialTravels.getPosition(),
      },
    });

    const snapshot = reloadedTravels.serialize();
    expect(snapshot.metadata).toHaveLength(snapshot.patches.patches.length);
    expect(() => Travels.deserialize(snapshot)).not.toThrow();
  });

  test('Travels.deserialize() should throw typed errors for corrupted storage', () => {
    expect(() => Travels.deserialize<AppState>('{broken json')).toThrow(
      TravelsPersistenceError
    );

    for (const patches of [null, undefined]) {
      try {
        Travels.deserialize<AppState>({
          version: TRAVELS_HISTORY_SCHEMA_VERSION,
          state: {},
          position: 0,
          patches,
        });
        throw new Error('Expected Travels.deserialize to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(TravelsPersistenceError);
        expect((error as TravelsPersistenceError).code).toBe('INVALID_PATCHES');
      }
    }

    expect(() =>
      Travels.deserialize<AppState>({
        version: TRAVELS_HISTORY_SCHEMA_VERSION,
        state: {},
        position: 0,
        patches: { patches: [], inversePatches: [] },
        metadata: null,
      })
    ).toThrow(TravelsPersistenceError);

    for (const metadata of [[123], [[]]]) {
      expect(() =>
        Travels.deserialize<AppState>({
          version: TRAVELS_HISTORY_SCHEMA_VERSION,
          state: {},
          position: 1,
          patches: {
            patches: [[{ op: 'replace', path: ['count'], value: 1 }]],
            inversePatches: [[{ op: 'replace', path: ['count'], value: 0 }]],
          },
          metadata,
        })
      ).toThrow(TravelsPersistenceError);
    }

    try {
      Travels.deserialize<AppState>({
        version: TRAVELS_HISTORY_SCHEMA_VERSION,
        state: {},
        position: 0,
        patches: {
          patches: [[{ op: 'invalid', path: '/x' }]],
          inversePatches: [[]],
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(TravelsPersistenceError);
      expect((error as TravelsPersistenceError).code).toBe('INVALID_PATCHES');
    }

    for (const operation of [
      { op: 'add', path: ['count'] },
      { op: 'replace', path: ['count'] },
    ]) {
      expect(() =>
        Travels.deserialize<AppState>({
          version: TRAVELS_HISTORY_SCHEMA_VERSION,
          state: { count: 1 },
          position: 1,
          patches: {
            patches: [[operation]],
            inversePatches: [[{ op: 'replace', path: ['count'], value: 0 }]],
          },
          metadata: [undefined],
        })
      ).toThrow(TravelsPersistenceError);
    }

    for (const operation of [
      { op: 'move', from: ['count'], path: ['other'] },
      { op: 'copy', from: ['count'], path: ['other'] },
      { op: 'test', path: ['count'], value: 1 },
    ]) {
      expect(() =>
        Travels.deserialize<AppState>({
          version: TRAVELS_HISTORY_SCHEMA_VERSION,
          state: { count: 1 },
          position: 1,
          patches: {
            patches: [[operation]],
            inversePatches: [[{ op: 'replace', path: ['count'], value: 0 }]],
          },
          metadata: [undefined],
        })
      ).toThrow(TravelsPersistenceError);
    }

    expect(() =>
      Travels.deserialize<AppState>({
        version: TRAVELS_HISTORY_SCHEMA_VERSION,
        state: { count: 1 },
        position: 1,
        patches: {
          patches: [[{ op: 'replace', path: 'count', value: 1 }]],
          inversePatches: [[{ op: 'replace', path: 'count', value: 0 }]],
        },
        metadata: [undefined],
      })
    ).toThrow(TravelsPersistenceError);

    for (const operation of [
      { op: 'add', path: [], value: { count: 1 } },
      { op: 'add', path: '', value: { count: 1 } },
      { op: 'remove', path: [] },
      { op: 'remove', path: '' },
    ]) {
      expect(() =>
        Travels.deserialize<AppState>({
          version: TRAVELS_HISTORY_SCHEMA_VERSION,
          state: { count: 1 },
          position: 1,
          patches: {
            patches: [[operation]],
            inversePatches: [[{ op: 'replace', path: [], value: {} }]],
          },
          metadata: [undefined],
        })
      ).toThrow(TravelsPersistenceError);
    }

    expect(() =>
      Travels.deserialize<AppState>({
        version: TRAVELS_HISTORY_SCHEMA_VERSION,
        state: { count: null },
        position: 1,
        patches: {
          patches: [[{ op: 'replace', path: ['count'], value: null }]],
          inversePatches: [[{ op: 'replace', path: ['count'], value: 0 }]],
        },
        metadata: [undefined],
      })
    ).not.toThrow();

    expect(() =>
      Travels.deserialize<AppState>({
        version: TRAVELS_HISTORY_SCHEMA_VERSION,
        state: { count: 1 },
        position: 1,
        patches: {
          patches: [[{ op: 'replace', path: [], value: { count: 1 } }]],
          inversePatches: [[{ op: 'replace', path: [], value: {} }]],
        },
        metadata: [undefined],
      })
    ).not.toThrow();

    expect(() =>
      Travels.deserialize<AppState>({
        version: TRAVELS_HISTORY_SCHEMA_VERSION,
        state: { count: 1 },
        position: 1,
        patches: {
          patches: [[{ op: 'replace', path: '/count', value: 1 }]],
          inversePatches: [[{ op: 'replace', path: '/count', value: 0 }]],
        },
        metadata: [undefined],
      })
    ).not.toThrow();
  });

  test('Travels.deserialize() should normalize null metadata placeholders', () => {
    const history = Travels.deserialize<{ count: number }>({
      version: TRAVELS_HISTORY_SCHEMA_VERSION,
      state: { count: 1 },
      position: 1,
      patches: {
        patches: [[{ op: 'replace', path: ['count'], value: 1 }]],
        inversePatches: [[{ op: 'replace', path: ['count'], value: 0 }]],
      },
      metadata: [null],
    });

    expect(history.metadata).toEqual([undefined]);

    const travels = createTravels(history.state, { history });
    expect(travels.getMetadata()).toEqual([undefined]);
  });

  test('Travels.deserialize() rejects malformed and unsafe patch paths', () => {
    const sparseHistory: unknown[] = [];
    sparseHistory.length = 1;
    const sparsePath: unknown[] = [];
    sparsePath.length = 1;

    const invalidPaths = [
      sparsePath,
      [-1],
      [1.5],
      [Number.NaN],
      ['__proto__'],
      ['constructor', 'prototype'],
      '/count/~2',
      '/__proto__',
      '/constructor/prototype',
    ];
    const histories = [
      { patches: sparseHistory, inversePatches: sparseHistory },
      ...invalidPaths.map((path) => ({
        patches: [[{ op: 'replace', path, value: 1 }]],
        inversePatches: [[{ op: 'replace', path: ['count'], value: 0 }]],
      })),
    ];

    for (const patches of histories) {
      expect(() =>
        Travels.deserialize({
          version: TRAVELS_HISTORY_SCHEMA_VERSION,
          state: { count: 0 },
          position: 0,
          patches,
        })
      ).toThrowError(
        expect.objectContaining<Partial<TravelsPersistenceError>>({
          code: 'INVALID_PATCHES',
        })
      );
    }
  });

  test('Travels.deserialize() round-trips terminal reserved-looking data keys', () => {
    const initialState = JSON.parse(
      '{"constructor":"document","prototype":"example"}'
    ) as { constructor: string; prototype: string };
    const travels = createTravels(initialState);

    travels.setState((draft) => {
      draft.constructor = 'updated-document';
      draft.prototype = 'updated-example';
    });

    const history = Travels.deserialize<{
      constructor: string;
      prototype: string;
    }>(JSON.stringify(travels.serialize()));
    const restored = createTravels(history.state, { history });

    expect(restored.getState()).toEqual({
      constructor: 'updated-document',
      prototype: 'updated-example',
    });
    restored.back();
    expect(restored.getState()).toEqual(initialState);
    restored.forward();
    expect(restored.getState()).toEqual({
      constructor: 'updated-document',
      prototype: 'updated-example',
    });
  });

  test('Travels.deserialize() permits terminal reserved-looking patch paths', () => {
    const paths = [['constructor'], ['prototype'], '/constructor', '/prototype'];

    for (const path of paths) {
      expect(() =>
        Travels.deserialize({
          version: TRAVELS_HISTORY_SCHEMA_VERSION,
          state: { constructor: 'value', prototype: 'value' },
          position: 1,
          patches: {
            patches: [[{ op: 'replace', path, value: 'value' }]],
            inversePatches: [[{ op: 'replace', path, value: 'previous' }]],
          },
          metadata: [undefined],
        })
      ).not.toThrow();
    }
  });

  test('Travels.deserialize() should support corrupted storage fallback', () => {
    const errors: string[] = [];
    const fallback: TravelsSerializedHistory<AppState> = {
      version: TRAVELS_HISTORY_SCHEMA_VERSION,
      state: {
        user: {
          name: 'Fallback',
          preferences: { theme: 'light', notifications: true },
        },
        notes: [],
      },
      patches: { patches: [], inversePatches: [] },
      position: 0,
    };

    const history = Travels.deserialize<AppState>('not-json', {
      fallback,
      onError(error) {
        errors.push((error as TravelsPersistenceError).code);
      },
    });

    expect(errors).toEqual(['PARSE_ERROR']);
    expect(history.state.user.name).toBe('Fallback');
  });

  test('Travels.deserialize() reports invalid and throwing fallbacks', () => {
    const errors: string[] = [];

    expect(() =>
      Travels.deserialize('not-json', {
        fallback: () => {
          throw new Error('fallback failed');
        },
        onError(error) {
          errors.push((error as TravelsPersistenceError).code);
        },
      })
    ).toThrowError(
      expect.objectContaining<Partial<TravelsPersistenceError>>({
        code: 'FALLBACK_FAILED',
      })
    );

    expect(errors).toEqual(['PARSE_ERROR', 'FALLBACK_FAILED']);
  });

  test('persistence observers cannot block a valid fallback', () => {
    const fallback: TravelsSerializedHistory<{ count: number }> = {
      version: TRAVELS_HISTORY_SCHEMA_VERSION,
      state: { count: 0 },
      patches: { patches: [], inversePatches: [] },
      position: 0,
    };

    const history = Travels.deserialize<{ count: number }>('not-json', {
      fallback,
      onError() {
        throw new Error('observer failed');
      },
    });

    expect(history).toEqual(fallback);
  });

  test('rejected asynchronous persistence observers cannot block fallback', async () => {
    const fallback: TravelsSerializedHistory<{ count: number }> = {
      version: TRAVELS_HISTORY_SCHEMA_VERSION,
      state: { count: 0 },
      patches: { patches: [], inversePatches: [] },
      position: 0,
    };
    const observer = vi.fn(async () => {
      throw new Error('async persistence observer failed');
    });

    const history = Travels.deserialize<{ count: number }>('not-json', {
      fallback,
      onError: observer,
    });

    expect(history).toEqual(fallback);
    expect(observer).toHaveBeenCalledOnce();
    await Promise.resolve();
  });

  test('rejects Promise-like migrations without unhandled rejections', async () => {
    type State = { count: number };
    const snapshot: TravelsSerializedHistory<State> = {
      version: TRAVELS_HISTORY_SCHEMA_VERSION,
      state: { count: 0 },
      patches: { patches: [], inversePatches: [] },
      position: 0,
    };
    const unhandledRejections: unknown[] = [];
    const recordUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    const promiseWithOverriddenThen = () => {
      const promise = Promise.reject(new Error('overridden then'));
      Object.defineProperty(promise, 'then', { value: undefined });
      return promise;
    };
    const results: Array<{ name: string; create: () => unknown }> = [
      {
        name: 'resolved Promise',
        create: () => Promise.resolve(snapshot),
      },
      {
        name: 'rejected Promise',
        create: () => Promise.reject(new Error('migration rejected')),
      },
      {
        name: 'Promise with an overridden then property',
        create: promiseWithOverriddenThen,
      },
      {
        name: 'rejecting thenable',
        create: () => ({
          then(
            _resolve: (value: unknown) => void,
            reject: (reason: unknown) => void
          ) {
            reject(new Error('migration thenable rejected'));
          },
        }),
      },
    ];

    process.on('unhandledRejection', recordUnhandledRejection);
    try {
      for (const result of results) {
        const onError = vi.fn();
        const migrate = (() => result.create()) as (
          input: unknown
        ) => TravelsSerializedHistory<State>;

        expect(
          () =>
            Travels.deserialize<State>(snapshot, {
              migrate,
              onError,
            }),
          result.name
        ).toThrowError(
          expect.objectContaining<Partial<TravelsPersistenceError>>({
            code: 'MIGRATION_FAILED',
            message:
              'Travels: persisted history migrate callback must return synchronously.',
          })
        );
        expect(onError, result.name).toHaveBeenCalledWith(
          expect.objectContaining<Partial<TravelsPersistenceError>>({
            code: 'MIGRATION_FAILED',
          })
        );
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', recordUnhandledRejection);
    }
  });

  test('rejects Promise-like fallback results as FALLBACK_FAILED', async () => {
    type State = { count: number };
    const unhandledRejections: unknown[] = [];
    const recordUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    const errors: TravelsPersistenceError[] = [];
    const fallback = (() =>
      Promise.reject(
        new Error('fallback rejected')
      )) as unknown as () => TravelsSerializedHistory<State>;

    process.on('unhandledRejection', recordUnhandledRejection);
    try {
      expect(() =>
        Travels.deserialize<State>('not-json', {
          fallback,
          onError(error) {
            errors.push(error as TravelsPersistenceError);
          },
        })
      ).toThrowError(
        expect.objectContaining<Partial<TravelsPersistenceError>>({
          code: 'FALLBACK_FAILED',
          message:
            'Travels: persisted history fallback callback must return synchronously.',
        })
      );

      expect(errors).toEqual([
        expect.objectContaining({ code: 'PARSE_ERROR' }),
        expect.objectContaining({ code: 'FALLBACK_FAILED' }),
      ]);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', recordUnhandledRejection);
    }
  });

  test('Travels.deserialize() should run migration before validation', () => {
    const oldSnapshot = {
      version: 0,
      state: {
        user: {
          name: 'Migrated',
          preferences: { theme: 'dark', notifications: true },
        },
        notes: [],
      },
      history: { patches: [], inversePatches: [] },
      cursor: 0,
    };

    const history = Travels.deserialize<AppState>(oldSnapshot, {
      migrate(snapshot) {
        const legacy = snapshot as typeof oldSnapshot;
        return {
          version: TRAVELS_HISTORY_SCHEMA_VERSION,
          state: legacy.state,
          patches: legacy.history,
          position: legacy.cursor,
        };
      },
    });

    expect(history.state.user.name).toBe('Migrated');
    expect(history.position).toBe(0);
  });
});
