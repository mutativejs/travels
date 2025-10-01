/**
 * Manual Archive Mode Example
 *
 * This example demonstrates how to use manual archive mode to batch
 * multiple state changes into a single undo/redo step.
 */

import { createTravels } from '../src/index';

interface TodoState {
  todos: Array<{
    id: number;
    text: string;
    completed: boolean;
  }>;
}

// Create a travels instance with manual archive mode
const travels = createTravels<TodoState>(
  { todos: [] },
  { autoArchive: false, maxHistory: 20 }
);

travels.subscribe((state, patches, position) => {
  console.log('State changed:', state);
  console.log('Position:', position);
  console.log('Can archive:', travels.canArchive());
  console.log('---');
});

console.log('=== Scenario 1: Batch operations ===');
console.log('Adding multiple todos without archiving...\n');

// Make multiple changes (they will be batched)
travels.setState((draft) => {
  draft.todos.push({ id: 1, text: 'Buy milk', completed: false });
});

travels.setState((draft) => {
  draft.todos.push({ id: 2, text: 'Walk dog', completed: false });
});

travels.setState((draft) => {
  draft.todos.push({ id: 3, text: 'Write code', completed: false });
});

console.log('Current state:', travels.getState());
console.log('Can archive:', travels.canArchive());

// Archive all changes as a single history entry
console.log('\n=== Archiving all changes ===');
travels.archive();
console.log('Archived! Can archive now:', travels.canArchive());
console.log('Patches count:', travels.getPatches().patches.length);

// Undo will go back to empty todos
console.log('\n=== Undo (goes back to empty state) ===');
travels.back();
console.log('State:', travels.getState());

// Redo will restore all 3 todos
console.log('\n=== Redo (restores all 3 todos) ===');
travels.forward();
console.log('State:', travels.getState());

console.log('\n=== Scenario 2: Multiple archive cycles ===');

// First cycle: Add a todo
travels.setState((draft) => {
  draft.todos.push({ id: 4, text: 'Read book', completed: false });
});
travels.archive();

// Second cycle: Mark multiple todos as completed
travels.setState((draft) => {
  draft.todos[0].completed = true;
});
travels.setState((draft) => {
  draft.todos[1].completed = true;
});
travels.archive();

// Third cycle: Delete a todo
travels.setState((draft) => {
  draft.todos.splice(2, 1);
});
travels.archive();

console.log('Current state:', travels.getState());
console.log('Total history entries:', travels.getPatches().patches.length);

// Undo through the history
console.log('\n=== Undoing step by step ===');
travels.back();
console.log('After undo 1:', travels.getState().todos.length, 'todos');

travels.back();
console.log('After undo 2:', travels.getState().todos);

travels.back();
console.log('After undo 3:', travels.getState().todos.length, 'todos');

console.log('\n=== Scenario 3: Auto-archive on navigation ===');

// Make some unarchived changes
travels.setState((draft) => {
  draft.todos.push({ id: 5, text: 'New task', completed: false });
});
travels.setState((draft) => {
  draft.todos.push({ id: 6, text: 'Another task', completed: false });
});

console.log('Can archive:', travels.canArchive());

// Navigation will auto-archive pending changes
console.log('\n=== Going back (will auto-archive) ===');
travels.back();
console.log('Can archive:', travels.canArchive());
console.log('State:', travels.getState());

// View full history
console.log('\n=== Full history ===');
const history = travels.getHistory();
history.forEach((state, index) => {
  console.log(`Position ${index}:`, state.todos.length, 'todos');
});
