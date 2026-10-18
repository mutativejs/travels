import { describe, expect, test, vi } from 'vitest';
import { createTravels, type TravelsEvent } from '../src/index';

type State = { a: number; nested: { b: number } };

const createState = (): State => ({ a: 0, nested: { b: 0 } });

describe('updates that cancel out', () => {
  test.each([false, true])(
    'leave no trace when a transaction makes them with mutable=%s',
    (mutable) => {
      const initial = createState();
      const travels = createTravels(initial, { mutable });
      const events: TravelsEvent<State>['type'][] = [];
      travels.subscribe((event) => events.push(event.type));

      travels.transaction({ label: 'round trip' }, () => {
        travels.setState((draft) => {
          draft.a = 1;
          draft.nested.b = 1;
        });
        travels.setState((draft) => {
          draft.a = 0;
        });
        travels.setState((draft) => {
          draft.nested.b = 0;
        });
      });

      expect(travels.getState()).toBe(initial);
      expect(travels.getState()).toEqual(createState());
      expect(travels.getPosition()).toBe(0);
      expect(travels.getHistory()).toHaveLength(1);
      expect(travels.getRevision()).toBe(0);
      expect(events).toEqual([]);
    }
  );

  test('keep the redo branch of a transaction made at a past position', () => {
    const onBranchDiscard = vi.fn();
    const travels = createTravels(createState(), { onBranchDiscard });
    travels.setState((draft) => {
      draft.a = 1;
    });
    travels.setState((draft) => {
      draft.a = 2;
    });
    travels.back();
    const revision = travels.getRevision();

    travels.transaction(() => {
      travels.setState((draft) => {
        draft.a = 5;
      });
      travels.setState((draft) => {
        draft.a = 1;
      });
    });

    expect(travels.getPosition()).toBe(1);
    expect(travels.getHistory().map((state) => state.a)).toEqual([0, 1, 2]);
    expect(travels.canForward()).toBe(true);
    expect(travels.getRevision()).toBe(revision);
    expect(onBranchDiscard).not.toHaveBeenCalled();
  });

  test('count a value replaced by an equal copy as a change', () => {
    const travels = createTravels(createState());

    travels.transaction(() => {
      travels.setState((draft) => {
        draft.nested = { b: 1 };
      });
      travels.setState((draft) => {
        draft.nested = { b: 0 };
      });
    });

    // A single update that assigns an equal copy is recorded too.
    expect(travels.getPosition()).toBe(1);
  });

  test('add no entry to a transaction that also navigates', () => {
    const travels = createTravels(createState());
    travels.setState((draft) => {
      draft.a = 1;
    });
    const events: TravelsEvent<State>['type'][] = [];
    travels.subscribe((event) => events.push(event.type));

    travels.transaction(() => {
      travels.back();
      travels.forward();
      travels.setState((draft) => {
        draft.nested.b = 1;
      });
      travels.setState((draft) => {
        draft.nested.b = 0;
      });
    });

    expect(events).toEqual(['transaction']);
    expect(travels.getPosition()).toBe(1);
    expect(travels.getHistory().map((state) => state.a)).toEqual([0, 1]);
  });

  test('are dropped instead of archived in manual mode', () => {
    const travels = createTravels(createState(), { autoArchive: false });
    travels.setState((draft) => {
      draft.a = 1;
    });
    travels.setState((draft) => {
      draft.a = 0;
    });
    expect(travels.getPosition()).toBe(1);
    const events: TravelsEvent<State>['type'][] = [];
    travels.subscribe((event) => events.push(event.type));

    travels.archive({ label: 'round trip' });

    expect(events).toEqual(['archive']);
    expect(travels.getPosition()).toBe(0);
    expect(travels.getHistory()).toHaveLength(1);
    expect(travels.getMetadata()).toEqual([]);
    expect(travels.canArchive()).toBe(false);
    expect(travels.canBack()).toBe(false);
  });

  test('leave earlier pending edits pending when a transaction makes them', () => {
    const travels = createTravels(createState(), { autoArchive: false });
    travels.setState((draft) => {
      draft.a = 1;
    });
    const revision = travels.getRevision();

    travels.transaction(() => {
      travels.setState((draft) => {
        draft.nested.b = 1;
      });
      travels.setState((draft) => {
        draft.nested.b = 0;
      });
    });

    expect(travels.canArchive()).toBe(true);
    expect(travels.getPosition()).toBe(1);
    expect(travels.getRevision()).toBe(revision);
  });
});
