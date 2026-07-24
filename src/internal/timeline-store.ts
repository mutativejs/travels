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

  public assertConsistent(maxHistory: number): void {
    if (this.allPatches.patches.length !== this.allPatches.inversePatches.length) {
      throw new Error(
        'Travels invariant: forward and inverse history lengths diverged.'
      );
    }
    if (this.allMetadata.length > this.allPatches.patches.length) {
      throw new Error(
        'Travels invariant: metadata contains entries without patch history.'
      );
    }
    if (this.tempPatches.patches.length !== this.tempPatches.inversePatches.length) {
      throw new Error(
        'Travels invariant: pending forward and inverse patch lengths diverged.'
      );
    }
    const visibleLength = Math.min(maxHistory, this.allPatches.patches.length);
    if (this.position < 0 || this.position > visibleLength) {
      throw new Error(
        `Travels invariant: position ${this.position} is outside 0..${visibleLength}.`
      );
    }
  }
}
