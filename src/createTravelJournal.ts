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
 * State-owning methods such as `setState()`, transactions, tracking controls,
 * and `getControls()` are intentionally excluded. External commits enter
 * through `recordPatches()`; navigation and reset leave through `apply`.
 */
export type TravelJournal<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
  A extends boolean = true,
> = Readonly<
  Pick<
    Travels<S, F, A, P>,
    | 'subscribe'
    | 'getState'
    | 'getRevision'
    | 'getHistory'
    | 'getHistorySnapshot'
    | 'go'
    | 'back'
    | 'forward'
    | 'reset'
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
  } & (A extends false
      ? Pick<Travels<S, F, A, P>, 'archive' | 'canArchive'>
      : {})
>;

export type TravelJournalOptions<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
  A extends boolean = true,
> = Omit<TravelsOptions<F, A, P>, 'mutable'> & {
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
  A extends boolean = true,
>(
  source:
    | { type: 'initial'; state: S }
    | { type: 'snapshot'; snapshot: TravelsSerializedHistory<S, P> },
  options: TravelJournalOptions<S, F, P, A>
): TravelJournal<S, F, P, A> => {
  assertPublicFactoryOptions(options, {
    capability: 'journal',
    restoreFactory: 'restoreTravelJournal',
  });
  const { apply, autoArchive = true as A, ...travelsOptions } = options;
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
  const core = new TravelsCore<S, F, A, P>(source, {
    ...travelsOptions,
    autoArchive,
    mutable: false,
    controlledApply: apply,
  });

  const journal = {
    subscribe: core.subscribe,
    getState: () => core.getState(),
    getRevision: () => core.getRevision(),
    recordPatches: (state: S, entry: TravelHistoryEntry<P>) =>
      core[RECORD_TRAVEL_JOURNAL_PATCHES](state, entry),
    getHistory: () => core.getHistory(),
    getHistorySnapshot: () => core.getHistorySnapshot(),
    go: (position: number) => core.go(position),
    back: (amount?: number) => core.back(amount),
    forward: (amount?: number) => core.forward(amount),
    reset: () => core.reset(),
    rebase: () => core.rebase(),
    canBack: () => core.canBack(),
    canForward: () => core.canForward(),
    getPosition: () => core.getPosition(),
    getPatches: () => core.getPatches(),
    serialize: (serializeOptions?: Parameters<typeof core.serialize>[0]) =>
      core.serialize(serializeOptions),
    assertPersistenceCompatible: () => core.assertPersistenceCompatible(),
    getMetadata: () => core.getMetadata(),
    getHistoryEntries: () => core.getHistoryEntries(),
  };

  if (!autoArchive) {
    Object.assign(journal, {
      archive: (metadata?: Parameters<typeof core.archive>[0]) =>
        core.archive(metadata),
      canArchive: () => core.canArchive(),
    });
  }

  return Object.freeze(journal) as TravelJournal<S, F, P, A>;
};

export const createTravelJournal = <
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
  A extends boolean = true,
>(
  initialState: S,
  options: TravelJournalOptions<S, F, P, A>
): TravelJournal<S, F, P, A> => {
  return createJournal({ type: 'initial', state: initialState }, options);
};

/** Restore an externally owned journal from one complete persisted snapshot. */
export const restoreTravelJournal = <
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
  A extends boolean = true,
>(
  snapshot: TravelsSerializedHistory<S, P>,
  options: TravelJournalOptions<S, F, P, A>
): TravelJournal<S, F, P, A> => {
  return createJournal({ type: 'snapshot', snapshot }, options);
};
