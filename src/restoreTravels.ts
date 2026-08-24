import type {
  PatchesOption,
  TravelsOptions,
  TravelsSerializedHistory,
} from './type.js';
import { TravelsCore, type Travels } from './travels.js';

/** Restore an auto-archiving timeline from one complete persisted snapshot. */
export function restoreTravels<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  snapshot: TravelsSerializedHistory<S, P>,
  options?: Omit<TravelsOptions<F, true, P>, 'autoArchive'> & {
    autoArchive?: true;
  }
): Travels<S, F, true, P>;

/** Restore a manually archived timeline from one complete persisted snapshot. */
export function restoreTravels<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  snapshot: TravelsSerializedHistory<S, P>,
  options: Omit<TravelsOptions<F, false, P>, 'autoArchive'> & {
    autoArchive: false;
  }
): Travels<S, F, false, P>;

/** Restore a timeline whose archive mode is selected dynamically. */
export function restoreTravels<
  S,
  F extends boolean = false,
  A extends boolean = true,
  P extends PatchesOption = {},
>(
  snapshot: TravelsSerializedHistory<S, P>,
  options: TravelsOptions<F, A, P>
): Travels<S, F, A, P>;

export function restoreTravels<
  S,
  F extends boolean,
  A extends boolean,
  P extends PatchesOption = {},
>(
  snapshot: TravelsSerializedHistory<S, P>,
  options: TravelsOptions<F, A, P> = {}
): Travels<S, F, A, P> {
  return new TravelsCore<S, F, A, P>({ type: 'snapshot', snapshot }, options);
}
