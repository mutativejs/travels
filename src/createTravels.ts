import type { PatchesOption, TravelsOptions } from './type';
import { Travels } from './travels';


/**
 * Create a new Travels instance with auto archive mode
 */
export function createTravels<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  initialState: S,
  options?: Omit<TravelsOptions<F, true, P>, 'autoArchive'> & {
    autoArchive?: true;
  }
): Travels<S, F, true, P>;

/**
 * Create a new Travels instance with manual archive mode
 */
export function createTravels<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  initialState: S,
  options: Omit<TravelsOptions<F, false, P>, 'autoArchive'> & {
    autoArchive: false;
  }
): Travels<S, F, false, P>;

/**
 * Create a new Travels instance
 */
export function createTravels<
  S,
  F extends boolean,
  A extends boolean,
  P extends PatchesOption = {},
>(initialState: S, options: TravelsOptions<F, A, P> = {}): Travels<S, F, A, P> {
  return new Travels(initialState, options);
}
