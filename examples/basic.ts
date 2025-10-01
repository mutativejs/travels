/**
 * Basic Usage Example
 *
 * This example demonstrates the basic usage of the Travels library
 * for implementing undo/redo functionality.
 */

import { createTravels } from '../src/index';

// Define your state type
interface AppState {
  count: number;
  text: string;
}

// Create a travels instance with initial state
const travels = createTravels<AppState>({
  count: 0,
  text: 'Hello',
});

// Subscribe to state changes
const unsubscribe = travels.subscribe((state, patches, position) => {
  console.log('State changed:', state);
  console.log('Position:', position);
  console.log('Can undo:', travels.canBack());
  console.log('Can redo:', travels.canForward());
  console.log('---');
});

// Update state using mutation
console.log('=== Making changes ===');
travels.setState((draft) => {
  draft.count = 1;
});

travels.setState((draft) => {
  draft.text = 'World';
});

travels.setState((draft) => {
  draft.count = 2;
  draft.text = 'Travels!';
});

console.log('\n=== Current state ===');
console.log('State:', travels.getState());
console.log('Position:', travels.getPosition());

// Undo operations
console.log('\n=== Undo 2 steps ===');
travels.back(2);
console.log('State:', travels.getState());

// Redo operations
console.log('\n=== Redo 1 step ===');
travels.forward();
console.log('State:', travels.getState());

// View full history
console.log('\n=== Full history ===');
const history = travels.getHistory();
history.forEach((state, index) => {
  console.log(`History[${index}]:`, state);
});

// Navigate to specific position
console.log('\n=== Go to position 0 ===');
travels.go(0);
console.log('State:', travels.getState());

// Reset to initial state
console.log('\n=== Reset ===');
travels.reset();
console.log('State:', travels.getState());
console.log('Position:', travels.getPosition());

// Cleanup
unsubscribe();
