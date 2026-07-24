import type {
  PatchesOption,
  TravelMetadata,
  TravelPatches,
} from '../type.js';
import { cloneTravelPatches } from './patch-utils.js';

/**
 * Mutable storage for the timeline cursor, retained entries, and pending manual
 * archive entry. Travels coordinates behavior; this store owns the coupled data
 * whose lengths and cursor bounds form the core timeline invariant.
 */
export class TimelineStore<P extends PatchesOption = {}> {
  public position = 0;
  public allPatches: TravelPatches<P> = cloneTravelPatches();
  public allMetadata: Array<TravelMetadata | undefined> = [];
  public tempPatches: TravelPatches<P> = cloneTravelPatches();
  public tempMetadata?: TravelMetadata;
}

/**
 * Development-only timeline consistency check.
 *
 * This is a free function rather than a TimelineStore method so production
 * builds, where the only call site is eliminated, drop it and its diagnostic
 * strings entirely instead of retaining an unreachable class member.
 */
export const assertTimelineConsistent = <P extends PatchesOption = {}>(
  store: TimelineStore<P>,
  maxHistory: number
): void => {
  if (
    store.allPatches.patches.length !== store.allPatches.inversePatches.length
  ) {
    throw new Error(
      'Travels invariant: forward and inverse history lengths diverged.'
    );
  }
  if (store.allMetadata.length !== store.allPatches.patches.length) {
    throw new Error(
      'Travels invariant: metadata and retained patch history lengths diverged.'
    );
  }
  if (store.tempPatches.patches.length !== store.tempPatches.inversePatches.length) {
    throw new Error(
      'Travels invariant: pending forward and inverse patch lengths diverged.'
    );
  }
  const pendingEntry = store.tempPatches.patches.length > 0 ? 1 : 0;
  const visibleLength = Math.min(
    maxHistory,
    store.allPatches.patches.length + pendingEntry
  );
  if (
    store.tempPatches.patches.length === 0 &&
    store.tempMetadata !== undefined
  ) {
    throw new Error(
      'Travels invariant: pending metadata exists without pending patches.'
    );
  }
  if (store.allPatches.patches.length > maxHistory) {
    throw new Error(
      `Travels invariant: retained history exceeds maxHistory (${maxHistory}).`
    );
  }
  if (store.position < 0 || store.position > visibleLength) {
    throw new Error(
      `Travels invariant: position ${store.position} is outside 0..${visibleLength}.`
    );
  }
};
