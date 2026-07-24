import { findStateCompatibilityIssues } from './compatibility.js';
import { TravelsTypeError } from './errors.js';
import { Travels } from './travels.js';
import type {
  PatchableInput,
  PatchesOption,
  TravelsOptions,
} from './type.js';

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
  options?: Omit<
    TravelsOptions<F, true, P>,
    'autoArchive' | 'controlledApply'
  > & {
    autoArchive?: true;
  }
): Travels<S, F, true, P>;

export function createPatchableTravels<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  initialState: PatchableInput<S>,
  options: Omit<
    TravelsOptions<F, false, P>,
    'autoArchive' | 'controlledApply'
  > & {
    autoArchive: false;
  }
): Travels<S, F, false, P>;

export function createPatchableTravels<
  S,
  F extends boolean,
  A extends boolean,
  P extends PatchesOption = {},
>(
  initialState: PatchableInput<S>,
  options: TravelsOptions<F, A, P> = {}
): Travels<S, F, A, P> {
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
  return new Travels(initialState as S, options);
}
