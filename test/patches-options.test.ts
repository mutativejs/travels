import { expect, describe, test } from 'vitest';
import { createTravels } from '../src/index';

/**
 * Test suite for patchesOptions configuration
 * Tests pathAsArray and arrayLengthAssignment options
 */
describe('PatchesOptions Configuration', () => {
  interface AppState {
    count: number;
    items: string[];
    nested: {
      value: number;
    };
  }

  describe('pathAsArray option', () => {
    test('should use array paths when pathAsArray is true (default)', () => {
      const travels = createTravels<AppState>(
        {
          count: 0,
          items: ['a', 'b'],
          nested: { value: 1 },
        },
        {
          patchesOptions: {
            pathAsArray: true,
          },
        }
      );

      travels.setState((draft) => {
        draft.count = 1;
      });

      const patches = travels.getPatches();
      expect(patches.patches[0]).toBeDefined();
      expect(patches.patches[0][0]).toBeDefined();
      expect(patches).toEqual({
        patches: [[{ op: 'replace', path: ['count'], value: 1 }]],
        inversePatches: [[{ op: 'replace', path: ['count'], value: 0 }]],
      });
      // When pathAsArray is true, path should be an array
      expect(Array.isArray(patches.patches[0][0].path)).toBe(true);
    });

    test('should use string paths when pathAsArray is false', () => {
      const travels = createTravels(
        {
          count: 0,
          items: ['a', 'b'],
          nested: { value: 1 },
        },
        {
          patchesOptions: {
            pathAsArray: false,
          },
        }
      );

      travels.setState((draft) => {
        draft.count = 1;
      });

      const patches = travels.getPatches();
      expect(patches.patches[0]).toBeDefined();
      expect(patches.patches[0][0]).toBeDefined();
      expect(patches).toEqual({
        patches: [[{ op: 'replace', path: '/count', value: 1 }]],
        inversePatches: [[{ op: 'replace', path: '/count', value: 0 }]],
      });
      // When pathAsArray is false, path should be a string
      expect(typeof patches.patches[0][0].path).toBe('string');
    });

    test('should use array paths for nested properties when pathAsArray is true', () => {
      const travels = createTravels<AppState>(
        {
          count: 0,
          items: ['a', 'b'],
          nested: { value: 1 },
        },
        {
          patchesOptions: {
            pathAsArray: true,
          },
        }
      );

      travels.setState((draft) => {
        draft.nested.value = 2;
      });

      const patches = travels.getPatches();
      const patch = patches.patches[0][0];
      expect(Array.isArray(patch.path)).toBe(true);
      expect(patch.path).toEqual(['nested', 'value']);
    });

    test('should use string paths for nested properties when pathAsArray is false', () => {
      const travels = createTravels(
        {
          count: 0,
          items: ['a', 'b'],
          nested: { value: 1 },
        },
        {
          patchesOptions: {
            pathAsArray: false,
          },
        }
      );

      travels.setState((draft) => {
        draft.nested.value = 2;
      });

      const patches = travels.getPatches();
      const patch = patches.patches[0][0];
      expect(typeof patch.path).toBe('string');
      // When pathAsArray is false, uses JSON Patch format with / separator
      expect(patch.path).toBe('/nested/value');
    });
  });

  describe('arrayLengthAssignment option', () => {
    test('should include array length patches when arrayLengthAssignment is true (default)', () => {
      const travels = createTravels<AppState>(
        {
          count: 0,
          items: ['a', 'b', 'c'],
          nested: { value: 1 },
        },
        {
          patchesOptions: {
            arrayLengthAssignment: true,
          },
        }
      );

      // Use splice to trigger length change
      travels.setState((draft) => {
        draft.items.splice(1, 1);
      });

      const patches = travels.getPatches();
      // Should have patches for both the item change and the length assignment
      const allPatches = patches.patches[0];
      const lengthPatch = allPatches.find((p) => {
        const path = Array.isArray(p.path) ? p.path : p.path.split('/');
        return path[path.length - 1] === 'length';
      });
      expect(lengthPatch).toBeDefined();
      expect(lengthPatch!.op).toBe('replace');
    });

    test('should not include array length patches when arrayLengthAssignment is false', () => {
      const travels = createTravels<AppState>(
        {
          count: 0,
          items: ['a', 'b', 'c'],
          nested: { value: 1 },
        },
        {
          patchesOptions: {
            arrayLengthAssignment: false,
          },
        }
      );

      // Use splice to trigger length change
      travels.setState((draft) => {
        draft.items.splice(1, 1);
      });

      const patches = travels.getPatches();
      const allPatches = patches.patches[0];
      // Should not have a length patch, instead uses add/remove operations
      const lengthPatch = allPatches.find((p) => {
        const path = Array.isArray(p.path) ? p.path : p.path.split('/');
        return path[path.length - 1] === 'length';
      });
      expect(lengthPatch).toBeUndefined();
      // Should have remove operation instead
      expect(allPatches.some((p) => p.op === 'remove')).toBe(true);
    });

    test('should still track array item changes when arrayLengthAssignment is false', () => {
      const travels = createTravels<AppState>(
        {
          count: 0,
          items: ['a', 'b', 'c'],
          nested: { value: 1 },
        },
        {
          patchesOptions: {
            arrayLengthAssignment: false,
          },
        }
      );

      travels.setState((draft) => {
        draft.items.splice(1, 1);
      });

      const patches = travels.getPatches();
      expect(patches.patches[0].length).toBeGreaterThan(0);
      expect(travels.getState().items).toEqual(['a', 'c']);
      // Should still be able to undo/redo
      travels.back();
      expect(travels.getState().items).toEqual(['a', 'b', 'c']);

      travels.forward();
      expect(travels.getState().items).toEqual(['a', 'c']);
    });
  });

  describe('combined patchesOptions', () => {
    test('should work with both pathAsArray=false and arrayLengthAssignment=false', () => {
      const travels = createTravels(
        {
          count: 0,
          items: ['a', 'b', 'c'],
          nested: { value: 1 },
        },
        {
          patchesOptions: {
            pathAsArray: false,
            arrayLengthAssignment: false,
          },
        }
      );

      travels.setState((draft) => {
        draft.items.splice(1, 1);
      });

      const patches = travels.getPatches();
      const allPatches = patches.patches[0];

      // All paths should be strings (JSON Patch format)
      allPatches.forEach((patch) => {
        expect(typeof patch.path).toBe('string');
      });

      // No length patch
      const lengthPatch = allPatches.find((p) => p.path.endsWith('/length'));
      expect(lengthPatch).toBeUndefined();
    });

    test('should work with both pathAsArray=true and arrayLengthAssignment=true', () => {
      const travels = createTravels<AppState>(
        {
          count: 0,
          items: ['a', 'b', 'c'],
          nested: { value: 1 },
        },
        {
          patchesOptions: {
            pathAsArray: true,
            arrayLengthAssignment: true,
          },
        }
      );

      travels.setState((draft) => {
        draft.items.splice(1, 1);
      });

      const patches = travels.getPatches();
      const allPatches = patches.patches[0];

      // All paths should be arrays
      allPatches.forEach((patch) => {
        expect(Array.isArray(patch.path)).toBe(true);
      });

      // Should have length patch
      const lengthPatch = allPatches.find((p) => {
        const path = p.path as (string | number)[];
        return path[path.length - 1] === 'length';
      });
      expect(lengthPatch).toBeDefined();
      expect(lengthPatch?.op).toBe('replace');
    });

    test('should maintain undo/redo functionality with custom patchesOptions', () => {
      const travels = createTravels<AppState>(
        {
          count: 0,
          items: ['a', 'b'],
          nested: { value: 1 },
        },
        {
          patchesOptions: {
            pathAsArray: false,
            arrayLengthAssignment: false,
          },
        }
      );

      // Make multiple changes
      travels.setState((draft) => {
        draft.count = 1;
      });

      travels.setState((draft) => {
        draft.items.push('c');
      });

      travels.setState((draft) => {
        draft.nested.value = 3;
      });

      expect(travels.getState()).toEqual({
        count: 1,
        items: ['a', 'b', 'c'],
        nested: { value: 3 },
      });

      // Undo all changes
      travels.back(3);
      expect(travels.getState()).toEqual({
        count: 0,
        items: ['a', 'b'],
        nested: { value: 1 },
      });

      // Redo all changes
      travels.forward(3);
      expect(travels.getState()).toEqual({
        count: 1,
        items: ['a', 'b', 'c'],
        nested: { value: 3 },
      });
    });
  });

  describe('inverse patches with patchesOptions', () => {
    test('should generate correct inverse patches with pathAsArray=false', () => {
      const travels = createTravels(
        {
          count: 0,
          items: ['a', 'b'],
          nested: { value: 1 },
        },
        {
          patchesOptions: {
            pathAsArray: false,
          },
        }
      );

      travels.setState((draft) => {
        draft.count = 5;
      });

      const patches = travels.getPatches();
      const inversePatch = patches.inversePatches[0][0];

      expect(typeof inversePatch.path).toBe('string');
      // JSON Patch format uses / separator
      expect(inversePatch.path).toBe('/count');
      expect(inversePatch.value).toBe(0); // Should restore to original value
    });

    test('should generate correct inverse patches with arrayLengthAssignment=false', () => {
      const travels = createTravels<AppState>(
        {
          count: 0,
          items: ['a', 'b'],
          nested: { value: 1 },
        },
        {
          patchesOptions: {
            arrayLengthAssignment: false,
          },
        }
      );

      travels.setState((draft) => {
        draft.items.push('c');
      });

      // Test that undo works correctly
      travels.back();
      expect(travels.getState().items).toEqual(['a', 'b']);
      expect(travels.getState().items.length).toBe(2);
    });
  });
});
