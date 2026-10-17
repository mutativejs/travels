import type { PatchesOption, TravelsOptions } from './type.js';
import { createStateOwningTravels, type Travels } from './travels.js';
import { assertPublicFactoryOptions } from './internal/public-options.js';

/**
 * Create a new Travels instance with auto archive mode
 */
export function createTravels<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  initialState: S,
  options?: Omit<TravelsOptions<F, true, P, S>, 'autoArchive'> & {
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
  options: Omit<TravelsOptions<F, false, P, S>, 'autoArchive'> & {
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
  options: TravelsOptions<F, A, P, S>
): Travels<S, F, A, P>;

/**
 * Create a new Travels instance
 */
export function createTravels<
  S,
  F extends boolean,
  A extends boolean,
  P extends PatchesOption = {},
>(initialState: S, options: TravelsOptions<F, A, P, S> = {}): Travels<S, F, A, P> {
  assertPublicFactoryOptions(options, {
    capability: 'state',
    restoreFactory: 'restoreTravels',
  });
  return createStateOwningTravels<S, F, A, P>(
    { type: 'initial', state: initialState },
    options
  );
}
