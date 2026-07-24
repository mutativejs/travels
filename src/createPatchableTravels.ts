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
  return new Travels(initialState as S, options);
}
