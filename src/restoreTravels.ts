import type {
  PatchesOption,
  TravelsOptions,
  TravelsSerializedHistory,
} from './type.js';
import { TravelsCore, type Travels } from './travels.js';
import {
  assertPublicFactoryOptions,
  hasOwnOption,
} from './internal/public-options.js';

/**
 * Options accepted by `restoreTravels()`.
 *
 * The restored state is detached from the snapshot. A mutable timeline can
 * instead restore into an existing live root, such as a MobX, Vue, or Pinia
 * store object: Travels overwrites `target` in place with the snapshot state
 * and keeps that reference as its state.
 */
export type RestoreTravelsOptions<
  S,
  F extends boolean,
  A extends boolean,
  P extends PatchesOption = {},
> = TravelsOptions<F, A, P> & {
  /**
   * Live mutable root that receives the restored state in place. Requires
   * `mutable: true` and the same plain object or array root kind as the
   * snapshot state.
   */
  target?: S;
};

/** Restore an auto-archiving timeline from one complete persisted snapshot. */
export function restoreTravels<
  S,
  F extends boolean = false,
  P extends PatchesOption = {},
>(
  snapshot: TravelsSerializedHistory<S, P>,
  options?: Omit<RestoreTravelsOptions<S, F, true, P>, 'autoArchive'> & {
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
  options: Omit<RestoreTravelsOptions<S, F, false, P>, 'autoArchive'> & {
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
  options: RestoreTravelsOptions<S, F, A, P>
): Travels<S, F, A, P>;

export function restoreTravels<
  S,
  F extends boolean,
  A extends boolean,
  P extends PatchesOption = {},
>(
  snapshot: TravelsSerializedHistory<S, P>,
  options: RestoreTravelsOptions<S, F, A, P> = {}
): Travels<S, F, A, P> {
  assertPublicFactoryOptions(options, {
    capability: 'state',
    restoreFactory: 'restoreTravels',
    allowRestoreTarget: true,
  });
  const { target, ...travelsOptions } = options;
  return new TravelsCore<S, F, A, P>(
    {
      type: 'snapshot',
      snapshot,
      target:
        hasOwnOption(options, 'target') && target !== undefined
          ? (target as object)
          : undefined,
    },
    travelsOptions
  ) as unknown as Travels<S, F, A, P>;
}
