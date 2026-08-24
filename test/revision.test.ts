import { apply, create, type Draft, type Patches } from 'mutative';
import { describe, expect, it } from 'vitest';
import { createTravelJournal, createTravels } from '../src/index';

describe('timeline revision', () => {
  it('advances once for each committed observable transition', () => {
    const travels = createTravels(
      { count: 0 },
      { autoArchive: false as const }
    );
    const observed: number[] = [];
    travels.subscribe(() => observed.push(travels.getRevision()));

    expect(travels.getRevision()).toBe(0);

    travels.setState(() => undefined);
    expect(travels.getRevision()).toBe(0);

    travels.setState((draft) => {
      draft.count += 1;
    });
    travels.archive();
    travels.rebase();

    expect(observed).toEqual([1, 2, 3]);
    expect(travels.getRevision()).toBe(3);
  });

  it('collapses transactions and ignores rolled-back work', () => {
    const travels = createTravels({ count: 0 });

    travels.transaction(() => {
      travels.setState((draft) => {
        draft.count += 1;
      });
      travels.setState((draft) => {
        draft.count += 1;
      });
    });

    expect(travels.getRevision()).toBe(1);

    expect(() =>
      travels.transaction(() => {
        travels.setState((draft) => {
          draft.count += 1;
        });
        throw new Error('rollback');
      })
    ).toThrow('Travels: TRANSACTION_FAILED');
    expect(travels.getState()).toEqual({ count: 2 });
    expect(travels.getRevision()).toBe(1);
  });

  it('is available on externally owned journals', () => {
    type State = { count: number };
    let authoritativeState: State = { count: 0 };
    const journal = createTravelJournal(authoritativeState, {
      apply: ({ patches }) => {
        authoritativeState = apply(authoritativeState, patches);
        return authoritativeState;
      },
    });
    const [nextState, patches, inversePatches] = create(
      authoritativeState,
      (draft: Draft<State>) => {
        draft.count = 1;
      },
      { enablePatches: true }
    ) as [State, Patches, Patches];

    authoritativeState = nextState;
    journal.recordPatches(nextState, { patches, inversePatches });

    expect(journal.getRevision()).toBe(1);
    journal.back();
    expect(journal.getRevision()).toBe(2);
    expect(authoritativeState).toEqual({ count: 0 });
  });
});
