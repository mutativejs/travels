import { findStateCompatibilityIssues } from './compatibility.js';
import { TravelsTypeError } from './errors.js';
import { createStateOwningTravels, type Travels } from './travels.js';
import type { PatchableInput, PatchesOption, TravelsOptions } from './type.js';
import { assertPublicFactoryOptions } from './internal/public-options.js';

/**
 * Create a Travels instance whose state is statically constrained to the
 * durable JSON-shaped subset supported by patches and persistence.
 */
export function createPatchableTravels<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  initialState: PatchableInput<S>,
  options?: Omit<TravelsOptions<F, true, P, S>, 'autoArchive'> & {
    autoArchive?: true;
  }
): Travels<S, F, true, P>;

export function createPatchableTravels<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  initialState: PatchableInput<S>,
  options: Omit<TravelsOptions<F, false, P, S>, 'autoArchive'> & {
    autoArchive: false;
  }
): Travels<S, F, false, P>;

export function createPatchableTravels<
  S,
  F extends boolean = false,
  A extends boolean = true,
  P extends PatchesOption = {},
>(
  initialState: PatchableInput<S>,
  options: TravelsOptions<F, A, P, S>
): Travels<S, F, A, P>;

export function createPatchableTravels<
  S,
  F extends boolean,
  A extends boolean,
  P extends PatchesOption = {},
>(
  initialState: PatchableInput<S>,
  options: TravelsOptions<F, A, P, S> = {}
): Travels<S, F, A, P> {
  assertPublicFactoryOptions(options, {
    capability: 'state',
    restoreFactory: 'restoreTravels',
  });
  const issues = findStateCompatibilityIssues(initialState, {
    allowFrozen: true,
  });
  if (issues.length > 0) {
    throw new TravelsTypeError(
      'PERSISTENCE_INCOMPATIBLE',
      `Travels: createPatchableTravels received non-durable initial state:\n- ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('\n- ')}`
    );
  }
  return createStateOwningTravels<S, F, A, P>(
    { type: 'initial', state: initialState as S },
    options
  );
}
