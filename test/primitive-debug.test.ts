import { describe, test, expect } from 'vitest';
import { createTravels } from '../src/index';

describe('Debug primitive issues', () => {
  test('simple reset with primitives', () => {
    const travels = createTravels<string>('start', { mutable: true });

    console.log('Initial state:', travels.getState());
    console.log('Initial history:', travels.getHistory());

    travels.setState(() => 'middle');
    console.log('After setState(middle):', travels.getState());
    console.log('History:', travels.getHistory());

    travels.setState(() => 'end');
    console.log('After setState(end):', travels.getState());
    console.log('History:', travels.getHistory());

    console.log('Position before reset:', travels.getPosition());
    console.log('Patches before reset:', JSON.stringify(travels.getPatches(), null, 2));

    travels.reset();
    console.log('After reset:', travels.getState());
    console.log('Position after reset:', travels.getPosition());
    console.log('Patches after reset:', JSON.stringify(travels.getPatches(), null, 2));

    const history = travels.getHistory();
    console.log('History after reset:', history);

    // The issue: getHistory() returns only ['start'] after reset
    expect(history.length).toBeGreaterThan(0);
  });

  test('type transition issue', () => {
    const travels = createTravels<number | { count: number }>(0, {
      mutable: true,
    });

    travels.setState(() => 1);
    travels.setState(() => 2);

    console.log('Before transition:', travels.getState());
    console.log('Position:', travels.getPosition());

    travels.setState(() => ({ count: 3 }));
    console.log('After transition to object:', travels.getState());
    console.log('Position:', travels.getPosition());
    console.log('Patches:', JSON.stringify(travels.getPatches(), null, 2));

    travels.back();
    console.log('After back():', travels.getState());
    console.log('Expected: 2, Actual:', travels.getState());
  });
});
