import type { PatchesOption, TravelsOptions } from './type.js';
import { TravelsCore, type Travels } from './travels.js';
import { assertNoHistoryOption } from './internal/factory-options.js';

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
 * Create a new Travels instance when the archive mode is selected dynamically
 * or forwarded through a generic adapter.
 */
export function createTravels<
  S,
  F extends boolean = false,
  A extends boolean = true,
  P extends PatchesOption = {},
>(
  initialState: S,
  options: TravelsOptions<F, A, P>
): Travels<S, F, A, P>;

/**
 * Create a new Travels instance
 */
export function createTravels<
  S,
  F extends boolean,
  A extends boolean,
  P extends PatchesOption = {},
>(initialState: S, options: TravelsOptions<F, A, P> = {}): Travels<S, F, A, P> {
  assertNoHistoryOption(options, 'restoreTravels');
  return new TravelsCore<S, F, A, P>(
    { type: 'initial', state: initialState },
    options
  );
}
