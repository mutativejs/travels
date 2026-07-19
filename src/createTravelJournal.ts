import { Travels } from './travels.js';
import type {
  PatchesOption,
  TravelsControlledApply,
  TravelsOptions,
} from './type.js';

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
 */
export const createTravelJournal = <
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  initialState: S,
  options: TravelJournalOptions<S, F, P>
): Travels<S, F, true, P> => {
  const { apply, ...travelsOptions } = options;
  return new Travels(initialState, {
    ...travelsOptions,
    autoArchive: true,
    mutable: false,
    controlledApply: apply,
  });
};
