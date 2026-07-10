import { describe, expect, test, vi } from 'vitest';
import { createTravels, TravelsError } from '../src/index';

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

    travels.setState((draft) => {
      draft.count = 1;
    }, { label: 'one' });
    travels.setState((draft) => {
      draft.count = 2;
    }, { label: 'two' });

    travels.back();
    travels.setState((draft) => {
      draft.count = 3;
    }, { label: 'three' });

    expect(discardedLabels).toEqual(['two']);
    expect(travels.canForward()).toBe(false);
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

    travels.subscribe((_state, patches) => snapshots.push(patches));
    travels.subscribe((_state, patches) => snapshots.push(patches));
    travels.setState((draft) => {
      draft.count = 1;
    });

    expect(getPatchesSpy).toHaveBeenCalledTimes(1);
    expect(snapshots).toHaveLength(3);
    expect(snapshots[0]).toBe(snapshots[1]);
    expect(snapshots[1]).toBe(snapshots[2]);
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
});
