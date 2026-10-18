import type { Patches } from 'mutative';
import { findStateCompatibilityIssues } from '../compatibility.js';
import type { PatchesOption, TravelMetadata, TravelPatches } from '../type.js';
import {
  getPatchPathSegments,
  isArrayIndex,
  isObjectLike,
  isValidPatchPath,
} from '../utils.js';
import type { ObserverHub } from './observer-hub.js';
import { getHistoryEntryIdentity } from './patch-utils.js';

export type DeferredCompatibilityCheck<P extends PatchesOption = {}> = {
  patches?: Patches<P>;
  inversePatches?: Patches<P>;
  metadata?: TravelMetadata;
  entryIndex: number;
  retained: boolean;
  entryIdentity?: object;
};

/** Timeline facts a committed check needs at the moment it runs. */
export type DiagnosticsTimeline<S> = {
  state: S;
  mutable: boolean;
  maxHistory: number;
};

type CompatibilitySubject = 'state' | 'patch' | 'metadata';

const getOwnDataValueAtPath = (
  value: unknown,
  segments: Array<string | number>
): { found: true; value: unknown; path: string } | { found: false } => {
  let current = value;
  let path = '$';
  for (const segment of segments) {
    if (!isObjectLike(current)) {
      return { found: false };
    }

    const arrayIndex =
      Array.isArray(current) &&
      (typeof segment === 'number'
        ? Number.isInteger(segment) && segment >= 0 && segment < current.length
        : isArrayIndex(segment, current.length));
    path = arrayIndex ? `${path}[${segment}]` : `${path}.${segment}`;

    const descriptor = Object.getOwnPropertyDescriptor(current, segment);
    if (!descriptor || !('value' in descriptor)) {
      return { found: false };
    }
    current = descriptor.value;
  }
  return { found: true, value: current, path };
};

type PathNode = {
  children: Map<unknown, PathNode>;
  written: boolean;
  kept: boolean;
};

const createPathNode = (): PathNode => ({
  children: new Map(),
  written: false,
  kept: false,
});

/**
 * Keep each written path that no other written path contains, once and in
 * first-write order, so every written sub-tree is inspected once. A prefix tree
 * keeps this linear in the total path length; comparing each path with every
 * kept one made a single large array edit, such as shift(), quadratic.
 */
const getOutermostPaths = (
  paths: ReadonlyArray<Array<string | number>>
): Array<Array<string | number>> => {
  const root = createPathNode();
  for (const path of paths) {
    let node = root;
    for (const segment of path) {
      let child = node.children.get(segment);
      if (!child) {
        child = createPathNode();
        node.children.set(segment, child);
      }
      node = child;
    }
    node.written = true;
  }

  const outermost: Array<Array<string | number>> = [];
  for (const path of paths) {
    let node = root;
    let depth = 0;
    while (depth < path.length && !node.written) {
      node = node.children.get(path[depth])!;
      depth += 1;
    }
    // Stopping short means a written ancestor already covers this path.
    if (depth === path.length && !node.kept) {
      node.kept = true;
      outermost.push(path);
    }
  }
  return outermost;
};

/**
 * Development-only persistence compatibility warnings.
 *
 * Travels constructs this only outside production and only while
 * `warnOnUnsupportedState` is enabled, so production bundles drop it. The core
 * keeps the timeline- and transaction-aware decisions about what to check;
 * this class inspects values and reports each distinct issue once.
 */
export class PersistenceDiagnostics<S, P extends PatchesOption = {}> {
  private readonly warningKeys = new Set<string>();

  constructor(
    private readonly observers: ObserverHub<S, P>,
    private readonly allowFrozenState: boolean
  ) {}

