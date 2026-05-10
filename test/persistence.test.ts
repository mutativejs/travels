import { expect, describe, test, beforeEach, afterEach } from 'vitest';
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

  test('Travels.deserialize() should throw typed errors for corrupted storage', () => {
    expect(() => Travels.deserialize<AppState>('{broken json')).toThrow(
      TravelsPersistenceError
    );

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
