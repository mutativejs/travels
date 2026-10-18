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
 * Append without spreading into push(): a spread passes each operation as a
 * call argument, and engines cap the argument count, so one large edit such as
 * shift() on a long array would throw a RangeError.
 */
const appendOperations = <P extends PatchesOption = {}>(
  composed: Patches<P>,
  operations: Patches<P>
): void => {
  for (let index = 0; index < operations.length; index += 1) {
    composed.push(operations[index]);
  }
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
      appendOperations(composed, group);
    }
  } else {
    for (let index = groups.length - 1; index >= 0; index -= 1) {
      appendOperations(composed, groups[index]);
    }
  }

  return discardSupersededOperations(composed);
};
