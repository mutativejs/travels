import { Travels } from './travels.js';
import type {
  PatchesOption,
  TravelsControlledApply,
  TravelsOptions,
} from './type.js';

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
> = Pick<
  Travels<S, F, true, P>,
  | 'subscribe'
  | 'getState'
  | 'recordPatches'
  | 'getHistory'
  | 'go'
  | 'back'
  | 'forward'
  | 'rebase'
  | 'canBack'
  | 'canForward'
  | 'getPosition'
  | 'getPatches'
  | 'serialize'
  | 'getMetadata'
  | 'getHistoryEntries'
>;

export type TravelJournalOptions<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
> = Omit<
  TravelsOptions<F, true, P>,
  'autoArchive' | 'controlledApply' | 'mutable'
> & {
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
export const createTravelJournal = <
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  initialState: S,
  options: TravelJournalOptions<S, F, P>
): TravelJournal<S, F, P> => {
  const { apply, ...travelsOptions } = options;
  if (typeof apply !== 'function') {
    throw new TypeError(
      'Travels: createTravelJournal requires a synchronous apply function.'
    );
  }
  return new Travels(initialState, {
    ...travelsOptions,
    autoArchive: true,
    mutable: false,
    controlledApply: apply,
  });
};
