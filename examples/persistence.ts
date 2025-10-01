/**
 * Persistence Example
 *
 * This example demonstrates how to persist Travels state to localStorage
 * and restore it on application restart.
 */

import { createTravels, type TravelPatches } from '../src/index';

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

// Storage key
const STORAGE_KEY = 'travels-app-state';

/**
 * Save travels state to localStorage
 */
function saveToStorage(travels: any) {
  const data = {
    state: travels.getState(),
    patches: travels.getPatches(),
    position: travels.getPosition(),
    timestamp: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('✓ State saved to localStorage');
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

/**
 * Load travels state from localStorage
 */
function loadFromStorage(): {
  initialState: AppState;
  initialPatches?: TravelPatches;
  initialPosition?: number;
} | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);
    console.log('✓ State loaded from localStorage');
    console.log('  Timestamp:', data.timestamp);

    return {
      initialState: data.state,
      initialPatches: data.patches,
      initialPosition: data.position,
    };
  } catch (error) {
    console.error('Failed to load state:', error);
    return null;
  }
}

/**
 * Clear persisted state
 */
function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
  console.log('✓ Storage cleared');
}

// Initialize travels with persisted state or default state
const defaultState: AppState = {
  user: {
    name: 'Guest',
    preferences: {
      theme: 'light',
      notifications: true,
    },
  },
  notes: [],
};

console.log('=== Initializing Travels ===');
const persisted = loadFromStorage();

const travels = persisted
  ? createTravels(persisted.initialState, {
      initialPatches: persisted.initialPatches,
      initialPosition: persisted.initialPosition,
      maxHistory: 50,
    })
  : createTravels(defaultState, { maxHistory: 50 });

console.log('Initial state:', travels.getState());
console.log('Initial position:', travels.getPosition());

// Auto-save on state changes
travels.subscribe((state, patches, position) => {
  console.log('\nState changed - Auto-saving...');
  saveToStorage(travels);
});

// Example operations
console.log('\n=== Making changes ===');

// Update user preferences
travels.setState((draft) => {
  draft.user.name = 'Alice';
  draft.user.preferences.theme = 'dark';
});

// Add some notes
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
    content: 'New feature ideas for the app',
    createdAt: new Date().toISOString(),
  });
});

// Modify a note
travels.setState((draft) => {
  draft.notes[0].content += '\n- Action item: Review designs';
});

console.log('\n=== Current state ===');
console.log('User:', travels.getState().user);
console.log('Notes count:', travels.getState().notes.length);
console.log('History position:', travels.getPosition());
console.log('History length:', travels.getPatches().patches.length);

// Simulate application restart
console.log('\n=== Simulating app restart ===');
console.log('Reloading state from localStorage...\n');

const reloadedData = loadFromStorage();
if (reloadedData) {
  const reloadedTravels = createTravels(reloadedData.initialState, {
    initialPatches: reloadedData.initialPatches,
    initialPosition: reloadedData.initialPosition,
    maxHistory: 50,
  });

  console.log('✓ State restored successfully');
  console.log('User:', reloadedTravels.getState().user);
  console.log('Notes count:', reloadedTravels.getState().notes.length);
  console.log('History position:', reloadedTravels.getPosition());

  // Can still use undo/redo
  console.log('\n=== Testing undo/redo after reload ===');
  console.log('Going back 2 steps...');
  reloadedTravels.back(2);
  console.log('Notes count after undo:', reloadedTravels.getState().notes.length);

  console.log('\nGoing forward 1 step...');
  reloadedTravels.forward();
  console.log('Notes count after redo:', reloadedTravels.getState().notes.length);

  // View full history
  console.log('\n=== Full history ===');
  const history = reloadedTravels.getHistory();
  history.forEach((state, index) => {
    console.log(`Position ${index}:`, {
      user: state.user.name,
      notesCount: state.notes.length,
    });
  });
}

// Example: Exporting history for backup
console.log('\n=== Exporting for backup ===');
const exportData = {
  state: travels.getState(),
  patches: travels.getPatches(),
  position: travels.getPosition(),
  exportedAt: new Date().toISOString(),
  version: '1.0.0',
};

console.log('Export data size:', JSON.stringify(exportData).length, 'bytes');
console.log('Patches count:', exportData.patches.patches.length);

// Note: In a real application, you might want to:
// 1. Compress the data before storing
// 2. Store in IndexedDB for larger datasets
// 3. Implement data migration strategies
// 4. Add versioning to handle schema changes
// 5. Debounce the auto-save to reduce storage operations

// Cleanup (optional)
// clearStorage();
