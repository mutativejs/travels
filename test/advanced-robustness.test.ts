import { describe, test, expect, vi } from 'vitest';
import { createTravels, Travels } from '../src/index';

describe('Position/Boundary Consistency', () => {
  describe('Position integrity after complex navigation', () => {
    test('position consistency: back then write in auto mode', () => {
      const travels = createTravels({ count: 0 });

      travels.setState({ count: 1 });
      travels.setState({ count: 2 });
      travels.setState({ count: 3 });

      expect(travels.getPosition()).toBe(3);

      // Go back
      travels.back(2); // position: 1, state: { count: 1 }
      expect(travels.getPosition()).toBe(1);
      expect(travels.getState().count).toBe(1);

      // Write new history (should clear future)
      travels.setState({ count: 10 });
      expect(travels.getPosition()).toBe(2);
      expect(travels.getState().count).toBe(10);

      // Verify future is cleared
      expect(travels.canForward()).toBe(false);

      // Verify history integrity
      travels.back();
      expect(travels.getState().count).toBe(1);
      travels.back();
      expect(travels.getState().count).toBe(0);
    });

    test('manual mode: navigation auto-archives pending patches', () => {
      const travels = createTravels({ count: 0 }, { autoArchive: false });

      // Create archived history
      travels.setState({ count: 1 });
      travels.archive();
      travels.setState({ count: 2 });
      travels.archive();

      expect(travels.getPosition()).toBe(2);

      // Add temp patches without archiving
      travels.setState({ count: 3 });
      travels.setState({ count: 4 });

      // Position increments on first temp patch
      expect(travels.getPosition()).toBe(3);
      expect(travels.canArchive()).toBe(true);

      // Navigate back (should auto-archive)
      travels.back();
      expect(travels.getPosition()).toBe(2);
      expect(travels.canArchive()).toBe(false); // archived

      // Verify state
      expect(travels.getState().count).toBe(2);

      // Should be able to forward to archived temp patches
      expect(travels.canForward()).toBe(true);
      travels.forward();
      expect(travels.getState().count).toBe(4);
    });

    test('position consistency: exceed maxHistory then navigate', () => {
      const travels = createTravels({ count: 0 }, { maxHistory: 3 });

      // Add more than maxHistory
      travels.setState({ count: 1 });
      travels.setState({ count: 2 });
      travels.setState({ count: 3 });
      travels.setState({ count: 4 });
      travels.setState({ count: 5 });

      // Position capped at maxHistory
      expect(travels.getPosition()).toBe(3);

      // Window is [2, 3, 4, 5], position 3 is at state 5
      expect(travels.getState().count).toBe(5);

      // Go back to window start
      travels.go(0);
      expect(travels.getPosition()).toBe(0);
      expect(travels.getState().count).toBe(2); // Window start

      // Forward to end
      travels.go(3);
      expect(travels.getPosition()).toBe(3);
      expect(travels.getState().count).toBe(5);

      // Add new state (should maintain position at maxHistory)
      travels.setState({ count: 6 });
      expect(travels.getPosition()).toBe(3);
      expect(travels.getState().count).toBe(6);
    });

    test('position boundary: manual mode jump with unarchived temp', () => {
      const travels = createTravels({ count: 0 }, { autoArchive: false });

      travels.setState({ count: 1 });
      travels.archive();
      travels.setState({ count: 2 });
      travels.archive();
      travels.setState({ count: 3 });
      travels.archive();

      // position: 3
      expect(travels.getPosition()).toBe(3);

      // Add temp without archive
      travels.setState({ count: 4 });
      expect(travels.getPosition()).toBe(4);

      // Jump to middle (should archive temp first)
      travels.go(1);
      expect(travels.getPosition()).toBe(1);
      expect(travels.getState().count).toBe(1);

      // Temp should have been archived
      expect(travels.canArchive()).toBe(false);

      // Can forward through all states
      travels.go(4);
      expect(travels.getState().count).toBe(4);
    });
  });

  describe('Boundary conditions', () => {
    test('position at exactly maxHistory boundary', () => {
      const travels = createTravels({ count: 0 }, { maxHistory: 2 });

      travels.setState({ count: 1 });
      travels.setState({ count: 2 });
      travels.setState({ count: 3 }); // Exceeds maxHistory

      expect(travels.getPosition()).toBe(2);
      expect(travels.getPatches().patches).toHaveLength(2);

      // Can go back within window
      travels.back();
      expect(travels.getState().count).toBe(2);

      travels.back();
      expect(travels.getState().count).toBe(1); // Window start, not initial state

      // Cannot go back further
      expect(travels.canBack()).toBe(false);
    });

    test('initialPosition does not auto-apply patches on init', () => {
      const travels1 = createTravels({ count: 0 });
      travels1.setState({ count: 1 });
      travels1.setState({ count: 2 });

      const patches = travels1.getPatches();
      const position = travels1.getPosition();

      const restored = createTravels({ count: 0 }, {
        initialPatches: patches,
        initialPosition: position,
      });

      expect(restored.getPosition()).toBe(2);
      expect(restored.getState().count).toBe(0);

      // Directly going to the same position is a no-op because the constructor already sets it
      restored.go(position);
      expect(restored.getState().count).toBe(0);

      // Replaying from the start applies the expected patches
      restored.go(0);
      restored.go(position);
      expect(restored.getState().count).toBe(2);
      expect(restored.getPosition()).toBe(2);
    });

    test('restoring with persisted snapshot keeps state and position aligned', () => {
      const travels1 = createTravels({ count: 0 });
      travels1.setState({ count: 1 });
      travels1.setState({ count: 2 });

      const patches = travels1.getPatches();
      const position = travels1.getPosition();
      const currentState = JSON.parse(JSON.stringify(travels1.getState()));

      // When restoring, the persisted state should correspond to the persisted position
      const travels2 = createTravels(currentState, {
        initialPatches: patches,
        initialPosition: position,
      });

      expect(travels2.getPosition()).toBe(2);
      expect(travels2.getState().count).toBe(2);

      // State and position stay in sync while navigating the restored history
      travels2.back();
      expect(travels2.getState().count).toBe(1);
      expect(travels2.getPosition()).toBe(1);
      travels2.back();
      expect(travels2.getState().count).toBe(0);
      expect(travels2.getPosition()).toBe(0);

      travels2.forward();
      expect(travels2.getState().count).toBe(1);
      expect(travels2.getPosition()).toBe(1);
      travels2.forward();
      expect(travels2.getState().count).toBe(2);
      expect(travels2.getPosition()).toBe(2);
    });

    test('manual mode retains forward capability after stepping back', () => {
      const travels = createTravels({ value: 0 }, { autoArchive: false });

      travels.setState({ value: 1 });
      travels.archive();

      travels.setState({ value: 2 });
      travels.archive();

      expect(travels.getPosition()).toBe(2);

      travels.back();
      expect(travels.getPosition()).toBe(1);
      expect(travels.canForward()).toBe(true);

      travels.forward();
      expect(travels.getState().value).toBe(2);
      expect(travels.getPosition()).toBe(2);
    });

    test('go clamps bounds and is a no-op when position is unchanged', () => {
      const travels = createTravels({ value: 0 });
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      travels.setState({ value: 1 });
      travels.setState({ value: 2 });
      travels.setState({ value: 3 });

      const currentRef = travels.getState();
      const currentPosition = travels.getPosition();

      travels.go(currentPosition);
      expect(travels.getState()).toBe(currentRef);
      expect(travels.getPosition()).toBe(currentPosition);

      travels.go(-999);
      expect(travels.getPosition()).toBe(0);
      expect(travels.getState().value).toBe(0);

      travels.go(10_000);
      expect(travels.getPosition()).toBe(3);
      expect(travels.getState().value).toBe(3);

      const clamped = createTravels({ value: 0 }, { initialPosition: 5 });
      clamped.back();
      expect(clamped.getPosition()).toBe(0);
      expect(clamped.getState().value).toBe(0);

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    test('archive is a no-op when there are no temporary patches', () => {
      const travels = createTravels({ value: 0 }, { autoArchive: false });

      travels.archive();
      expect(travels.getPosition()).toBe(0);
      expect(travels.getPatches().patches).toHaveLength(0);

      travels.setState({ value: 1 });
      travels.archive();
      const patchesAfterArchive = travels.getPatches().patches.length;
      const positionAfterArchive = travels.getPosition();

      travels.archive();
      expect(travels.getPatches().patches).toHaveLength(patchesAfterArchive);
      expect(travels.getPosition()).toBe(positionAfterArchive);
    });

    test('maxHistory truncates future branches when writing new history', () => {
      const travels = createTravels({ value: 0 }, { maxHistory: 3 });

      travels.setState({ value: 1 });
      travels.setState({ value: 2 });
      travels.setState({ value: 3 });

      travels.back(2);
      expect(travels.getState().value).toBe(1);

      travels.setState({ value: 4 });

      expect(travels.getState().value).toBe(4);
      expect(travels.canForward()).toBe(false);

      const historyValues = travels.getHistory().map((state) => state.value);
      expect(historyValues).toEqual([0, 1, 4]);
    });
  });
});

describe('Patch Reversibility', () => {
  test('apply(patch) then apply(inversePatch) should be identity', () => {
    const travels = createTravels({
      user: { name: 'Alice', age: 30 },
      items: [1, 2, 3],
    });

    const initialState = JSON.parse(JSON.stringify(travels.getState()));

    // Make a change
    travels.setState((draft) => {
      draft.user.name = 'Bob';
      draft.user.age = 35;
      draft.items.push(4);
    });

    const patches = travels.getPatches();
    expect(patches.patches).toHaveLength(1);
    expect(patches.inversePatches).toHaveLength(1);

    // Undo should restore exactly
    travels.back();
    expect(travels.getState()).toEqual(initialState);

    // Redo should restore changed state
    travels.forward();
    expect(travels.getState().user.name).toBe('Bob');
    expect(travels.getState().user.age).toBe(35);
    expect(travels.getState().items).toEqual([1, 2, 3, 4]);

    // Undo again
    travels.back();
    expect(travels.getState()).toEqual(initialState);
  });

  test('multiple forward/back cycles preserve state', () => {
    const travels = createTravels({ count: 0 });

    const states = [0, 1, 2, 3, 4, 5];
    states.slice(1).forEach((count) => {
      travels.setState({ count });
    });

    // Cycle back and forth multiple times
    for (let cycle = 0; cycle < 3; cycle++) {
      // Go all the way back
      while (travels.canBack()) {
        travels.back();
      }
      expect(travels.getState().count).toBe(0);

      // Go all the way forward
      while (travels.canForward()) {
        travels.forward();
      }
      expect(travels.getState().count).toBe(5);
    }
  });

  test('reversibility with nested object mutations', () => {
    const travels = createTravels({
      level1: {
        level2: {
          level3: {
            value: 'deep',
            array: [1, 2, 3],
          },
        },
      },
    });

    const snapshot = JSON.parse(JSON.stringify(travels.getState()));

    // Deep mutation
    travels.setState((draft) => {
      draft.level1.level2.level3.value = 'modified';
      draft.level1.level2.level3.array.push(4);
      draft.level1.level2.level3.array[0] = 99;
    });

    // Undo
    travels.back();
    expect(travels.getState()).toEqual(snapshot);

    // Redo
    travels.forward();
    expect(travels.getState().level1.level2.level3.value).toBe('modified');
    expect(travels.getState().level1.level2.level3.array).toEqual([99, 2, 3, 4]);

    // Undo again
    travels.back();
    expect(travels.getState()).toEqual(snapshot);
  });

  test('reversibility with array operations', () => {
    const travels = createTravels({ items: ['a', 'b', 'c', 'd'] });

    const original = JSON.parse(JSON.stringify(travels.getState()));

    // Complex array operations
    travels.setState((draft) => {
      draft.items.splice(1, 1); // Remove 'b'
      draft.items.unshift('z'); // Add at start
      draft.items.push('e'); // Add at end
    });

    expect(travels.getState().items).toEqual(['z', 'a', 'c', 'd', 'e']);

    // Undo should restore exactly
    travels.back();
    expect(travels.getState()).toEqual(original);
    expect(travels.getState().items).toEqual(['a', 'b', 'c', 'd']);
  });

  test('patch reversibility in manual mode with archive', () => {
    const travels = createTravels({ value: 0 }, { autoArchive: false });

    // Multiple changes in one archive cycle
    travels.setState({ value: 1 });
    travels.setState({ value: 2 });
    travels.setState({ value: 3 });

    expect(travels.getState().value).toBe(3);

    // Archive
    travels.archive();

    // Should be able to undo the entire batch
    travels.back();
    expect(travels.getState().value).toBe(0);

    // Redo
    travels.forward();
    expect(travels.getState().value).toBe(3);

    // Multiple undo/redo cycles
    for (let i = 0; i < 5; i++) {
      travels.back();
      expect(travels.getState().value).toBe(0);
      travels.forward();
      expect(travels.getState().value).toBe(3);
    }
  });
});

describe('Random Fuzzing', () => {
  test('fuzzing: deterministic deep object mutations', () => {
    interface State {
      nested: {
        count: number;
        items: number[];
        meta: { flag: boolean; text: string };
      };
    }

    const travels = createTravels<State>({
      nested: {
        count: 0,
        items: [],
        meta: { flag: false, text: '' },
      },
    });

    // Snapshot-based verification with simple mutations
    const operations = [
      (draft: State) => {
        draft.nested.count = 1;
      },
      (draft: State) => {
        draft.nested.items.push(10);
      },
      (draft: State) => {
        draft.nested.meta.flag = true;
      },
      (draft: State) => {
        draft.nested.meta.text = 'value-0';
      },
      (draft: State) => {
        draft.nested.count = 5;
      },
      (draft: State) => {
        draft.nested.items.push(20, 30);
      },
      (draft: State) => {
        draft.nested.meta.flag = false;
      },
      (draft: State) => {
        draft.nested.meta.text = 'value-final';
      },
    ];

    const snapshots: State[] = [
      JSON.parse(JSON.stringify(travels.getState())),
    ];

    operations.forEach((op) => {
      travels.setState(op);
      snapshots.push(JSON.parse(JSON.stringify(travels.getState())));
    });

    // Go all the way back
    travels.go(0);
    expect(travels.getState()).toEqual(snapshots[0]);

    // Navigate forward through each state
    for (let i = 1; i < snapshots.length; i++) {
      travels.forward();
      expect(travels.getState()).toEqual(snapshots[i]);
    }

    // Navigate backward through each state
    for (let i = snapshots.length - 2; i >= 0; i--) {
      travels.back();
      expect(travels.getState()).toEqual(snapshots[i]);
    }
  });

  test('fuzzing: deterministic array splice operations', () => {
    const travels = createTravels<{ list: number[] }>({ list: [1, 2, 3] });

    const operations = [
      (draft: { list: number[] }) => {
        draft.list.push(4);
      }, // [1,2,3,4]
      (draft: { list: number[] }) => {
        draft.list.unshift(0);
      }, // [0,1,2,3,4]
      (draft: { list: number[] }) => {
        draft.list.splice(2, 1);
      }, // [0,1,3,4]
      (draft: { list: number[] }) => {
        draft.list.splice(1, 0, 99);
      }, // [0,99,1,3,4]
      (draft: { list: number[] }) => {
        draft.list[2] = 88;
      }, // [0,99,88,3,4]
      (draft: { list: number[] }) => {
        draft.list.pop();
      }, // [0,99,88,3]
      (draft: { list: number[] }) => {
        draft.list.push(5, 6);
      }, // [0,99,88,3,5,6]
    ];

    const snapshots: number[][] = [
      JSON.parse(JSON.stringify(travels.getState().list)),
    ];

    operations.forEach((op) => {
      travels.setState(op);
      snapshots.push(JSON.parse(JSON.stringify(travels.getState().list)));
    });

    // Go all the way back
    travels.go(0);
    expect(travels.getState().list).toEqual(snapshots[0]);

    // Verify forward navigation
    for (let i = 1; i < snapshots.length; i++) {
      travels.forward();
      expect(travels.getState().list).toEqual(snapshots[i]);
    }

    // Verify backward navigation
    for (let i = snapshots.length - 2; i >= 0; i--) {
      travels.back();
      expect(travels.getState().list).toEqual(snapshots[i]);
    }
  });

  test('fuzzing: random string replacements', () => {
    const travels = createTravels({ text: 'Hello World' });

    const snapshots: string[] = [travels.getState().text];

    const operations = 10;
    for (let i = 0; i < operations; i++) {
      const current = travels.getState().text;
      const newText =
        current.substring(0, Math.floor(Math.random() * current.length)) +
        `_${i}_` +
        current.substring(Math.floor(Math.random() * current.length));

      travels.setState({ text: newText });
      snapshots.push(newText);
    }

    // Verify backwards
    for (let i = operations; i >= 0; i--) {
      expect(travels.getState().text).toBe(snapshots[i]);
      if (i > 0) travels.back();
    }

    // Verify forwards
    for (let i = 0; i <= operations; i++) {
      expect(travels.getState().text).toBe(snapshots[i]);
      if (i < operations) travels.forward();
    }
  });

  test('fuzzing with maxHistory: sliding window integrity', () => {
    const travels = createTravels({ value: 0 }, { maxHistory: 5 });

    const allValues: number[] = [0];

    // Generate many more states than maxHistory
    for (let i = 1; i <= 20; i++) {
      travels.setState({ value: i });
      allValues.push(i);
    }

    // Position should be at maxHistory
    expect(travels.getPosition()).toBe(5);

    // Current state should be latest
    expect(travels.getState().value).toBe(20);

    // Go back to window start
    travels.go(0);

    // Should be at value 15 (window: 15, 16, 17, 18, 19, 20)
    expect(travels.getState().value).toBe(15);

    // Navigate through window and verify
    const windowStart = 15;
    for (let i = 0; i <= 5; i++) {
      travels.go(i);
      expect(travels.getState().value).toBe(windowStart + i);
    }
  });
});

describe('Event Notifications', () => {
  test('subscribe emits ordered snapshots for state and navigation changes', () => {
    const travels = createTravels({ value: 0 }, { autoArchive: false });

    type Expectation = {
      name: string;
      assert: (
        state: { value: number },
        patches: ReturnType<typeof travels.getPatches>,
        position: number
      ) => void;
    };

    const expectations: Expectation[] = [];
    let callIndex = 0;

    travels.subscribe((state, patches, position) => {
      const expectation = expectations[callIndex++];
      expect(expectation?.name).toBeDefined();
      expectation.assert(state, patches, position);
    });

    const run = (
      name: string,
      operation: () => void,
      assert: Expectation['assert']
    ) => {
      expectations.push({ name, assert });
      operation();
    };

    run(
      'setState-1',
      () => travels.setState({ value: 1 }),
      (state, patches, position) => {
        expect(state.value).toBe(1);
        expect(position).toBe(1);
        expect(patches.patches).toHaveLength(1);
        expect(patches.inversePatches).toHaveLength(1);
      }
    );

    run('archive-1', () => travels.archive(), (state, patches, position) => {
      expect(state.value).toBe(1);
      expect(position).toBe(1);
      expect(patches.patches).toHaveLength(1);
      expect(patches.inversePatches).toHaveLength(1);
    });

    run(
      'setState-2',
      () => travels.setState({ value: 2 }),
      (state, patches, position) => {
        expect(state.value).toBe(2);
        expect(position).toBe(2);
        expect(patches.patches).toHaveLength(2);
        expect(patches.inversePatches).toHaveLength(2);
      }
    );

    run('archive-2', () => travels.archive(), (state, patches, position) => {
      expect(state.value).toBe(2);
      expect(position).toBe(2);
      expect(patches.patches).toHaveLength(2);
      expect(patches.inversePatches).toHaveLength(2);
    });

    run('back', () => travels.back(), (state, patches, position) => {
      expect(state.value).toBe(1);
      expect(position).toBe(1);
      expect(patches.patches).toHaveLength(2);
      expect(patches.inversePatches).toHaveLength(2);
    });

    run('forward', () => travels.forward(), (state, patches, position) => {
      expect(state.value).toBe(2);
      expect(position).toBe(2);
      expect(patches.patches).toHaveLength(2);
      expect(patches.inversePatches).toHaveLength(2);
    });

    run('go', () => travels.go(1), (state, patches, position) => {
      expect(state.value).toBe(1);
      expect(position).toBe(1);
      expect(patches.patches).toHaveLength(2);
      expect(patches.inversePatches).toHaveLength(2);
    });

    run('reset', () => travels.reset(), (state, patches, position) => {
      expect(state.value).toBe(0);
      expect(position).toBe(0);
      expect(patches.patches).toHaveLength(0);
      expect(patches.inversePatches).toHaveLength(0);
    });

    expect(callIndex).toBe(expectations.length);
  });
});

describe('Mutable/Immutable Alignment', () => {
  interface TestState {
    count: number;
    nested: { value: string };
    list: number[];
  }

  const initialState: TestState = {
    count: 0,
    nested: { value: 'initial' },
    list: [1, 2, 3],
  };

  test('mutable mode retains reference identity while immutable replaces it', () => {
    const immutable = createTravels<TestState>(
      JSON.parse(JSON.stringify(initialState))
    );
    const mutable = createTravels<TestState>(
      JSON.parse(JSON.stringify(initialState)),
      { mutable: true }
    );

    const immutableRef = immutable.getState();
    const mutableRef = mutable.getState();

    immutable.setState((draft) => {
      draft.count = 1;
    });
    mutable.setState((draft) => {
      draft.count = 1;
    });

    expect(immutable.getState()).not.toBe(immutableRef);
    expect(mutable.getState()).toBe(mutableRef);
    expect(immutable.getState().count).toBe(1);
    expect(mutable.getState().count).toBe(1);
  });

  test('identical operations produce identical results', () => {
    const immutable = createTravels<TestState>(
      JSON.parse(JSON.stringify(initialState)),
      { mutable: false }
    );
    expect(immutable.mutable).toBe(false);

    const mutable = createTravels<TestState>(
      JSON.parse(JSON.stringify(initialState)),
      { mutable: true }
    );
    expect(mutable.mutable).toBe(true);


    // Perform same operations
    const operations = [
      (draft: TestState) => {
        draft.count = 10;
      },
      (draft: TestState) => {
        draft.nested.value = 'changed';
      },
      (draft: TestState) => {
        draft.list.push(4);
      },
      (draft: TestState) => {
        draft.list[0] = 99;
      },
    ];

    operations.forEach((op) => {
      immutable.setState(op);
      mutable.setState(op);

      // States should be deeply equal
      expect(mutable.getState()).toEqual(immutable.getState());
    });

    // Navigate back
    immutable.back(2);
    mutable.back(2);
    expect(mutable.getState()).toEqual(immutable.getState());

    // Navigate forward
    immutable.forward();
    mutable.forward();
    expect(mutable.getState()).toEqual(immutable.getState());

    // Reset
    immutable.reset();
    mutable.reset();
    expect(mutable.getState()).toEqual(immutable.getState());
    expect(mutable.getState()).toEqual(initialState);
  });

  test('getHistory produces identical results', () => {
    const immutable = createTravels<TestState>(
      JSON.parse(JSON.stringify(initialState))
    );
    const mutable = createTravels<TestState>(
      JSON.parse(JSON.stringify(initialState)),
      { mutable: true }
    );

    // Apply operations
    [10, 20, 30].forEach((count) => {
      immutable.setState({ ...immutable.getState(), count });
      mutable.setState((draft) => {
        draft.count = count;
      });
    });

    // Go back to middle
    immutable.back();
    mutable.back();

    // Histories should match
    const immutableHistory = immutable.getHistory();
    const mutableHistory = mutable.getHistory();

    expect(mutableHistory.length).toBe(immutableHistory.length);
    mutableHistory.forEach((state, i) => {
      expect(state).toEqual(immutableHistory[i]);
    });
  });

  test('manual mode alignment', () => {
    const immutable = createTravels<TestState>(
      JSON.parse(JSON.stringify(initialState)),
      { autoArchive: false }
    );
    const mutable = createTravels<TestState>(
      JSON.parse(JSON.stringify(initialState)),
      { autoArchive: false, mutable: true }
    );

    // Batch operations
    immutable.setState({ ...initialState, count: 1 });
    immutable.setState({ ...initialState, count: 2 });
    mutable.setState((draft) => {
      draft.count = 1;
    });
    mutable.setState((draft) => {
      draft.count = 2;
    });

    // Before archive
    expect(mutable.canArchive()).toBe(immutable.canArchive());
    expect(mutable.getPosition()).toBe(immutable.getPosition());

    // Archive
    immutable.archive();
    mutable.archive();

    expect(mutable.canArchive()).toBe(false);
    expect(immutable.canArchive()).toBe(false);
    expect(mutable.getState()).toEqual(immutable.getState());

    // Navigate
    immutable.back();
    mutable.back();
    expect(mutable.getState()).toEqual(immutable.getState());
  });

  test('reset restores deep mutable state and clears history', () => {
    interface DeepState {
      count: number;
      nested: { value: string; meta: { flag: boolean; tags: string[] } };
      list: Array<{ id: number; label: string }>;
    }

    const base: DeepState = {
      count: 0,
      nested: { value: 'initial', meta: { flag: true, tags: ['a', 'b'] } },
      list: [
        { id: 1, label: 'one' },
        { id: 2, label: 'two' },
      ],
    };

    const mutable = createTravels<DeepState>(
      JSON.parse(JSON.stringify(base)),
      { mutable: true }
    );

    const reference = mutable.getState();

    mutable.setState((draft) => {
      draft.count = 10;
      draft.nested.value = 'changed';
      draft.nested.meta.flag = false;
      draft.nested.meta.tags.push('c');
      draft.list[0].label = 'uno';
      draft.list.push({ id: 3, label: 'three' });
    });

    expect(mutable.canBack()).toBe(true);

    mutable.reset();

    expect(mutable.getState()).toBe(reference);
    expect(mutable.getState()).toEqual(base);
    expect(mutable.canBack()).toBe(false);
    expect(mutable.canForward()).toBe(false);
  });

  test('maxHistory behavior alignment', () => {
    const immutable = createTravels<TestState>(
      JSON.parse(JSON.stringify(initialState)),
      { maxHistory: 3 }
    );
    const mutable = createTravels<TestState>(
      JSON.parse(JSON.stringify(initialState)),
      { maxHistory: 3, mutable: true }
    );

    // Exceed maxHistory
    for (let i = 1; i <= 10; i++) {
      immutable.setState({ ...initialState, count: i });
      mutable.setState((draft) => {
        draft.count = i;
        draft.nested.value = initialState.nested.value;
        draft.list = [...initialState.list];
      });
    }

    // Positions should match
    expect(mutable.getPosition()).toBe(immutable.getPosition());

    // States should match
    expect(mutable.getState()).toEqual(immutable.getState());

    // Navigate to window start
    immutable.go(0);
    mutable.go(0);

    expect(mutable.getState()).toEqual(immutable.getState());
    expect(mutable.getPosition()).toBe(immutable.getPosition());
  });

  test('complex scenario alignment: mixed operations', () => {
    const immutable = createTravels<TestState>(
      JSON.parse(JSON.stringify(initialState)),
      { maxHistory: 5 }
    );
    const mutable = createTravels<TestState>(
      JSON.parse(JSON.stringify(initialState)),
      { maxHistory: 5, mutable: true }
    );

    // Scenario: create history, navigate, branch, reset
    const applyToBoth = (op: (draft: TestState) => void) => {
      immutable.setState(op);
      mutable.setState(op);
    };

    // Create history
    applyToBoth((draft) => {
      draft.count = 1;
    });
    applyToBoth((draft) => {
      draft.list.push(4);
    });
    applyToBoth((draft) => {
      draft.nested.value = 'A';
    });

    // States should match
    expect(mutable.getState()).toEqual(immutable.getState());

    // Navigate back
    immutable.back();
    mutable.back();
    expect(mutable.getState()).toEqual(immutable.getState());

    // Branch off (this clears future history)
    applyToBoth((draft) => {
      draft.nested.value = 'B';
    });
    expect(mutable.getState()).toEqual(immutable.getState());

    // Continue adding to exceed maxHistory
    for (let i = 0; i < 8; i++) {
      applyToBoth((draft) => {
        draft.count = 10 + i;
      });
    }

    expect(mutable.getPosition()).toBe(immutable.getPosition());
    expect(mutable.getState()).toEqual(immutable.getState());

    // Reset
    immutable.reset();
    mutable.reset();
    expect(mutable.getState()).toEqual(immutable.getState());
    expect(mutable.getState()).toEqual(initialState);
  });
});