  public warnValue(
    subject: CompatibilitySubject,
    value: unknown,
    pathPrefix = '$'
  ): void {
    this.observers.publish(() => {
      try {
        const invalidPatchPath =
          subject === 'patch' &&
          isObjectLike(value) &&
          !isValidPatchPath(value.path);
        const inspectedValue = invalidPatchPath
          ? { ...value, path: [] }
          : value;
        const issues: { code: string; path: string; message: string }[] =
          findStateCompatibilityIssues(inspectedValue, {
            allowFrozen: subject !== 'metadata' && this.allowFrozenState,
          });
        if (invalidPatchPath) {
          issues.unshift({
            code: 'PATCH_PATH',
            path: '$.path',
            message: 'use a durable patch path for persistence.',
          });
        }

        for (const issue of issues) {
          const issuePath =
            issue.path === '$'
              ? pathPrefix
              : `${pathPrefix}${issue.path.slice(1)}`;
          const key = `${subject}:${issue.code}:${
            subject === 'state' ? issuePath : issue.path
          }`;
          if (this.warningKeys.has(key)) {
            continue;
          }

          this.warningKeys.add(key);
          this.observers.warn(
            'PERSISTENCE_COMPATIBILITY',
            `Travels ${subject} compatibility warning at ${issuePath}: ${issue.message}`
          );
        }
      } catch (error) {
        this.observers.reportError('compatibilityCheck', error);
      }
    });
  }

  public warnPatches(patches: TravelPatches<P>, entryOffset = 0): void {
    for (const direction of ['patches', 'inversePatches'] as const) {
      patches[direction].forEach((patchGroup, entryIndex) => {
        patchGroup.forEach((operation, operationIndex) => {
          this.warnValue(
            'patch',
            operation,
            `$.patches.${direction}[${
              entryOffset + entryIndex
            }][${operationIndex}]`
          );
        });
      });
    }
  }

  /**
   * Inspect only the state sub-trees a patch group wrote, falling back to the
   * whole state for root writes, unreadable paths, and mutable state.
   */
  public warnStateAfterPatches(
    timeline: DiagnosticsTimeline<S>,
    patches?: Patches<P>
  ): void {
    if (!patches || timeline.mutable) {
      this.warnValue('state', timeline.state);
      return;
    }

    const writtenPaths: Array<Array<string | number>> = [];
    for (const operation of patches) {
      const descriptor = Object.getOwnPropertyDescriptor(operation, 'path');
      const segments =
        descriptor && 'value' in descriptor
          ? getPatchPathSegments(descriptor.value)
          : undefined;
      if (!segments || segments.length === 0) {
        this.warnValue('state', timeline.state);
        return;
      }
      writtenPaths.push(segments);
    }

    for (const path of getOutermostPaths(writtenPaths)) {
      const resolved = getOwnDataValueAtPath(timeline.state, path);
      if (resolved.found) {
        this.warnValue('state', resolved.value, resolved.path);
      }
    }
  }

  public runCheck(
    timeline: DiagnosticsTimeline<S>,
    check: DeferredCompatibilityCheck<P>
  ): void {
    this.warnStateAfterPatches(timeline, check.patches);
    if (
      check.retained &&
      timeline.maxHistory !== 0 &&
      check.patches &&
      check.inversePatches
    ) {
      this.warnPatches(
        {
          patches: [check.patches],
          inversePatches: [check.inversePatches],
        },
        check.entryIndex
      );
    }
    if (check.metadata !== undefined) {
      this.warnValue('metadata', check.metadata);
    }
  }

  /**
   * Run checks deferred by a root transaction against the history it finally
   * retained, re-indexing entries that moved and skipping trimmed payloads.
   */
  public flushChecks(
    timeline: DiagnosticsTimeline<S>,
    checks: readonly DeferredCompatibilityCheck<P>[],
    retainedPatches: readonly Patches<P>[]
  ): void {
    const retainedEntries = new Map<object, number>();
    for (let index = 0; index < retainedPatches.length; index += 1) {
      retainedEntries.set(
        getHistoryEntryIdentity(retainedPatches[index]),
        index
      );
    }

    for (const check of checks) {
      if (!check.entryIdentity) {
        this.runCheck(timeline, check);
        continue;
      }

      const entryIndex = retainedEntries.get(check.entryIdentity);
      if (entryIndex === undefined) {
        // The patch payload and metadata are no longer persisted, but an
        // effect at the touched state path may have survived history trimming.
        this.runCheck(timeline, {
          patches: check.patches,
          entryIndex: 0,
          retained: false,
        });
        continue;
      }

      this.runCheck(timeline, { ...check, entryIndex });
    }
  }
}
