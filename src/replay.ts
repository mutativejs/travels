import type { Patches } from 'mutative';
import type { PatchesOption } from './type.js';

export type PatchReplayDirection = 'forward' | 'backward';

export const isRootReplacement = (patch: {
  op: string;
  path: string | readonly unknown[];
}): boolean => patch.op === 'replace' && patch.path.length === 0;

const discardSupersededOperations = <P extends PatchesOption = {}>(
  patches: Patches<P>
): Patches<P> => {
  for (let index = patches.length - 1; index > 0; index -= 1) {
    if (isRootReplacement(patches[index])) {
      return patches.slice(index);
    }
  }

  return patches;
};

/**
 * Compose history entries for a single apply() call.
 *
 * Inverse patch operations are already emitted in replay order by Mutative.
 * Travelling backward therefore reverses history entries, never the operations
 * inside an entry. Operations before the final root replacement are discarded
 * because that replacement makes them unobservable in the composed result.
 */
export const composePatchGroups = <P extends PatchesOption = {}>(
  groups: readonly Patches<P>[],
  direction: PatchReplayDirection
): Patches<P> => {
  const composed: Patches<P> = [];

  if (direction === 'forward') {
    for (const group of groups) {
      composed.push(...group);
    }
  } else {
    for (let index = groups.length - 1; index >= 0; index -= 1) {
      composed.push(...groups[index]);
    }
  }

  return discardSupersededOperations(composed);
};
