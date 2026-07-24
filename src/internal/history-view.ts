import type { Patches } from 'mutative';
import { TravelsTypeError } from '../errors.js';
import type { PatchesOption, TravelPatches } from '../type.js';
import { findStateCompatibilityIssues } from '../compatibility.js';
import { deepCloneValue } from './patch-utils.js';

type HistoryViewInput<S, P extends PatchesOption> = {
  state: S;
  position: number;
  patches: TravelPatches<P>;
  maxHistory: number;
  manualMode: boolean;
  apply: (state: S, patches: Patches<P>) => S;
};

/** Reconstructs, caches, and safely snapshots visible history states. */
export class HistoryView<S, P extends PatchesOption = {}> {
  private cache: { version: number; history: S[] } | null = null;
  private revision = 0;

  public get version(): number {
    return this.revision;
  }

  public invalidate(): void {
    this.revision += 1;
    this.cache = null;
  }

  public get(input: HistoryViewInput<S, P>): readonly S[] {
    if (this.cache?.version === this.revision) {
      return this.cache.history;
    }

    let currentState = input.state;
    const patches =
      input.manualMode && input.patches.patches.length > input.maxHistory
        ? input.patches.patches.slice(
            input.patches.patches.length - input.maxHistory
          )
        : input.patches.patches;
    const inversePatches =
      input.manualMode &&
      input.patches.inversePatches.length > input.maxHistory
        ? input.patches.inversePatches.slice(
            input.patches.inversePatches.length - input.maxHistory
          )
        : input.patches.inversePatches;

    const futureHistory: S[] = [];
    for (let index = input.position; index < patches.length; index += 1) {
      currentState = input.apply(currentState, patches[index]);
      futureHistory.push(currentState);
    }

    currentState = input.state;
    const pastHistory: S[] = [];
    for (let index = input.position - 1; index > -1; index -= 1) {
      currentState = input.apply(currentState, inversePatches[index]);
      pastHistory.push(currentState);
    }
    pastHistory.reverse();

    const history = [...pastHistory, input.state, ...futureHistory];
    this.cache = { version: this.revision, history };

    if (process.env.NODE_ENV !== 'production') {
      Object.freeze(history);
    }

    return history;
  }

  public snapshot(history: readonly S[]): S[] {
    const issues: string[] = [];
    for (
      let index = 0;
      index < history.length && issues.length < 20;
      index += 1
    ) {
      for (const issue of findStateCompatibilityIssues(history[index], {
        allowFrozen: true,
        maxIssues: 20 - issues.length,
      })) {
        const path =
          issue.path === '$'
            ? `$.history[${index}]`
            : `$.history[${index}]${issue.path.slice(1)}`;
        issues.push(`${path}: ${issue.message}`);
      }
    }

    if (issues.length > 0) {
      throw new TravelsTypeError(
        'PERSISTENCE_INCOMPATIBLE',
        `Travels: getHistorySnapshot cannot detach non-durable history:\n- ${issues.join(
          '\n- '
        )}`
      );
    }

    return history.map((state) => deepCloneValue(state) as S);
  }
}
