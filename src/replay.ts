import type { Patches } from 'mutative';
import type { PatchesOption } from './type.js';

export type PatchReplayDirection = 'forward' | 'backward';

/**
 * Compose history entries for a single apply() call.
 *
 * Inverse patch operations are already emitted in replay order by Mutative.
 * Travelling backward therefore reverses history entries, never the operations
 * inside an entry.
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
    return composed;
  }

  for (let index = groups.length - 1; index >= 0; index -= 1) {
    composed.push(...groups[index]);
  }

  return composed;
};
