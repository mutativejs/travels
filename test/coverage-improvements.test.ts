import { expect, describe, test } from 'vitest';
import { createTravels } from '../src/index';

/**
 * Additional tests to improve code coverage
 * Targets specific uncovered lines identified in coverage report
 */

describe('Coverage Improvements', () => {
  describe('archive() with maxHistory exceeded', () => {
    test('should enforce maxHistory limit during archive (lines 366-370)', () => {
      // Target: Lines 366-370 in index.ts
      // When archiving with manual mode and maxHistory is exceeded,
      // the patches should be sliced to respect the limit

      interface State {
        count: number;
      }

      const travels = createTravels<State>(
        { count: 0 },
        {
          autoArchive: false,
          maxHistory: 3, // Small limit to easily exceed
        }
      );

      // Create 5 archive cycles (exceeds maxHistory of 3)
      for (let i = 1; i <= 5; i++) {
        travels.setState((draft) => {
          draft.count = i;
        });
        travels.archive();
      }

      // Should only keep the last 3 patches
      const patches = travels.getPatches();
      expect(patches.patches.length).toBe(3);
      expect(patches.inversePatches.length).toBe(3);

      // Verify history is correct
      const history = travels.getHistory();
      expect(history.length).toBe(4); // 3 patches + initial state
      expect(history[0].count).toBe(2); // First state after truncation
      expect(history[3].count).toBe(5); // Last state
    });

    test('should handle maxHistory = 1 with archive', () => {
      interface State {
        value: string;
      }

      const travels = createTravels<State>(
        { value: 'a' },
        {
          autoArchive: false,
          maxHistory: 1,
        }
      );

      // Archive multiple times
      travels.setState({ value: 'b' });
      travels.archive();

      travels.setState({ value: 'c' });
      travels.archive();

      travels.setState({ value: 'd' });
      travels.archive();

      // Should only keep 1 patch
      const patches = travels.getPatches();
      expect(patches.patches.length).toBe(1);

      // Can only go back one step
      travels.back();
      expect(travels.getState().value).toBe('c');
      expect(travels.canBack()).toBe(false); // Can't go further back
    });
  });

  describe('reset() in mutable mode with extra properties', () => {
    test('should delete extra properties during reset for mutable mode (lines 524-525)', () => {
      // Target: Lines 524-525 in index.ts
      // When resetting in mutable mode, properties that exist in current state
      // but not in initial state should be deleted

      interface State {
        count: number;
        name: string;
        [key: string]: any; // Allow dynamic properties
      }

      const travels = createTravels<State>(
        { count: 0, name: 'initial' },
        { mutable: true }
      );

      const stateRef = travels.getState();

      // Add extra properties
      travels.setState((draft: any) => {
        draft.count = 5;
        draft.name = 'updated';
        draft.extra1 = 'should be removed';
        draft.extra2 = 123;
        draft.extra3 = { nested: true };
      });

      // Verify extra properties exist
      const beforeReset = travels.getState();
      expect((beforeReset as any).extra1).toBe('should be removed');
      expect((beforeReset as any).extra2).toBe(123);
      expect((beforeReset as any).extra3).toEqual({ nested: true });

      // Reset should delete extra properties
      travels.reset();

      const afterReset = travels.getState();
      expect(afterReset.count).toBe(0);
      expect(afterReset.name).toBe('initial');
      expect((afterReset as any).extra1).toBeUndefined();
      expect((afterReset as any).extra2).toBeUndefined();
      expect((afterReset as any).extra3).toBeUndefined();

      // Should preserve reference in mutable mode
      expect(afterReset).toBe(stateRef);
    });

    test('should handle multiple levels of extra properties in mutable reset', () => {
      interface State {
        core: {
          id: number;
          [key: string]: any;
        };
        [key: string]: any;
      }

      const travels = createTravels<State>(
        { core: { id: 1 } },
        { mutable: true }
      );

      // Add multiple extra properties at different levels
      travels.setState((draft: any) => {
        draft.core.id = 2;
        draft.core.extra = 'nested extra';
        draft.topLevel1 = 'top 1';
        draft.topLevel2 = 'top 2';
        draft.topLevel3 = 'top 3';
      });

      travels.reset();

      const state = travels.getState() as any;
      expect(state.core.id).toBe(1);
      expect(state.core.extra).toBeUndefined();
      expect(state.topLevel1).toBeUndefined();
      expect(state.topLevel2).toBeUndefined();
      expect(state.topLevel3).toBeUndefined();
    });
  });

  describe('getControls() with manual archive mode', () => {
    test('should include archive() and canArchive() in manual mode controls (lines 605, 607)', () => {
      // Target: Lines 605, 607 in index.ts
      // When autoArchive is false, getControls() should return archive and canArchive methods

      interface State {
        value: number;
      }

      const travels = createTravels<State>(
        { value: 0 },
        { autoArchive: false }
      );

      const controls = travels.getControls();

      // Verify archive and canArchive methods exist
      expect(controls.archive).toBeDefined();
      expect(controls.canArchive).toBeDefined();
      expect(typeof controls.archive).toBe('function');
      expect(typeof controls.canArchive).toBe('function');

      // Test canArchive
      expect(controls.canArchive()).toBe(false); // No changes yet

      travels.setState({ value: 1 });
      expect(controls.canArchive()).toBe(true); // Has unarchived changes

      controls.archive();
      expect(controls.canArchive()).toBe(false); // Archived

      // Test archive functionality through controls
      travels.setState({ value: 2 });
      travels.setState({ value: 3 });
      expect(controls.canArchive()).toBe(true);

      controls.archive(); // Archive through controls
      expect(controls.canArchive()).toBe(false);

      // Should have 2 patches now
      expect(travels.getPatches().patches.length).toBe(2);
    });

    test('should NOT include archive/canArchive in auto mode controls', () => {
      interface State {
        value: number;
      }

      const travels = createTravels<State>(
        { value: 0 },
        { autoArchive: true } // Auto mode
      );

      const controls = travels.getControls();

      // archive and canArchive should not exist in auto mode
      expect((controls as any).archive).toBeUndefined();
      expect((controls as any).canArchive).toBeUndefined();
    });

    test('should work with controls from manual archive mode', () => {
      interface TodoState {
        items: string[];
      }

      const travels = createTravels<TodoState>(
        { items: [] },
        { autoArchive: false }
      );

      const controls = travels.getControls();

      // Add items without archiving
      travels.setState((draft) => {
        draft.items.push('item1');
      });
      travels.setState((draft) => {
        draft.items.push('item2');
      });
      travels.setState((draft) => {
        draft.items.push('item3');
      });

      expect(controls.canArchive()).toBe(true);
      controls.archive();
      expect(controls.canArchive()).toBe(false);

      // Undo should go back to empty
      controls.back();
      expect(travels.getState().items).toEqual([]);
      expect(controls.canBack()).toBe(false);

      // Redo
      controls.forward();
      expect(travels.getState().items).toEqual(['item1', 'item2', 'item3']);
      expect(controls.canForward()).toBe(false);
    });
  });


  describe('maxHistory in auto-archive mode', () => {
    test('should enforce maxHistory limit in setState with auto-archive (lines 294-300)', () => {
      // Target: Lines 294-300 - maxHistory enforcement in setState

      interface State {
        value: number;
      }

      const travels = createTravels<State>(
        { value: 0 },
        {
          autoArchive: true, // Auto-archive mode
          maxHistory: 2,
        }
      );

      // Each setState auto-archives
      travels.setState({ value: 1 });
      travels.setState({ value: 2 });
      travels.setState({ value: 3 });
      travels.setState({ value: 4 });

      // Should only keep last 2 patches
      const patches = travels.getPatches();
      expect(patches.patches.length).toBe(2);

      // Position should be capped at maxHistory
      expect(travels.getPosition()).toBe(2);

      // Verify current state
      expect(travels.getState().value).toBe(4);

      // Can go back 2 steps to window start (not initial state)
      // With maxHistory: 2, history window is [2, 3, 4]
      travels.back(2);
      expect(travels.getState().value).toBe(2); // Back to window start

      // Can still reset to true initial state
      travels.reset();
      expect(travels.getState().value).toBe(0);
    });

    test('should handle maxHistory = 1 in auto-archive mode', () => {
      const travels = createTravels(
        { count: 0 },
        { autoArchive: true, maxHistory: 1 }
      );

      travels.setState({ count: 1 });
      travels.setState({ count: 2 });
      travels.setState({ count: 3 });

      // Should only keep 1 patch
      const patches = travels.getPatches();
      expect(patches.patches.length).toBe(1);

      // Can only go back one step
      travels.back();
      expect(travels.getState().count).toBe(2);
      expect(travels.canBack()).toBe(false);
    });

    test('should handle mixed operations with maxHistory in auto mode', () => {
      const travels = createTravels(
        { id: 0, name: '' },
        { autoArchive: true, maxHistory: 3 }
      );

      // Create 5 changes
      travels.setState({ id: 1, name: 'a' });
      travels.setState({ id: 2, name: 'b' });
      travels.setState({ id: 3, name: 'c' });
      travels.setState({ id: 4, name: 'd' });
      travels.setState({ id: 5, name: 'e' });

      const patches = travels.getPatches();
      expect(patches.patches.length).toBe(3);

      // Position should be capped at maxHistory
      expect(travels.getPosition()).toBe(3);

      // Should be able to go back 3 steps to window start (not initial state)
      // With maxHistory: 3, history window is [2, 3, 4, 5]
      travels.back();
      expect(travels.getPosition()).toBe(2);
      travels.back();
      expect(travels.getPosition()).toBe(1);
      travels.back();
      expect(travels.getPosition()).toBe(0);
      expect(travels.getState().id).toBe(2); // Back to window start
      expect(travels.canBack()).toBe(false);

      // Can still reset to true initial state
      travels.reset();
      expect(travels.getState().id).toBe(0);
    });

    test('back(amount): should handle mixed operations with maxHistory in auto mode', () => {
      const travels = createTravels(
        { id: 0, name: '' },
        { autoArchive: true, maxHistory: 3 }
      );

      // Create 5 changes
      travels.setState({ id: 1, name: 'a' });
      travels.setState({ id: 2, name: 'b' });
      travels.setState({ id: 3, name: 'c' });
      travels.setState({ id: 4, name: 'd' });
      travels.setState({ id: 5, name: 'e' });

      const patches = travels.getPatches();
      expect(patches.patches.length).toBe(3);

      // Position should be capped at maxHistory
      expect(travels.getPosition()).toBe(3);

      // Should be able to go back 3 steps to window start (not initial state)
      // With maxHistory: 3, history window is [2, 3, 4, 5]
      travels.back(3);
      expect(travels.getState().id).toBe(2); // Back to window start
      expect(travels.canBack()).toBe(false);

      // Can still reset to true initial state
      travels.reset();
      expect(travels.getState().id).toBe(0);
    });
  });

  describe('Edge cases for complete coverage', () => {
    test('should handle maxHistory with both archive and setState', () => {
      const travels = createTravels(
        { count: 0 },
        { maxHistory: 2, autoArchive: false }
      );

      // Mix of archived and manual operations
      travels.setState({ count: 1 });
      travels.archive();

      travels.setState({ count: 2 });
      travels.archive();

      travels.setState({ count: 3 });
      travels.archive();

      // Should respect maxHistory
      const patches = travels.getPatches();
      expect(patches.patches.length).toBe(2);
    });

    test('should handle mutable reset with no extra properties', () => {
      interface State {
        id: number;
        name: string;
      }

      const travels = createTravels<State>(
        { id: 1, name: 'test' },
        { mutable: true }
      );

      travels.setState({ id: 2, name: 'updated' });
      travels.reset();

      const state = travels.getState();
      expect(state.id).toBe(1);
      expect(state.name).toBe('test');
      expect(Object.keys(state).sort()).toEqual(['id', 'name']);
    });

    test('should handle archive with large maxHistory', () => {
      const travels = createTravels(
        { value: 0 },
        { autoArchive: false, maxHistory: 1000 }
      );

      travels.setState({ value: 1 });
      travels.archive();

      travels.setState({ value: 2 });
      travels.archive();

      travels.setState({ value: 3 });
      travels.archive();

      // Should keep all patches when maxHistory is large enough
      const patches = travels.getPatches();
      expect(patches.patches.length).toBe(3);
    });
  });
});
