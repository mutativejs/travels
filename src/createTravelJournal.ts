import { TravelsTypeError } from './errors.js';
import {
  RECORD_TRAVEL_JOURNAL_PATCHES,
  TravelsCore,
  type Travels,
} from './travels.js';
import type {
  PatchesOption,
  TravelHistoryEntry,
  TravelsControlledApply,
  TravelsOptions,
  TravelsSerializedHistory,
} from './type.js';
import { assertPublicFactoryOptions } from './internal/factory-options.js';

/**
 * Public surface for a timeline whose state is owned by another runtime.
 *
 * State-owning methods such as `setState()`, `reset()`, transactions, tracking
 * controls, and `getControls()` are intentionally excluded. External commits
 * enter through `recordPatches()`; navigation leaves through `apply`.
 */
export type TravelJournal<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
> = Readonly<
  Pick<
    Travels<S, F, true, P>,
    | 'subscribe'
    | 'getState'
    | 'getRevision'
    | 'getHistory'
    | 'getHistorySnapshot'
    | 'go'
    | 'back'
    | 'forward'
    | 'rebase'
    | 'canBack'
    | 'canForward'
    | 'getPosition'
    | 'getPatches'
    | 'serialize'
    | 'assertPersistenceCompatible'
    | 'getMetadata'
    | 'getHistoryEntries'
  > & {
    recordPatches: (state: S, entry: TravelHistoryEntry<P>) => void;
  }
>;

export type TravelJournalOptions<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
> = Omit<TravelsOptions<F, true, P>, 'autoArchive' | 'mutable'> & {
  /** Apply a navigation transition through the external state owner. */
  apply: TravelsControlledApply<S, P>;
};

/**
 * Create a Travels timeline for a state owned and committed by another runtime.
 *
 * Use `recordPatches()` after the external runtime commits an update. Undo and
 * redo are delegated back through `options.apply`, so the external runtime can
 * preserve its own validation, subscriptions, transports, and reference rules.
 * The returned interface excludes state-owning Travels operations that could
 * bypass the external owner.
 */
const createJournal = <
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  source:
    | { type: 'initial'; state: S }
    | { type: 'snapshot'; snapshot: TravelsSerializedHistory<S, P> },
  options: TravelJournalOptions<S, F, P>
): TravelJournal<S, F, P> => {
  assertPublicFactoryOptions(options, {
    capability: 'journal',
    restoreFactory: 'restoreTravelJournal',
  });
  const { apply, ...travelsOptions } = options;
  if (typeof apply !== 'function') {
    const factoryName =
      source.type === 'initial'
        ? 'createTravelJournal'
        : 'restoreTravelJournal';
    throw new TravelsTypeError(
      'INVALID_OPTION',
      `Travels: ${factoryName} requires a synchronous apply function.`
    );
  }
  const core = new TravelsCore<S, F, true, P>(source, {
    ...travelsOptions,
    autoArchive: true,
    mutable: false,
    controlledApply: apply,
  });

  const journal: TravelJournal<S, F, P> = {
    subscribe: core.subscribe,
    getState: () => core.getState(),
    getRevision: () => core.getRevision(),
    recordPatches: (state, entry) =>
      core[RECORD_TRAVEL_JOURNAL_PATCHES](state, entry),
    getHistory: () => core.getHistory(),
    getHistorySnapshot: () => core.getHistorySnapshot(),
    go: (position) => core.go(position),
    back: (amount) => core.back(amount),
    forward: (amount) => core.forward(amount),
    rebase: () => core.rebase(),
    canBack: () => core.canBack(),
    canForward: () => core.canForward(),
    getPosition: () => core.getPosition(),
    getPatches: () => core.getPatches(),
    serialize: (serializeOptions) => core.serialize(serializeOptions),
    assertPersistenceCompatible: () => core.assertPersistenceCompatible(),
    getMetadata: () => core.getMetadata(),
    getHistoryEntries: () => core.getHistoryEntries(),
  };

  return Object.freeze(journal);
};

export const createTravelJournal = <
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  initialState: S,
  options: TravelJournalOptions<S, F, P>
): TravelJournal<S, F, P> => {
  return createJournal({ type: 'initial', state: initialState }, options);
};

/** Restore an externally owned journal from one complete persisted snapshot. */
export const restoreTravelJournal = <
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  snapshot: TravelsSerializedHistory<S, P>,
  options: TravelJournalOptions<S, F, P>
): TravelJournal<S, F, P> => {
  return createJournal({ type: 'snapshot', snapshot }, options);
};
