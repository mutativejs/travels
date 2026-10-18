import type { Patches } from 'mutative';
import { TravelsTypeError } from './errors.js';
import {
  clonePatchGroupDetached,
  deepCloneValue,
} from './internal/patch-utils.js';
import { validateTravelHistoryEntryStructure } from './persistence.js';
import type {
  PatchesOption,
  TravelHistoryEntry,
  TravelMetadata,
} from './type.js';

export type PreparedTravelHistoryPatches<P extends PatchesOption> = {
  patches: Patches<P>;
  inversePatches: Patches<P>;
  metadata: TravelMetadata | undefined;
  storedMetadata: TravelMetadata | undefined;
};

/** @internal */
export const prepareTravelHistoryEntry = <P extends PatchesOption = {}>(
  entry: unknown
): PreparedTravelHistoryPatches<P> => {
  const validation = validateTravelHistoryEntryStructure<P>(entry);
  if (validation.error !== null) {
    throw new TravelsTypeError(
      'INVALID_PATCH_ENTRY',
      `Travels: recordPatches received an invalid patch entry: ${validation.error}.`
    );
  }

  const metadata = (entry as TravelHistoryEntry<P>).metadata;
  return {
    patches: clonePatchGroupDetached(validation.entry.patches),
    inversePatches: clonePatchGroupDetached(validation.entry.inversePatches),
    metadata,
    storedMetadata: metadata
      ? (deepCloneValue(metadata) as TravelMetadata)
      : undefined,
  };
};

/**
 * Verify that an external history entry can be detached before its owner
 * publishes the corresponding state commit.
 */
export const assertTravelHistoryEntryRecordable = <
  P extends PatchesOption = {},
>(
  entry: unknown
): void => {
  prepareTravelHistoryEntry<P>(entry);
};
