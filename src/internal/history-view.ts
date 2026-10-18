import type { Patches } from 'mutative';
import { TravelsTypeError } from '../errors.js';
import type { PatchesOption, TravelPatches } from '../type.js';

type HistoryViewInput<S, P extends PatchesOption> = {
  state: S;
  position: number;
  patches: TravelPatches<P>;
  maxHistory: number;
  manualMode: boolean;
  apply: (state: S, patches: Patches<P>) => S;
};

const MAX_SNAPSHOT_ISSUES = 20;

/**
 * Copy one history value for getHistorySnapshot(), or record why it cannot be
 * copied without changing what it means. Values JSON would not keep, such as
 * undefined, NaN, bigint, a Date, or a shared or circular reference, copy
 * faithfully, so only functions, accessors, and objects other than plain
 * objects, arrays, and dates are refused. Copies are extensible and writable
 * even when the history is frozen, because the caller owns them.
 */
const detachHistoryValue = (
  value: unknown,
  path: string,
  copies: Map<object, object>,
  issues: string[]
): unknown => {
  if (issues.length >= MAX_SNAPSHOT_ISSUES) {
    return value;
  }
  if (typeof value === 'function') {
    issues.push(`${path}: functions cannot be detached.`);
    return value;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }

  const copied = copies.get(value);
  if (copied) {
    return copied;
  }

  const prototype = Object.getPrototypeOf(value);
  let copy: object | undefined;
  if (Array.isArray(value)) {
    copy = prototype === Array.prototype ? new Array(value.length) : undefined;
  } else if (value instanceof Date) {
    copy = prototype === Date.prototype ? new Date(value.getTime()) : undefined;
  } else if (prototype === Object.prototype || prototype === null) {
    copy = Object.create(prototype) as object;
  }
  if (!copy) {
    issues.push(
      `${path}: Map, Set, class instances, and other runtime objects cannot be detached.`
    );
    return value;
  }
  copies.set(value, copy);

  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length' && Array.isArray(copy)) {
      continue;
    }
    const keyPath = Array.isArray(copy)
      ? `${path}[${String(key)}]`
      : `${path}.${String(key)}`;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor)) {
      issues.push(`${keyPath}: accessors cannot be detached.`);
      continue;
    }
    Object.defineProperty(copy, key, {
      value: detachHistoryValue(descriptor.value, keyPath, copies, issues),
      writable: true,
      enumerable: descriptor.enumerable,
      configurable: true,
    });
  }
  return copy;
};

/** Reconstructs, caches, and safely snapshots visible history states. */
export class HistoryView<S, P extends PatchesOption = {}> {
  private cache: { version: number; history: readonly S[] } | null = null;
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

    const history = Object.freeze([
      ...pastHistory,
      input.state,
      ...futureHistory,
    ]);
    this.cache = { version: this.revision, history };

    return history;
  }

  public snapshot(history: readonly S[]): S[] {
    const issues: string[] = [];
    // Each state gets its own copies, so editing one snapshot entry never
    // changes another through the sub-trees history states share.
    const snapshot = history.map(
      (state, index) =>
        detachHistoryValue(state, `$.history[${index}]`, new Map(), issues) as S
    );

    if (issues.length > 0) {
      throw new TravelsTypeError(
        'PERSISTENCE_INCOMPATIBLE',
        `Travels: getHistorySnapshot cannot detach history without changing it:\n- ${issues.join(
          '\n- '
        )}`
      );
    }

    return snapshot;
  }
}
