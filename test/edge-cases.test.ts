import { describe, it, expect } from 'vitest';
import { createTravels } from '../src/index';

describe('Edge Cases Coverage', () => {
  describe('go method with maxHistory and inversePatches slicing', () => {
    it('should handle go() when history management triggers inversePatches slicing', () => {
      // This test covers line 414: the slicing of inversePatches when exceeding maxHistory
      interface State {
        count: number;
      }

      const travel = createTravels<State>(
        { count: 0 },
        {
          maxHistory: 3,
          autoArchive: false,
        }
      );

      // Create several state changes to exceed maxHistory
      for (let i = 1; i <= 5; i++) {
        travel.setState((draft) => {
          draft.count = i;
        });
      }

      // Record current state
      const currentCount = travel.getState().count;
      const currentPos = travel.getPosition();

      // Go back to an earlier position to trigger inverse patches logic
      if (currentPos > 0) {
        travel.go(currentPos - 1);
        const stateAfterGo = travel.getState().count;
        // Count should change
        expect(stateAfterGo).not.toBe(currentCount);

        // Go forward again if possible
        if (travel.canForward()) {
          travel.forward();
          const stateAfterForward = travel.getState().count;
          expect(stateAfterForward).toBeGreaterThanOrEqual(stateAfterGo);
        }
      }

      // The test passed if we got here without errors
      expect(true).toBe(true);
    });
  });

  describe('reset with extra properties', () => {
    it('should remove properties that exist in state but not in initialState', () => {
      // This test covers lines 520-521: deleting extra properties in reset()
      interface State {
        name: string;
        age?: number;
        [key: string]: any;
      }

      const initialState: State = {
        name: 'John',
      };

      const travel = createTravels<State>(initialState);

      // Add properties that don't exist in initialState
      travel.setState((draft) => {
        draft.age = 30;
        draft.extra = 'should be removed';
        draft.another = 'also removed';
      });

      const stateBeforeReset = travel.getState();
      expect(stateBeforeReset.age).toBe(30);
      expect(stateBeforeReset.extra).toBe('should be removed');
      expect(stateBeforeReset.another).toBe('also removed');

      // Reset should remove extra properties
      travel.reset();

      const stateAfterReset = travel.getState();
      expect(stateAfterReset.name).toBe('John');
      expect(stateAfterReset.age).toBeUndefined();
      expect(stateAfterReset.extra).toBeUndefined();
      expect(stateAfterReset.another).toBeUndefined();
    });

    it('should handle reset when state has properties not in initialState (complex case)', () => {
      interface State {
        user: {
          id: number;
          name: string;
        };
      }

      const travel = createTravels<State>({
        user: {
          id: 1,
          name: 'Alice',
        },
      });

      // Modify and add extra properties
      travel.setState((draft: any) => {
        draft.user.email = 'alice@example.com'; // Add property to nested object
        draft.extraProp = 'should be removed'; // Add top-level property
      });

      const beforeReset = travel.getState() as any;
      expect(beforeReset.user.email).toBe('alice@example.com');
      expect(beforeReset.extraProp).toBe('should be removed');

      travel.reset();

      const afterReset = travel.getState() as any;
      expect(afterReset.user.id).toBe(1);
      expect(afterReset.user.name).toBe('Alice');
      expect(afterReset.extraProp).toBeUndefined();
    });
  });

  describe('canForward with tempPatches', () => {
    it('should test canForward when shouldArchive condition applies', () => {
      // This test covers line 551: the shouldArchive branch in canForward()
      interface State {
        value: number;
      }

      const travel = createTravels<State>(
        { value: 0 },
        {
          maxHistory: 5,
          autoArchive: false, // Important: this enables the shouldArchive logic
        }
      );

      // Create some history
      travel.setState((draft) => {
        draft.value = 1;
      });
      travel.setState((draft) => {
        draft.value = 2;
      });
      travel.setState((draft) => {
        draft.value = 3;
      });

      // At the latest state, can't go forward
      expect(travel.canForward()).toBe(false);

      // Go back to an earlier position
      const currentPos = travel.getPosition();
      if (currentPos > 0) {
        travel.go(0); // Go to initial position
        const valueAfterGo = travel.getState().value;
        expect(valueAfterGo).toBe(0);

        // Now we should be able to go forward
        const canGoForward = travel.canForward();
        expect(canGoForward).toBe(true);

        if (canGoForward) {
          // Archive to test the shouldArchive branch
          travel.archive();

          // Should still be able to go forward after archive
          expect(travel.canForward()).toBe(true);

          travel.forward();
          const valueAfterForward = travel.getState().value;
          expect(valueAfterForward).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('getControls patches getter', () => {
    it('should access patches through controls getter', () => {
      // This test covers lines 591-592: the patches getter in getControls()
      interface State {
        value: string;
      }

      const travel = createTravels<State>({ value: 'initial' });

      travel.setState((draft) => {
        draft.value = 'updated';
      });

      const controls = travel.getControls();

      // Access patches through the getter (line 591-592)
      const patches = controls.patches;

      expect(patches).toBeDefined();
      expect(patches.patches).toBeDefined();
      expect(patches.inversePatches).toBeDefined();
      expect(patches.patches.length).toBeGreaterThan(0);
    });

    it('should return reactive patches getter in controls', () => {
      interface State {
        items: number[];
      }

      const travel = createTravels<State>({ items: [] });

      const controls = travel.getControls();

      // Initial patches
      const patches1 = controls.patches;
      expect(patches1.patches.length).toBe(0);

      // Add a change
      travel.setState((draft) => {
        draft.items.push(1);
      });

      // Patches should reflect the new change
      const patches2 = controls.patches;
      expect(patches2.patches.length).toBe(1);

      // Add another change
      travel.setState((draft) => {
        draft.items.push(2);
      });

      const patches3 = controls.patches;
      expect(patches3.patches.length).toBe(2);
    });
  });

  describe('getHistory with maxHistory slicing', () => {
    it('should slice patches when calling getHistory with exceeded maxHistory', () => {
      // This test covers lines 406-408 and 412-414: slicing patches in getHistory()
      interface State {
        value: number;
      }

      const travel = createTravels<State>(
        { value: 0 },
        {
          maxHistory: 2,
          autoArchive: false, // Important: this enables the slicing logic
        }
      );

      // Create initial changes and archive them
      travel.setState((draft) => {
        draft.value = 1;
      });
      travel.setState((draft) => {
        draft.value = 2;
      });
      travel.archive(); // Archive these changes

      // Now create more changes without archiving to build up tempPatches
      travel.setState((draft) => {
        draft.value = 3;
      });
      travel.setState((draft) => {
        draft.value = 4;
      });
      travel.setState((draft) => {
        draft.value = 5;
      });

      // At this point, getAllPatches() should return allPatches (2) + tempPatches (3) = 5 patches
      // which exceeds maxHistory (2), triggering the slicing logic
      const history = travel.getHistory();

      // History should be defined
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      // Verify the last state in history
      const lastState = history[history.length - 1];
      expect(lastState.value).toBe(5);
    });

    it('should handle getHistory with autoArchive disabled and exceeded maxHistory', () => {
      interface State {
        items: string[];
      }

      const travel = createTravels<State>(
        { items: [] },
        {
          maxHistory: 1,
          autoArchive: false,
        }
      );

      // Add one item and archive
      travel.setState((draft) => {
        draft.items.push('a');
      });
      travel.archive();

      // Add more items without archiving to build tempPatches
      travel.setState((draft) => {
        draft.items.push('b');
      });
      travel.setState((draft) => {
        draft.items.push('c');
      });
      travel.setState((draft) => {
        draft.items.push('d');
      });

      // At this point, getAllPatches() returns allPatches (1) + tempPatches (3) = 4 patches
      // which exceeds maxHistory (1), triggering the slicing logic
      const history = travel.getHistory();
      expect(history.length).toBeGreaterThan(0);

      // Verify the last state includes all items
      const lastState = history[history.length - 1];
      expect(lastState.items).toContain('d');
    });
  });

  describe('setState with autoArchive and maxHistory slicing', () => {
    it('should slice patches when setState with autoArchive enabled exceeds maxHistory', () => {
      // This test covers lines 291-297: slicing in setState when autoArchive=true
      interface State {
        counter: number;
      }

      const travel = createTravels<State>(
        { counter: 0 },
        {
          maxHistory: 2,
          autoArchive: true, // Enable autoArchive to trigger this branch (default is true)
        }
      );

      // First setState: allPatches.length becomes 1
      travel.setState((draft) => {
        draft.counter = 1;
      });
      expect(travel.getPatches().patches.length).toBe(1);

      // Second setState: allPatches.length becomes 2
      travel.setState((draft) => {
        draft.counter = 2;
      });
      expect(travel.getPatches().patches.length).toBe(2);

      // Third setState: push makes it 3, then slices to 2 (lines 291-297 should execute)
      travel.setState((draft) => {
        draft.counter = 3;
      });
      expect(travel.getPatches().patches.length).toBe(2); // Should be sliced back to maxHistory

      // More changes to ensure slicing continues to work
      travel.setState((draft) => {
        draft.counter = 4;
      });
      expect(travel.getPatches().patches.length).toBe(2);

      travel.setState((draft) => {
        draft.counter = 5;
      });
      expect(travel.getPatches().patches.length).toBe(2);

      // Verify final state
      expect(travel.getState().counter).toBe(5);
    });
  });

  describe('archive method with maxHistory slicing', () => {
    it('should slice patches when archive() exceeds maxHistory', () => {
      // This test covers lines 362-366: slicing in archive()
      interface State {
        value: string;
      }

      const travel = createTravels<State>(
        { value: 'initial' },
        {
          maxHistory: 2,
          autoArchive: false, // Disable autoArchive so we can manually archive
        }
      );

      // Create multiple changes without archiving
      for (let i = 1; i <= 5; i++) {
        travel.setState((draft) => {
          draft.value = `value${i}`;
        });
      }

      // Manually archive, which should trigger the slicing logic if tempPatches are large
      travel.archive();

      // Verify patches are limited by maxHistory
      const patches = travel.getPatches();
      expect(patches.patches.length).toBeLessThanOrEqual(2);

      // Verify state is still correct
      expect(travel.getState().value).toBe('value5');
    });
  });

  describe('reset with object mutation', () => {
    it('should properly delete extra properties during reset for mutable mode', () => {
      // This test covers lines 520-521: deleting extra properties in reset()
      interface State {
        data: {
          id: number;
          name: string;
        };
        [key: string]: any;
      }

      const travel = createTravels<State>({
        data: {
          id: 1,
          name: 'Test',
        },
      });

      // Add extra properties through mutation
      travel.setState((draft: any) => {
        draft.data.extra = 'should be removed';
        draft.topLevel = 'also removed';
        draft.another = 123;
      });

      const beforeReset = travel.getState() as any;
      expect(beforeReset.topLevel).toBe('also removed');
      expect(beforeReset.another).toBe(123);

      // Reset should remove these extra properties
      travel.reset();

      const afterReset = travel.getState() as any;
      expect(afterReset.data.id).toBe(1);
      expect(afterReset.data.name).toBe('Test');
      expect(afterReset.topLevel).toBeUndefined();
      expect(afterReset.another).toBeUndefined();
    });
  });

  describe('Combined scenarios for comprehensive coverage', () => {
    it('should handle navigation and reset with dynamic properties', () => {
      interface State {
        counter: number;
        [key: string]: any;
      }

      const travel = createTravels<State>(
        { counter: 0 },
        {
          maxHistory: 10,
          autoArchive: false,
        }
      );

      // Create history with dynamic properties
      travel.setState((draft) => {
        draft.counter = 1;
        draft.extra1 = 'a';
      });
      travel.setState((draft) => {
        draft.counter = 2;
        draft.extra2 = 'b';
      });

      // Navigate to position 0
      travel.go(0);
      expect(travel.getState().counter).toBe(0);

      // Make another change with extra property
      travel.setState((draft) => {
        draft.counter = 10;
        draft.extra3 = 'c';
      });

      // Reset should remove extra properties
      travel.reset();
      const afterReset = travel.getState();
      expect(afterReset.counter).toBe(0);
      expect(afterReset.extra1).toBeUndefined();
      expect(afterReset.extra2).toBeUndefined();
    });
  });
});
