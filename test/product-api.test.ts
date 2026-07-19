import { describe, expect, test, vi } from 'vitest';
import {
  createTravels,
  TravelsError,
  type TravelHistoryEntry,
} from '../src/index';

describe('Productized history API', () => {
  test('stores metadata for setState entries and serialized snapshots', () => {
    const travels = createTravels({ title: 'Draft' });

    travels.setState(
      (draft) => {
        draft.title = 'Published';
      },
      { label: 'Rename document', source: 'toolbar', timestamp: 1 }
    );

    expect(travels.getMetadata()).toEqual([
      { label: 'Rename document', source: 'toolbar', timestamp: 1 },
    ]);
    expect(travels.getHistoryEntries()[0].metadata?.label).toBe(
      'Rename document'
    );
    expect(travels.serialize().metadata?.[0]?.source).toBe('toolbar');
  });

  test('manual pending setState metadata survives archive boundaries', () => {
    const travels = createTravels(
      { count: 0 },
      { autoArchive: false, maxHistory: 10 }
    );

    travels.setState(
      (draft) => {
        draft.count = 1;
      },
      { label: 'Manual edit', source: 'toolbar' }
    );

    expect(travels.getMetadata()[0]?.label).toBe('Manual edit');
    expect(travels.serialize().metadata?.[0]?.source).toBe('toolbar');

    travels.back();

    expect(travels.getHistoryEntries()[0].metadata?.label).toBe('Manual edit');
  });

  test('archive metadata overrides pending setState metadata', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });

    travels.setState(
      (draft) => {
        draft.count = 1;
      },
      { label: 'Drag tick' }
    );
    travels.archive({ label: 'Move layer' });

    expect(travels.getMetadata()[0]?.label).toBe('Move layer');
  });

  test('manual controls archive forwards metadata', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });
    const controls = travels.getControls();

    travels.setState((draft) => {
      draft.count = 1;
    });
    controls.archive({ label: 'Move layer', source: 'controls' });

    expect(travels.getMetadata()[0]).toEqual({
      label: 'Move layer',
      source: 'controls',
    });
  });

  test('history entries include pending manual archive entry', () => {
    const travels = createTravels({ count: 0 }, { autoArchive: false });

    travels.setState(
      (draft) => {
        draft.count = 1;
      },
      { label: 'Pending edit' }
    );

    const entries = travels.getHistoryEntries();

    expect(travels.getPatches().patches).toHaveLength(1);
    expect(travels.getMetadata()).toHaveLength(1);
    expect(entries).toHaveLength(1);
    expect(entries[0].metadata?.label).toBe('Pending edit');

    entries[0].patches.length = 0;
    expect(travels.getPatches().patches[0]).toHaveLength(1);
  });

  test('metadata inputs and exported metadata are cloned', () => {
    const metadata = {
      label: 'Rename document',
      nested: { source: 'toolbar' },
    };
    const travels = createTravels({ title: 'Draft' });

    travels.setState((draft) => {
      draft.title = 'Published';
    }, metadata);

    metadata.label = 'Mutated input';
    metadata.nested.source = 'mutated-input';

    expect(travels.getMetadata()[0]).toEqual({
      label: 'Rename document',
      nested: { source: 'toolbar' },
    });

    const serializedMetadata = travels.serialize().metadata![0]!;
    serializedMetadata.label = 'Mutated serialized';
    (serializedMetadata.nested as { source: string }).source =
      'mutated-serialized';

    const entryMetadata = travels.getHistoryEntries()[0].metadata!;
    entryMetadata.label = 'Mutated entry';
    (entryMetadata.nested as { source: string }).source = 'mutated-entry';

    expect(travels.getMetadata()[0]).toEqual({
      label: 'Rename document',
      nested: { source: 'toolbar' },
    });
  });

  test.each([
    { mutable: false, mode: 'immutable' },
    { mutable: true, mode: 'mutable' },
  ])(
    'metadata clone failures leave $mode state and history unchanged',
    ({ mutable }) => {
      const initialState = { count: 0 };
      const travels = createTravels(initialState, { mutable });
      const updater = vi.fn((draft: { count: number }) => {
        draft.count = 1;
      });
      const metadata = {} as { label?: string };
      Object.defineProperty(metadata, 'label', {
        enumerable: true,
        get() {
          throw new Error('metadata getter failed');
        },
      });

      expect(() => travels.setState(updater, metadata)).toThrow(
        'metadata getter failed'
      );

      expect(updater).not.toHaveBeenCalled();
      expect(travels.getState()).toBe(initialState);
      expect(travels.getState()).toEqual({ count: 0 });
      expect(travels.getPosition()).toBe(0);
      expect(travels.getHistoryEntries()).toEqual([]);
    }
  );

  test('history entry patches are cloned', () => {
    const travels = createTravels({ count: 0 });

    travels.setState((draft) => {
      draft.count = 1;
    });

    const [entry] = travels.getHistoryEntries();
    entry.inversePatches.length = 0;
    entry.patches.length = 0;

    expect(travels.getPatches().inversePatches[0]).toHaveLength(1);
    expect(travels.getPatches().patches[0]).toHaveLength(1);

    travels.back();
    expect(travels.getState()).toEqual({ count: 0 });
  });

  test('transaction batches multiple updates into one undo step', () => {
    const travels = createTravels({
      title: 'Draft',
      blocks: [] as string[],
    });

    travels.transaction({ label: 'Build intro' }, () => {
      travels.setState((draft) => {
        draft.title = 'Intro';
      });
      travels.setState((draft) => {
        draft.blocks.push('A');
      });
      travels.setState((draft) => {
        draft.blocks.push('B');
      });
    });

    expect(travels.getPosition()).toBe(1);
    expect(travels.getMetadata()[0]?.label).toBe('Build intro');
    expect(travels.getState()).toEqual({
      title: 'Intro',
      blocks: ['A', 'B'],
    });

    travels.back();
    expect(travels.getState()).toEqual({ title: 'Draft', blocks: [] });
  });

  test('transaction remains one undo step at maxHistory capacity', () => {
    const travels = createTravels({ count: 0 }, { maxHistory: 2 });
    travels.setState((draft) => {
      draft.count = 1;
    });
    travels.setState((draft) => {
      draft.count = 2;
    });

    travels.transaction(() => {
      travels.setState((draft) => {
        draft.count = 3;
      });
      travels.setState((draft) => {
        draft.count = 4;
      });
    });

    expect(travels.getHistory().map((state) => state.count)).toEqual([1, 2, 4]);
    travels.back();
    expect(travels.getState()).toEqual({ count: 2 });
  });

  test('empty transactions do not clone state or retained history', () => {
    const onBranchDiscard = vi.fn();
    const travels = createTravels(
      {
        count: 0,
        items: Array.from({ length: 200 }, (_, index) => ({ index })),
      },
      { maxHistory: 100, onBranchDiscard }
    );
    for (let count = 1; count <= 100; count += 1) {
      travels.setState((draft) => {
        draft.count = count;
      });
    }

    const cloneSpy = vi.spyOn(globalThis, 'structuredClone');
    const metadataSpy = vi.spyOn(travels, 'getMetadata');
    travels.transaction(() => undefined);
    cloneSpy.mockRestore();
    metadataSpy.mockRestore();

    expect(cloneSpy).not.toHaveBeenCalled();
    expect(metadataSpy).not.toHaveBeenCalled();
    expect(onBranchDiscard).not.toHaveBeenCalled();
    expect(travels.getPosition()).toBe(100);
  });

  test('mutable transaction journals restore navigation and reset in place', () => {
    const original = { count: 0, items: [0] };
    const travels = createTravels(original, {
      mutable: true,
      maxHistory: 5,
      warnOnUnsupportedState: false,
    });
    travels.setState((draft) => {
      draft.count = 1;
    });
    travels.setState((draft) => {
      draft.count = 2;
    });
    const patchesBefore = travels.getPatches();

    expect(() =>
      travels.transaction(() => {
        travels.back();
        travels.reset();
        travels.setState((draft) => {
          draft.count = 9;
          draft.items.push(1);
        });
        throw new Error('rollback journal');
      })
    ).toThrow(TravelsError);

    expect(travels.getState()).toBe(original);
    expect(travels.getState()).toEqual({ count: 2, items: [0] });
    expect(travels.getPosition()).toBe(2);
    expect(travels.getPatches()).toEqual(patchesBefore);
  });

  test('nested mutable journals roll back only the failed scope', () => {
    const original = { count: 0, items: [] as number[] };
    const travels = createTravels(original, {
      mutable: true,
      warnOnUnsupportedState: false,
    });

    travels.transaction(() => {
      travels.setState((draft) => {
        draft.count = 1;
      });

      try {
        travels.transaction(() => {
          travels.setState((draft) => {
            draft.count = 2;
            draft.items.push(2);
          });
          throw new Error('nested rollback');
        });
      } catch {
        // Continue the root transaction after restoring its journal mark.
      }

      expect(travels.getState()).toEqual({ count: 1, items: [] });
      travels.setState((draft) => {
        draft.count = 3;
      });
    });

    expect(travels.getState()).toBe(original);
    expect(travels.getState()).toEqual({ count: 3, items: [] });
    travels.back();
    expect(travels.getState()).toEqual({ count: 0, items: [] });
  });

  test('transaction buffering does not expose manual archive controls', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const travels = createTravels({ count: 0 });
    let controls: ReturnType<typeof travels.getControls> | undefined;

    travels.transaction(() => {
      controls = travels.getControls();
      travels.setState((draft) => {
        draft.count = 1;
      });
      travels.archive();
      travels.setState((draft) => {
        draft.count = 2;
      });
    });

    expect('archive' in controls!).toBe(false);
    expect('canArchive' in controls!).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      'Auto archive is enabled, no need to archive manually'
    );
    expect(travels.getPatches().patches).toHaveLength(1);
    travels.back();
    expect(travels.getState()).toEqual({ count: 0 });

    warn.mockRestore();
  });

  test('transaction navigation keeps state, position, and history aligned', () => {
    const travels = createTravels({ count: 0 });

    travels.transaction(() => {
      travels.setState((draft) => {
        draft.count = 1;
      });
      travels.back();
      travels.setState((draft) => {
        draft.count = 2;
      });
    });

    expect(travels.getState()).toEqual({ count: 2 });
    expect(travels.getPosition()).toBe(1);
    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 2]);
    expect(travels.getPatches().patches).toHaveLength(1);
    expect(travels.canForward()).toBe(false);

    travels.back();
    expect(travels.getState()).toEqual({ count: 0 });
  });

  test('nested transactions keep outer metadata', () => {
    const travels = createTravels({ count: 0 });

    travels.transaction({ label: 'Outer action' }, () => {
      travels.setState((draft) => {
        draft.count = 1;
      });
      travels.transaction({ label: 'Inner action' }, () => {
        travels.setState((draft) => {
          draft.count = 2;
        });
      });
    });

    expect(travels.getState()).toEqual({ count: 2 });
    expect(travels.getPatches().patches).toHaveLength(1);
    expect(travels.getMetadata()[0]?.label).toBe('Outer action');
  });

  test('caught nested transaction failures roll back only nested changes', () => {
    const travels = createTravels({ count: 0 });

    travels.transaction({ label: 'Outer action' }, () => {
      travels.setState((draft) => {
        draft.count = 1;
      });

      try {
        travels.transaction({ label: 'Inner action' }, () => {
          travels.setState((draft) => {
            draft.count = 2;
          });
          throw new Error('boom');
        });
      } catch {
        // Keep the outer transaction alive.
      }

      travels.setState((draft) => {
        draft.count = 3;
      });
    });

    expect(travels.getState()).toEqual({ count: 3 });
    expect(travels.getPatches().patches).toHaveLength(1);
    expect(travels.getMetadata()[0]?.label).toBe('Outer action');

    travels.back();
    expect(travels.getState()).toEqual({ count: 0 });
  });

  test('pauseTracking and replaceStateWithoutHistory update state without entries', () => {
    const travels = createTravels({ count: 0 });

    travels.setState((draft) => {
      draft.count = 1;
    });
    travels.replaceStateWithoutHistory({ count: 10 });

    expect(travels.getState()).toEqual({ count: 10 });
    expect(travels.getPosition()).toBe(0);
    expect(travels.getPatches()).toEqual({ patches: [], inversePatches: [] });

    travels.pauseTracking();
    travels.setState((draft) => {
      draft.count = 11;
    });
    travels.resumeTracking();

    expect(travels.getState()).toEqual({ count: 11 });
    expect(travels.getPatches().patches).toHaveLength(0);
  });

  test('replaceStateWithoutHistory clears history even when updater is a no-op', () => {
    const travels = createTravels({ count: 0 });

    travels.setState((draft) => {
      draft.count = 1;
    });
    travels.replaceStateWithoutHistory(() => {
      // keep the current state as the new baseline
    });

    expect(travels.getState()).toEqual({ count: 1 });
    expect(travels.getPosition()).toBe(0);
    expect(travels.getPatches()).toEqual({ patches: [], inversePatches: [] });
    expect(travels.canBack()).toBe(false);

    travels.setState((draft) => {
      draft.count = 2;
    });
    travels.reset();

    expect(travels.getState()).toEqual({ count: 1 });
  });

  test('replaceStateWithoutHistory skips notifications for clean no-ops', () => {
    const listener = vi.fn();
    const devtools = vi.fn();
    const travels = createTravels(
      { count: 0 },
      {
        devtools,
      }
    );
    travels.subscribe(listener);

    travels.replaceStateWithoutHistory(() => {
      // no state or history to replace
    });

    expect(listener).not.toHaveBeenCalled();
    expect(devtools).not.toHaveBeenCalled();
    expect(travels.getPatches()).toEqual({ patches: [], inversePatches: [] });
  });

  test('replaceStateWithoutHistory can rebase externally mutated state', () => {
    const state = { count: 0 };
    const travels = createTravels(state, {
      mutable: true,
      warnOnUnsupportedState: false,
    });

    state.count = 5;
    travels.replaceStateWithoutHistory(() => {
      // external mutable store already changed the state reference
    });

    travels.setState((draft) => {
      draft.count = 6;
    });
    travels.reset();

    expect(travels.getState()).toEqual({ count: 5 });
    expect(travels.getPosition()).toBe(0);
    expect(travels.getPatches()).toEqual({ patches: [], inversePatches: [] });
  });

  test('onBranchDiscard exposes discarded redo entries', () => {
    const discardedLabels: string[] = [];
    const travels = createTravels(
      { count: 0 },
      {
        onBranchDiscard(event) {
          discardedLabels.push(
            ...event.discarded.map((entry) => entry.metadata?.label ?? '')
          );
        },
      }
    );

    travels.setState(
      (draft) => {
        draft.count = 1;
      },
      { label: 'one' }
    );
    travels.setState(
      (draft) => {
        draft.count = 2;
      },
      { label: 'two' }
    );

    travels.back();
    travels.setState(
      (draft) => {
        draft.count = 3;
      },
      { label: 'three' }
    );

    expect(discardedLabels).toEqual(['two']);
    expect(travels.canForward()).toBe(false);
  });

  test('defers branch discard observers until the root transaction commits', () => {
    const discardedLabels: Array<Array<string | undefined>> = [];
    let callbackState: { count: number } | undefined;
    let callbackCanForward: boolean | undefined;
    const travels = createTravels(
      { count: 0 },
      {
        onBranchDiscard(event) {
          discardedLabels.push(
            event.discarded.map((entry) => entry.metadata?.label)
          );
          callbackState = travels.getState();
          callbackCanForward = travels.canForward();
        },
      }
    );

    travels.setState({ count: 1 }, { label: 'one' });
    travels.setState({ count: 2 }, { label: 'two' });
    travels.back();

    travels.transaction(() => {
      travels.setState({ count: 3 }, { label: 'three' });
      expect(discardedLabels).toEqual([]);
    });

    expect(discardedLabels).toEqual([['two']]);
    expect(callbackState).toEqual({ count: 3 });
    expect(callbackCanForward).toBe(false);
  });

  test('does not expose redo branches created and discarded inside a transaction', () => {
    const discardedLabels: Array<Array<string | undefined>> = [];
    const travels = createTravels(
      { count: 0 },
      {
        onBranchDiscard(event) {
          discardedLabels.push(
            event.discarded.map((entry) => entry.metadata?.label)
          );
        },
      }
    );

    travels.setState({ count: 1 }, { label: 'one' });

    travels.transaction(() => {
      travels.setState({ count: 2 }, { label: 'transaction-only' });
      travels.back();
      travels.setState({ count: 3 }, { label: 'committed' });
    });

    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 1, 3]);
    expect(discardedLabels).toEqual([]);
  });

  test('reports only pre-transaction entries from a mixed discarded branch', () => {
    const discarded: Array<{
      position: number;
      labels: Array<string | undefined>;
    }> = [];
    const travels = createTravels(
      { count: 0 },
      {
        onBranchDiscard(event) {
          discarded.push({
            position: event.position,
            labels: event.discarded.map((entry) => entry.metadata?.label),
          });
        },
      }
    );

    travels.setState({ count: 1 }, { label: 'one' });
    travels.setState({ count: 2 }, { label: 'two' });
    travels.setState({ count: 3 }, { label: 'three' });

    travels.transaction(() => {
      travels.setState({ count: 4 }, { label: 'transaction-only' });
      travels.back(2);
      travels.setState({ count: 5 }, { label: 'committed' });
    });

    expect(travels.getHistory().map((state) => state.count)).toEqual([
      0, 1, 2, 5,
    ]);
    expect(discarded).toEqual([{ position: 2, labels: ['three'] }]);
  });

  test('reports visible entries that follow reset-only history', () => {
    const source = createTravels({ count: 0 });
    source.setState({ count: 1 }, { label: 'one' });
    source.setState({ count: 2 }, { label: 'two' });
    const history = source.serialize();
    const discarded: Array<{
      position: number;
      labels: Array<string | undefined>;
    }> = [];
    const travels = createTravels(history.state, {
      history,
      maxHistory: 2,
      onBranchDiscard(event) {
        discarded.push({
          position: event.position,
          labels: event.discarded.map((entry) => entry.metadata?.label),
        });
      },
    });

    travels.setState({ count: 3 }, { label: 'three' });

    travels.transaction(() => {
      travels.reset();
      travels.go(0);
      travels.setState({ count: 4 }, { label: 'four' });
    });

    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 4]);
    expect(discarded).toEqual([{ position: 1, labels: ['two'] }]);
  });

  test.each([
    ['live pending history', false],
    ['serialized pending history', true],
  ] as const)('reports discarded entries from %s', (_name, restore) => {
    const discardedLabels: Array<Array<string | undefined>> = [];
    const onBranchDiscard = (event: {
      discarded: Array<{ metadata?: { label?: string } }>;
    }) => {
      discardedLabels.push(
        event.discarded.map((entry) => entry.metadata?.label)
      );
    };
    const original = createTravels(
      { count: 0 },
      { autoArchive: false, onBranchDiscard }
    );
    original.setState({ count: 1 }, { label: 'one' });
    original.archive();
    original.setState({ count: 2 }, { label: 'two' });

    const serialized = original.serialize();
    const travels = restore
      ? createTravels(serialized.state, {
          history: serialized,
          autoArchive: false,
          onBranchDiscard,
        })
      : original;

    travels.transaction(() => {
      travels.back();
      travels.setState({ count: 3 }, { label: 'three' });
    });

    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 1, 3]);
    expect(discardedLabels).toEqual([['two']]);
  });

  test('reports the root-start snapshot of an extended pending entry', () => {
    const discarded: Array<{
      position: number;
      entries: TravelHistoryEntry[];
    }> = [];
    const travels = createTravels(
      { count: 0 },
      {
        autoArchive: false,
        onBranchDiscard(event) {
          discarded.push({
            position: event.position,
            entries: event.discarded,
          });
        },
      }
    );
    travels.setState({ count: 1 }, { label: 'visible' });
    const visibleEntries = travels.getHistoryEntries();

    travels.transaction(() => {
      travels.setState({ count: 2 }, { label: 'provisional' });
      travels.back();
      travels.setState({ count: 3 }, { label: 'committed' });
    });

    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 3]);
    expect(discarded).toEqual([{ position: 0, entries: visibleEntries }]);
  });

  test('restores pending entry visibility after a nested rollback', () => {
    const discardedLabels: Array<Array<string | undefined>> = [];
    const travels = createTravels(
      { count: 0 },
      {
        autoArchive: false,
        onBranchDiscard(event) {
          discardedLabels.push(
            event.discarded.map((entry) => entry.metadata?.label)
          );
        },
      }
    );
    travels.setState({ count: 1 }, { label: 'one' });
    travels.archive();
    travels.setState({ count: 2 }, { label: 'two' });

    travels.transaction(() => {
      try {
        travels.transaction(() => {
          travels.reset();
          throw new Error('nested failure');
        });
      } catch {
        // Continue the root transaction with its pending entry restored.
      }

      travels.back();
      travels.setState({ count: 3 }, { label: 'three' });
    });

    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 1, 3]);
    expect(discardedLabels).toEqual([['two']]);
  });

  test('uses the public manual-history window for transaction effects', () => {
    const source = createTravels({ count: 0 });
    source.setState({ count: 1 }, { label: 'one' });
    source.setState({ count: 2 }, { label: 'two' });
    const history = source.serialize();
    const discarded: Array<{
      position: number;
      labels: Array<string | undefined>;
    }> = [];
    const travels = createTravels(history.state, {
      history,
      autoArchive: false,
      maxHistory: 2,
      onBranchDiscard(event) {
        discarded.push({
          position: event.position,
          labels: event.discarded.map((entry) => entry.metadata?.label),
        });
      },
    });

    travels.setState({ count: 3 }, { label: 'three' });

    travels.transaction(() => {
      travels.reset();
      travels.go(0);
      travels.setState({ count: 4 }, { label: 'four' });
    });

    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 4]);
    expect(discarded).toEqual([{ position: 1, labels: ['two'] }]);
  });

  test('does not republish a branch restored only inside a transaction', () => {
    const source = createTravels({ count: 0 });
    source.setState({ count: 1 }, { label: 'one' });
    source.setState({ count: 2 }, { label: 'two' });
    source.back();
    const history = source.serialize();
    const discardedLabels: Array<Array<string | undefined>> = [];
    const travels = createTravels(history.state, {
      history,
      onBranchDiscard(event) {
        discardedLabels.push(
          event.discarded.map((entry) => entry.metadata?.label)
        );
      },
    });

    travels.setState({ count: 3 }, { label: 'outside transaction' });
    expect(discardedLabels).toEqual([['two']]);

    travels.transaction(() => {
      travels.reset();
      travels.setState({ count: 4 }, { label: 'committed' });
    });

    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 1, 4]);
    expect(discardedLabels).toEqual([['two']]);
  });

  test('drops branch discard effects when root or nested transactions roll back', () => {
    const discardedLabels: Array<Array<string | undefined>> = [];
    const travels = createTravels(
      { count: 0 },
      {
        onBranchDiscard(event) {
          discardedLabels.push(
            event.discarded.map((entry) => entry.metadata?.label)
          );
        },
      }
    );

    travels.setState({ count: 1 }, { label: 'one' });
    travels.setState({ count: 2 }, { label: 'two' });
    travels.back();

    expect(() =>
      travels.transaction(() => {
        travels.setState({ count: 3 }, { label: 'rolled back root' });
        throw new Error('root failure');
      })
    ).toThrow(TravelsError);

    expect(discardedLabels).toEqual([]);
    expect(travels.getState()).toEqual({ count: 1 });
    expect(travels.canForward()).toBe(true);

    travels.transaction(() => {
      try {
        travels.transaction(() => {
          travels.setState({ count: 4 }, { label: 'rolled back nested' });
          throw new Error('nested failure');
        });
      } catch {
        // Keep the root transaction alive after the nested rollback.
      }

      expect(discardedLabels).toEqual([]);
      expect(travels.canForward()).toBe(true);
      travels.setState({ count: 5 }, { label: 'committed root' });
      expect(discardedLabels).toEqual([]);
    });

    expect(discardedLabels).toEqual([['two']]);
    expect(travels.getState()).toEqual({ count: 5 });
    expect(travels.canForward()).toBe(false);
  });

  test('cancels deferred branch discards when reset restores the branch', () => {
    const source = createTravels({ count: 0 });
    source.setState({ count: 1 }, { label: 'one' });
    source.setState({ count: 2 }, { label: 'two' });
    source.back();
    const history = source.serialize();
    const discardedLabels: Array<Array<string | undefined>> = [];
    const travels = createTravels(history.state, {
      history,
      onBranchDiscard(event) {
        discardedLabels.push(
          event.discarded.map((entry) => entry.metadata?.label)
        );
      },
    });

    travels.transaction(() => {
      travels.setState({ count: 3 }, { label: 'superseded edit' });
      travels.reset();
    });

    expect(travels.getState()).toEqual({ count: 1 });
    expect(travels.getPosition()).toBe(1);
    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 1, 2]);
    expect(travels.canForward()).toBe(true);
    expect(discardedLabels).toEqual([]);

    travels.setState({ count: 4 }, { label: 'later edit' });
    expect(discardedLabels).toEqual([['two']]);
  });

  test('keeps deferred discards when reset does not restore the branch', () => {
    const discardedLabels: Array<Array<string | undefined>> = [];
    const travels = createTravels(
      { count: 0 },
      {
        onBranchDiscard(event) {
          discardedLabels.push(
            event.discarded.map((entry) => entry.metadata?.label)
          );
        },
      }
    );
    travels.setState({ count: 1 }, { label: 'one' });
    travels.setState({ count: 2 }, { label: 'two' });
    travels.back();

    travels.transaction(() => {
      travels.setState({ count: 3 }, { label: 'three' });
      travels.reset();
    });

    expect(travels.getHistory().map((state) => state.count)).toEqual([0]);
    expect(travels.canForward()).toBe(false);
    expect(discardedLabels).toEqual([['two']]);
  });

  test('cancels only entries actually restored by reset', () => {
    const source = createTravels({ count: 0 });
    source.setState({ count: 1 }, { label: 'one' });
    source.setState({ count: 2 }, { label: 'two' });
    const history = source.serialize();
    const discarded: Array<{
      position: number;
      labels: Array<string | undefined>;
    }> = [];
    const travels = createTravels(history.state, {
      history,
      onBranchDiscard(event) {
        discarded.push({
          position: event.position,
          labels: event.discarded.map((entry) => entry.metadata?.label),
        });
      },
    });
    travels.setState({ count: 3 }, { label: 'three' });
    travels.go(0);

    travels.transaction(() => {
      travels.setState({ count: 4 }, { label: 'four' });
      travels.reset();
    });

    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 1, 2]);
    expect(travels.getPosition()).toBe(2);
    expect(discarded).toEqual([{ position: 2, labels: ['three'] }]);
  });

  test('publishes only the branch discard created after a transaction reset', () => {
    const source = createTravels({ count: 0 });
    source.setState({ count: 1 }, { label: 'one' });
    source.setState({ count: 2 }, { label: 'two' });
    source.back();
    const history = source.serialize();
    const discardedLabels: Array<Array<string | undefined>> = [];
    const travels = createTravels(history.state, {
      history,
      onBranchDiscard(event) {
        discardedLabels.push(
          event.discarded.map((entry) => entry.metadata?.label)
        );
      },
    });

    travels.transaction(() => {
      travels.setState({ count: 3 }, { label: 'superseded edit' });
      travels.reset();
      travels.setState({ count: 4 }, { label: 'committed edit' });
      expect(discardedLabels).toEqual([]);
    });

    expect(travels.getState()).toEqual({ count: 4 });
    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 1, 4]);
    expect(travels.canForward()).toBe(false);
    expect(discardedLabels).toEqual([['two']]);
  });

  test('restores outer branch effects when a nested reset rolls back', () => {
    const source = createTravels({ count: 0 });
    source.setState({ count: 1 }, { label: 'one' });
    source.setState({ count: 2 }, { label: 'two' });
    source.back();
    const history = source.serialize();
    const discardedLabels: Array<Array<string | undefined>> = [];
    const travels = createTravels(history.state, {
      history,
      onBranchDiscard(event) {
        discardedLabels.push(
          event.discarded.map((entry) => entry.metadata?.label)
        );
      },
    });

    travels.transaction(() => {
      travels.setState({ count: 3 }, { label: 'committed outer edit' });

      try {
        travels.transaction(() => {
          travels.reset();
          expect(travels.canForward()).toBe(true);
          throw new Error('nested reset failed');
        });
      } catch {
        // Keep the root transaction alive after restoring its effect queue.
      }

      expect(travels.getState()).toEqual({ count: 3 });
      expect(travels.canForward()).toBe(false);
      expect(discardedLabels).toEqual([]);
    });

    expect(discardedLabels).toEqual([['two']]);
    expect(travels.getHistory().map((state) => state.count)).toEqual([0, 1, 3]);
  });

  test.each([
    ['rebase', 3],
    ['replaceStateWithoutHistory', 4],
  ] as const)(
    'keeps deferred branch effects when %s changes the reset baseline',
    (operation, expectedCount) => {
      const source = createTravels({ count: 0 });
      source.setState({ count: 1 }, { label: 'one' });
      source.setState({ count: 2 }, { label: 'two' });
      source.back();
      const history = source.serialize();
      const discardedLabels: Array<Array<string | undefined>> = [];
      const travels = createTravels(history.state, {
        history,
        onBranchDiscard(event) {
          discardedLabels.push(
            event.discarded.map((entry) => entry.metadata?.label)
          );
        },
      });

      travels.transaction(() => {
        travels.setState({ count: 3 }, { label: 'discard old branch' });
        if (operation === 'rebase') {
          travels.rebase();
        } else {
          travels.replaceStateWithoutHistory({ count: expectedCount });
        }
        travels.reset();
      });

      expect(travels.getState()).toEqual({ count: expectedCount });
      expect(travels.getHistory().map((state) => state.count)).toEqual([
        expectedCount,
      ]);
      expect(travels.canForward()).toBe(false);
      expect(discardedLabels).toEqual([['two']]);
    }
  );

  test('reset keeps visible effects absent from its restored history', () => {
    const source = createTravels({ count: 0 });
    source.setState({ count: 1 }, { label: 'one' });
    source.setState({ count: 2 }, { label: 'two' });
    source.back();
    const history = source.serialize();
    const discardedLabels: Array<Array<string | undefined>> = [];
    const travels = createTravels(history.state, {
      history,
      onBranchDiscard(event) {
        discardedLabels.push(
          event.discarded.map((entry) => entry.metadata?.label)
        );
      },
    });

    travels.transaction(() => {
      travels.setState({ count: 3 }, { label: 'discard old baseline' });
      travels.rebase();
      travels.setState({ count: 4 }, { label: 'new future' });
      travels.back();
      travels.setState({ count: 5 }, { label: 'discard new baseline' });
      travels.reset();
    });

    expect(travels.getState()).toEqual({ count: 3 });
    expect(travels.getHistory().map((state) => state.count)).toEqual([3]);
    expect(discardedLabels).toEqual([['two']]);
  });

  test('devtools receives timeline events', () => {
    const events: string[] = [];
    const travels = createTravels(
      { count: 0 },
      {
        devtools(event) {
          events.push(event.type);
        },
      }
    );

    travels.setState((draft) => {
      draft.count = 1;
    });
    travels.back();
    travels.reset();

    expect(events).toEqual(['setState', 'go', 'reset']);
  });

  test('subscribers and devtools share one patches snapshot per event', () => {
    const snapshots: unknown[] = [];
    const travels = createTravels(
      { count: 0 },
      {
        devtools(event) {
          snapshots.push(event.patches);
        },
      }
    );
    const getPatchesSpy = vi.spyOn(travels, 'getPatches');

    travels.subscribe(({ patches }) => snapshots.push(patches));
    travels.subscribe(({ patches }) => snapshots.push(patches));
    travels.setState((draft) => {
      draft.count = 1;
    });

    expect(getPatchesSpy).not.toHaveBeenCalled();
    expect(snapshots).toHaveLength(3);
    expect(snapshots[0]).toBe(snapshots[1]);
    expect(snapshots[1]).toBe(snapshots[2]);
    expect(
      (snapshots[0] as ReturnType<typeof travels.getPatches>).patches
    ).toHaveLength(1);
  });

  test('getHistory returns a frozen cached array with shared entries', () => {
    const travels = createTravels({ count: 0 });

    travels.setState((draft) => {
      draft.count = 1;
    });

    const history = travels.getHistory();
    const cachedHistory = travels.getHistory();

    if (process.env.NODE_ENV !== 'production') {
      expect(Object.isFrozen(history)).toBe(true);
    }
    expect(cachedHistory).toBe(history);
    expect(cachedHistory[0]).toBe(history[0]);
  });

  test('onError receives typed transaction errors', () => {
    const onError = vi.fn();
    const travels = createTravels(
      { count: 0 },
      {
        onError,
      }
    );

    expect(() =>
      travels.transaction({ label: 'Failing action' }, () => {
        throw new Error('boom');
      })
    ).toThrow(TravelsError);

    expect(onError).toHaveBeenCalledWith(expect.any(TravelsError));
    expect(onError.mock.calls[0][0].code).toBe('TRANSACTION_FAILED');
  });

  test('failed transactions roll back partial state and history changes', () => {
    const travels = createTravels({ count: 0 });

    expect(() =>
      travels.transaction({ label: 'Broken action' }, () => {
        travels.setState((draft) => {
          draft.count = 1;
        });
        throw new Error('boom');
      })
    ).toThrow(TravelsError);

    expect(travels.getState()).toEqual({ count: 0 });
    expect(travels.getPosition()).toBe(0);
    expect(travels.getPatches()).toEqual({ patches: [], inversePatches: [] });
    expect(travels.getMetadata()).toEqual([]);
    expect(travels.canBack()).toBe(false);
  });

  test('failed mutable transactions restore the original root reference', () => {
    const original = { count: 0 };
    const replacement = [1, 2];
    const travels = createTravels<any>(original, {
      mutable: true,
      warnOnUnsupportedState: false,
    });

    expect(() =>
      travels.transaction(() => {
        travels.setState(() => replacement);
        throw new Error('boom');
      })
    ).toThrow(TravelsError);

    expect(travels.getState()).toBe(original);
    expect(travels.getState()).toEqual({ count: 0 });
    expect(replacement).toEqual([1, 2]);
    expect(travels.getPosition()).toBe(0);
    expect(travels.getPatches()).toEqual({ patches: [], inversePatches: [] });
  });
  test('failed transactions restore the tracking pause depth', () => {
    const travels = createTravels({ count: 0 });

    expect(() =>
      travels.transaction(() => {
        travels.pauseTracking();
        throw new Error('boom');
      })
    ).toThrow(TravelsError);

    travels.setState((draft) => {
      draft.count = 1;
    });

    expect(travels.getState()).toEqual({ count: 1 });
    expect(travels.getPosition()).toBe(1);
    expect(travels.getPatches().patches).toHaveLength(1);
  });

  test('rejects known async state updaters before invocation', () => {
    const travels = createTravels({ count: 0 });
    let calls = 0;
    const updater = async (draft: { count: number }) => {
      calls += 1;
      draft.count = 1;
    };

    for (const candidate of [
      updater,
      updater.bind(undefined),
      new Proxy(updater, {}),
      async function* generator() {
        calls += 1;
      },
    ]) {
      expect(() => travels.setState(candidate as any)).toThrow(
        'setState callback must be synchronous'
      );
    }

    expect(calls).toBe(0);
    expect(travels.getState()).toEqual({ count: 0 });
    expect(travels.getPosition()).toBe(0);
  });

  test('rolls back Promise-like results without assimilating thenables', async () => {
    let thenCalls = 0;
    const thenable = {
      then() {
        thenCalls += 1;
      },
    };

    for (const result of [Promise.resolve(), thenable]) {
      const travels = createTravels({ count: 0 });

      expect(() =>
        travels.setState(((draft: { count: number }) => {
          draft.count = 1;
          return result;
        }) as any)
      ).toThrow('setState callback must be synchronous');

      expect(travels.getState()).toEqual({ count: 0 });
      expect(travels.getPosition()).toBe(0);
    }

    await Promise.resolve();
    expect(thenCalls).toBe(0);
  });

  test('rejects async transactions before invocation', () => {
    const onError = vi.fn();
    const travels = createTravels({ count: 0 }, { onError });
    let called = false;
    const transaction = async () => {
      called = true;
      travels.setState((draft) => {
        draft.count = 1;
      });
    };

    expect(() => travels.transaction(transaction as any)).toThrow(TravelsError);
    expect(called).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    expect(travels.getState()).toEqual({ count: 0 });
    expect(travels.getPatches().patches).toHaveLength(0);
  });

  test('rolls back transactions that return Promise-like values', () => {
    const travels = createTravels({ count: 0 });

    expect(() =>
      travels.transaction((() => {
        travels.setState((draft) => {
          draft.count = 1;
        });
        return { then() {} };
      }) as any)
    ).toThrow(TravelsError);

    expect(travels.getState()).toEqual({ count: 0 });
    expect(travels.getPatches().patches).toHaveLength(0);
  });
});
