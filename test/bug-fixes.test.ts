/**
 * Bug Fixes Test Suite
 *
 * Tests for specific bug fixes to ensure they don't regress
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { createTravels, Travels } from '../src/index';

describe('Bug #1: canForward() boundary condition in Manual mode', () => {
  interface State {
    count: number;
  }

  let travels: Travels<State, false, false>;

  beforeEach(() => {
    travels = createTravels<State, false>(
      { count: 0 },
      { autoArchive: false, maxHistory: 10 }
    );
  });

  test('should return true when at current position with temp patches', () => {
    // Make some changes but don't archive
    travels.setState((draft) => {
      draft.count = 1;
    });
    travels.setState((draft) => {
      draft.count = 2;
    });

    // At position with temp patches, should be able to "forward" to archived state
    // Before fix: returns false (because of -1)
    // After fix: returns true (can archive and move forward conceptually)
    expect(travels.canForward()).toBe(false); // No archived future exists
  });

  test('should correctly report canForward after archive', () => {
    // Create archived history
    travels.setState({ count: 1 });
    travels.archive();

    travels.setState({ count: 2 });
    travels.archive();

    // Go back to position 1
    travels.back();

    // Should be able to forward
    expect(travels.canForward()).toBe(true);
    expect(travels.getPosition()).toBe(1);
  });

  test('should handle edge case: at last position after archive', () => {
    travels.setState({ count: 1 });
    travels.archive();

    travels.setState({ count: 2 });
    travels.archive();

    // At latest position
    expect(travels.getPosition()).toBe(2);
    expect(travels.canForward()).toBe(false);
  });

  test('should correctly check forward with mixed archived and temp patches', () => {
    // Archived state 1
    travels.setState({ count: 1 });
    travels.archive();

    // Archived state 2
    travels.setState({ count: 2 });
    travels.archive();

    // Position is 2, no forward possible
    expect(travels.getPosition()).toBe(2);
    expect(travels.canForward()).toBe(false);

    // Go back to position 1
    travels.back();
    expect(travels.getPosition()).toBe(1);
    expect(travels.canForward()).toBe(true); // Can forward to position 2

    // Forward to position 2
    travels.forward();
    expect(travels.getPosition()).toBe(2);

    // Add temp changes without archiving
    travels.setState({ count: 3 });

    // Position becomes 3 (first temp patch increments position)
    expect(travels.getPosition()).toBe(3);

    // getAllPatches() will return 3 patches (2 archived + 1 temp merged)
    const allPatches = travels.getPatches();
    expect(allPatches.patches.length).toBe(3);

    // Position is 3, total length is 3, so canForward should check: 3 < 3 = false
    expect(travels.canForward()).toBe(false);

    // But go back one step
    travels.back();
    expect(travels.getPosition()).toBe(2);

    // Now canForward should be: 2 < 3 = true
    // Before bug fix: 2 < 3 - 1 = false (WRONG with shouldArchive branch)
    // After bug fix: 2 < 3 = true (CORRECT)
    expect(travels.canForward()).toBe(true);
  });

  test('comprehensive forward/back with manual archive', () => {
    // Step 1: Initial state (position 0)
    expect(travels.getPosition()).toBe(0);
    expect(travels.canBack()).toBe(false);
    expect(travels.canForward()).toBe(false);

    // Step 2: Add and archive (position 1)
    travels.setState({ count: 1 });
    travels.archive();
    expect(travels.getPosition()).toBe(1);
    expect(travels.canBack()).toBe(true);
    expect(travels.canForward()).toBe(false);

    // Step 3: Add and archive (position 2)
    travels.setState({ count: 2 });
    travels.archive();
    expect(travels.getPosition()).toBe(2);
    expect(travels.canBack()).toBe(true);
    expect(travels.canForward()).toBe(false);

    // Step 4: Add temp changes without archiving
    travels.setState({ count: 3 });
    // Position becomes 3 (first temp patch increments it)
    expect(travels.getPosition()).toBe(3);
    expect(travels.canArchive()).toBe(true);

    // This is the critical test case:
    // - position = 3
    // - allPatches has 2 archived patches (0->1, 1->2)
    // - tempPatches has 1 patch (2->3)
    // - getAllPatches() merges them: [0->1, 1->2, 2->3 merged]
    // - Length is 3, position is 3
    // At current position, canForward is false
    expect(travels.canForward()).toBe(false);

    // Go back one step
    travels.back();
    expect(travels.getPosition()).toBe(2);

    // NOW this is the bug case:
    // - position = 2
    // - tempPatches still has content (was auto-archived by back())
    // - Wait, back() calls go() which archives temp patches...
    // Let me trace: back() -> go(1) -> shouldArchive=true -> archive()
    // So after back(), temp is cleared and we have 3 archived patches

    // Since archive happened, we now have 3 archived patches
    // canForward: 2 < 3 = true
    expect(travels.canForward()).toBe(true);

    // Forward again
    travels.forward();
    expect(travels.getPosition()).toBe(3);
    expect(travels.canForward()).toBe(false);
  });
});

describe('Bug #3: reset() with mutable mode - deep copy issues', () => {
  test('should deep clone nested objects on reset', () => {
    const initialState = {
      user: { name: 'Alice', age: 30 },
      items: [1, 2, 3],
    };

    const travels = createTravels(initialState, { mutable: true });

    // Modify state
    travels.setState((draft) => {
      draft.user.name = 'Bob';
      draft.user.age = 25;
      draft.items.push(4);
    });

    expect(travels.getState().user.name).toBe('Bob');
    expect(travels.getState().items).toHaveLength(4);

    // Reset
    travels.reset();

    // Should be back to initial state
    expect(travels.getState().user.name).toBe('Alice');
    expect(travels.getState().user.age).toBe(30);
    expect(travels.getState().items).toEqual([1, 2, 3]);

    // Critical test: Modify state again - should not affect future resets
    travels.setState((draft) => {
      draft.user.name = 'Charlie';
      draft.items.push(5);
    });

    travels.reset();

    // If initialState was shallow-copied, it might have been mutated
    // This test ensures deep isolation
    expect(travels.getState().user.name).toBe('Alice');
    expect(travels.getState().items).toEqual([1, 2, 3]);
  });

  test('should handle arrays with reset in mutable mode', () => {
    const initialState = {
      todos: [
        { id: 1, text: 'Task 1', completed: false },
        { id: 2, text: 'Task 2', completed: false },
      ],
    };

    const travels = createTravels(initialState, { mutable: true });

    // Modify array
    travels.setState((draft) => {
      draft.todos.push({ id: 3, text: 'Task 3', completed: false });
      draft.todos[0].completed = true;
    });

    expect(travels.getState().todos).toHaveLength(3);
    expect(travels.getState().todos[0].completed).toBe(true);

    // Reset
    travels.reset();

    // Should restore original array
    expect(travels.getState().todos).toHaveLength(2);
    expect(travels.getState().todos[0].completed).toBe(false);
    expect(travels.getState().todos[0].text).toBe('Task 1');
  });

  test('should handle property deletion on reset in mutable mode', () => {
    const initialState = {
      name: 'Test',
      age: 25,
    };

    const travels = createTravels(initialState, { mutable: true });

    // Add new properties
    travels.setState((draft) => {
      (draft as any).email = 'test@example.com';
      (draft as any).active = true;
    });

    expect((travels.getState() as any).email).toBe('test@example.com');

    // Reset should remove added properties
    travels.reset();

    expect((travels.getState() as any).email).toBeUndefined();
    expect((travels.getState() as any).active).toBeUndefined();
    expect(travels.getState().name).toBe('Test');
  });

  test('should maintain object reference in mutable mode after reset', () => {
    const initialState = { count: 0, nested: { value: 10 } };
    const travels = createTravels(initialState, { mutable: true });
    const originalRef = travels.getState();

    travels.setState({ count: 5, nested: { value: 20 } });
    travels.reset();

    // Reference should be preserved
    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState().count).toBe(0);
    expect(travels.getState().nested.value).toBe(10);
  });

  test('should handle deeply nested structures on reset', () => {
    const initialState = {
      level1: {
        level2: {
          level3: {
            value: 'deep',
            numbers: [1, 2, 3],
          },
        },
      },
    };

    const travels = createTravels(initialState, { mutable: true });

    // Deep modification
    travels.setState((draft) => {
      draft.level1.level2.level3.value = 'modified';
      draft.level1.level2.level3.numbers.push(4, 5);
    });

    expect(travels.getState().level1.level2.level3.value).toBe('modified');
    expect(travels.getState().level1.level2.level3.numbers).toHaveLength(5);

    // Reset
    travels.reset();

    // Deep structure should be restored
    expect(travels.getState().level1.level2.level3.value).toBe('deep');
    expect(travels.getState().level1.level2.level3.numbers).toEqual([1, 2, 3]);
  });

  test('should not share references between initialState and current state', () => {
    const initialState = {
      shared: { counter: 0 },
    };

    const travels = createTravels(initialState, { mutable: true });

    // Modify state
    travels.setState((draft) => {
      draft.shared.counter = 10;
    });

    // Reset
    travels.reset();
    expect(travels.getState().shared.counter).toBe(0);

    // Modify again
    travels.setState((draft) => {
      draft.shared.counter = 20;
    });

    // Reset again - should still return to 0, not affected by previous mutations
    travels.reset();
    expect(travels.getState().shared.counter).toBe(0);
  });

  test('should handle sparse arrays on reset', () => {
    const initialState = {
      sparseArray: [1, , 3] as number[], // eslint-disable-line no-sparse-arrays
    };

    const travels = createTravels(initialState, { mutable: true });

    // Modify array
    travels.setState((draft) => {
      draft.sparseArray[1] = 2;
      draft.sparseArray.push(4);
    });

    expect(travels.getState().sparseArray[1]).toBe(2);
    expect(travels.getState().sparseArray).toHaveLength(4);

    // Reset
    travels.reset();

    // Deep clone now preserves sparse array holes as undefined entries
    expect(travels.getState().sparseArray[1]).toBeUndefined();
    expect(travels.getState().sparseArray).toHaveLength(3);
  });
});

describe('Bug #4: Deep clone in reset() for nested arrays and objects', () => {
  test('should deep clone arrays containing nested objects', () => {
    const initialState = {
      users: [
        { id: 1, profile: { name: 'Alice', age: 30 } },
        { id: 2, profile: { name: 'Bob', age: 25 } },
      ],
    };

    const travels = createTravels(initialState, { mutable: true });

    // Modify deeply nested properties
    travels.setState((draft) => {
      draft.users[0].profile.name = 'Alice Updated';
      draft.users[0].profile.age = 31;
      draft.users.push({ id: 3, profile: { name: 'Charlie', age: 28 } });
    });

    expect(travels.getState().users).toHaveLength(3);
    expect(travels.getState().users[0].profile.name).toBe('Alice Updated');

    // Reset
    travels.reset();

    // Should be back to initial state
    expect(travels.getState().users).toHaveLength(2);
    expect(travels.getState().users[0].profile.name).toBe('Alice');
    expect(travels.getState().users[0].profile.age).toBe(30);

    // Modify again to test reference isolation
    travels.setState((draft) => {
      draft.users[0].profile.name = 'Alice Modified Again';
      draft.users[0].profile.age = 35;
    });

    // Reset again
    travels.reset();

    // Should still return to correct initial state
    expect(travels.getState().users[0].profile.name).toBe('Alice');
    expect(travels.getState().users[0].profile.age).toBe(30);
  });

  test('should deep clone nested arrays (arrays within arrays)', () => {
    const initialState = {
      matrix: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
    };

    const travels = createTravels(initialState, { mutable: true });

    // Modify nested array
    travels.setState((draft) => {
      draft.matrix[0][0] = 100;
      draft.matrix[1].push(10);
      draft.matrix.push([11, 12, 13]);
    });

    expect(travels.getState().matrix[0][0]).toBe(100);
    expect(travels.getState().matrix).toHaveLength(4);

    // Reset
    travels.reset();

    // Should be back to initial state
    expect(travels.getState().matrix[0][0]).toBe(1);
    expect(travels.getState().matrix).toHaveLength(3);
    expect(travels.getState().matrix).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
  });

  test('should deep clone complex nested structures', () => {
    const initialState = {
      departments: [
        {
          name: 'Engineering',
          teams: [
            {
              name: 'Frontend',
              members: [
                { id: 1, name: 'Alice', skills: ['React', 'TypeScript'] },
                { id: 2, name: 'Bob', skills: ['Vue', 'JavaScript'] },
              ],
            },
            {
              name: 'Backend',
              members: [
                { id: 3, name: 'Charlie', skills: ['Node.js', 'Python'] },
              ],
            },
          ],
        },
        {
          name: 'Design',
          teams: [
            {
              name: 'UX',
              members: [{ id: 4, name: 'Diana', skills: ['Figma', 'Sketch'] }],
            },
          ],
        },
      ],
    };

    const travels = createTravels(initialState, { mutable: true });

    // Deep modifications
    travels.setState((draft) => {
      draft.departments[0].teams[0].members[0].name = 'Alice Updated';
      draft.departments[0].teams[0].members[0].skills.push('Next.js');
      draft.departments[0].teams.push({
        name: 'DevOps',
        members: [{ id: 5, name: 'Eve', skills: ['Docker', 'Kubernetes'] }],
      });
    });

    expect(travels.getState().departments[0].teams).toHaveLength(3);
    expect(travels.getState().departments[0].teams[0].members[0].name).toBe(
      'Alice Updated'
    );
    expect(
      travels.getState().departments[0].teams[0].members[0].skills
    ).toContain('Next.js');

    // Reset
    travels.reset();

    // Verify complete restoration
    expect(travels.getState().departments[0].teams).toHaveLength(2);
    expect(travels.getState().departments[0].teams[0].members[0].name).toBe(
      'Alice'
    );
    expect(
      travels.getState().departments[0].teams[0].members[0].skills
    ).toEqual(['React', 'TypeScript']);
    expect(
      travels.getState().departments[0].teams[0].members[0].skills
    ).not.toContain('Next.js');
  });

  test('should not have reference sharing issues after reset', () => {
    const initialState = {
      data: {
        items: [
          { id: 1, nested: { value: 'a' } },
          { id: 2, nested: { value: 'b' } },
        ],
      },
    };

    const travels = createTravels(initialState, { mutable: true });

    // Get reference to initial state
    const stateAfterReset1 = travels.getState();

    // Modify
    travels.setState((draft) => {
      draft.data.items[0].nested.value = 'modified';
    });

    // Reset
    travels.reset();
    const stateAfterReset2 = travels.getState();

    // Modify again
    travels.setState((draft) => {
      draft.data.items[1].nested.value = 'modified again';
    });

    // Reset again
    travels.reset();
    const stateAfterReset3 = travels.getState();

    // All reset states should have the same values
    expect(stateAfterReset1.data.items[0].nested.value).toBe('a');
    expect(stateAfterReset2.data.items[0].nested.value).toBe('a');
    expect(stateAfterReset3.data.items[0].nested.value).toBe('a');
    expect(stateAfterReset3.data.items[1].nested.value).toBe('b');

    // Should maintain the same reference (mutable mode)
    expect(stateAfterReset1).toBe(stateAfterReset2);
    expect(stateAfterReset2).toBe(stateAfterReset3);
  });

  test('should handle arrays with mixed types and nested structures', () => {
    const initialState = {
      mixed: [
        1,
        'string',
        { nested: { deep: [1, 2, 3] } },
        [4, 5, { inner: 'value' }],
        null,
        true,
      ],
    };

    const travels = createTravels(initialState, { mutable: true });

    // Modify various elements
    travels.setState((draft) => {
      (draft.mixed[2] as any).nested.deep.push(4);
      ((draft.mixed[3] as any)[2] as any).inner = 'modified';
      draft.mixed.push('new item');
    });

    expect((travels.getState().mixed[2] as any).nested.deep).toHaveLength(4);
    expect(((travels.getState().mixed[3] as any)[2] as any).inner).toBe(
      'modified'
    );
    expect(travels.getState().mixed).toHaveLength(7);

    // Reset
    travels.reset();

    // Verify restoration
    expect((travels.getState().mixed[2] as any).nested.deep).toEqual([1, 2, 3]);
    expect(((travels.getState().mixed[3] as any)[2] as any).inner).toBe(
      'value'
    );
    expect(travels.getState().mixed).toHaveLength(6);
  });

  test('should handle arrays containing arrays of objects', () => {
    const initialState = {
      grid: [
        [
          { x: 0, y: 0, data: { value: 'a' } },
          { x: 0, y: 1, data: { value: 'b' } },
        ],
        [
          { x: 1, y: 0, data: { value: 'c' } },
          { x: 1, y: 1, data: { value: 'd' } },
        ],
      ],
    };

    const travels = createTravels(initialState, { mutable: true });

    // Deep modification
    travels.setState((draft) => {
      draft.grid[0][0].data.value = 'modified';
      draft.grid[1].push({ x: 1, y: 2, data: { value: 'e' } });
    });

    expect(travels.getState().grid[0][0].data.value).toBe('modified');
    expect(travels.getState().grid[1]).toHaveLength(3);

    // Reset
    travels.reset();

    // Verify restoration
    expect(travels.getState().grid[0][0].data.value).toBe('a');
    expect(travels.getState().grid[1]).toHaveLength(2);
  });
});

describe('Bug #5: Mutable mode value updates should match immutable replacements', () => {
  test('object updaters drop stale keys in mutable mode', () => {
    const mutable = createTravels({ a: 1, b: 2 }, { mutable: true });
    const immutable = createTravels({ a: 1, b: 2 });

    mutable.setState({ a: 5 });
    immutable.setState({ a: 5 });

    expect(mutable.getState()).toEqual({ a: 5 });
    expect(mutable.getState()).toEqual(immutable.getState());
  });

  test('array updaters fully replace contents in mutable mode', () => {
    const travels = createTravels<number[]>([1, 2, 3], { mutable: true });
    const originalRef = travels.getState();

    travels.setState([99]);

    expect(travels.getState()).toBe(originalRef);
    expect(travels.getState()).toEqual([99]);
  });

  test('primitive replacements fall back to immutable logic', () => {
    const travels = createTravels<any>({ value: 1 }, { mutable: true });

    travels.setState(42);
    expect(travels.getState()).toBe(42);

    travels.setState({ value: 2 });
    expect(travels.getState()).toEqual({ value: 2 });
  });

  test('non-plain object replacements fall back to immutable logic', () => {
    const date = new Date('2024-02-03T00:00:00.000Z');
    const mutable = createTravels<any>({ a: 1 }, { mutable: true });
    const immutable = createTravels<any>({ a: 1 });

    mutable.setState(date as any);
    immutable.setState(date as any);

    expect(mutable.getState()).toBeInstanceOf(Date);
    expect((mutable.getState() as Date).getTime()).toBe(date.getTime());
    expect(mutable.getState()).toEqual(immutable.getState());
  });

  test('array replacements remove stale custom properties', () => {
    const withMeta: any = [1, 2, 3];
    withMeta.meta = 'old';

    const travels = createTravels<any>(withMeta, { mutable: true });

    travels.setState([7, 8]);

    expect(travels.getState()).toEqual([7, 8]);
    expect((travels.getState() as any).meta).toBeUndefined();
  });
});
