import type {
  Options as MutativeOptions,
  Patches,
  Draft,
  Immutable,
  PatchesOptions,
} from 'mutative';

export type TravelPatches<P extends PatchesOption = {}> = {
  patches: Patches<P>[];
  inversePatches: Patches<P>[];
};

export type PatchesOption = Exclude<PatchesOptions, boolean>;

export type TravelsOptions<
  F extends boolean,
  A extends boolean,
  P extends PatchesOption = {},
> = {
  /**
   * The maximum number of history to keep, by default `10`
   */
  maxHistory?: number;
  /**
   * The initial position in the history, by default `0`
   */
  initialPosition?: number;
  /**
   * The initial patches of the history
   */
  initialPatches?: TravelPatches<P>;
  /**
   * Whether to automatically archive the current state, by default `true`
   */
  autoArchive?: A;
  /**
   * Whether to mutate the state in place (for observable state like MobX, Vue, Pinia)
   * When true, apply patches directly to the existing state object
   * When false (default), create new immutable state objects
   * @default false
   */
  mutable?: boolean;
} & Omit<MutativeOptions<true, F>, 'enablePatches'> & {
    patchesOptions?: P;
  };

export type InitialValue<I extends unknown> = I extends (
  ...args: unknown[]
) => infer R
  ? R
  : I;
type DraftFunction<S> = (draft: Draft<S>) => void;
export type Updater<S> = S | (() => S) | DraftFunction<S>;
export type Value<S, F extends boolean> = F extends true
  ? Immutable<InitialValue<S>>
  : InitialValue<S>;

export interface TravelsControls<
  S,
  F extends boolean,
  P extends PatchesOption = {},
> {
  /**
   * The current position in the history
   */
  position: number;
  /**
   * Get the history of the state
   */
  getHistory: () => Value<S, F>[];
  /**
   * The patches of the history
   */
  patches: TravelPatches<P>;
  /**
   * Go back in the history
   */
  back: (amount?: number) => void;
  /**
   * Go forward in the history
   */
  forward: (amount?: number) => void;
  /**
   * Reset the history
   */
  reset: () => void;
  /**
   * Go to a specific position in the history
   */
  go: (position: number) => void;
  /**
   * Check if it's possible to go back
   */
  canBack: () => boolean;
  /**
   * Check if it's possible to go forward
   */
  canForward: () => boolean;
}

export interface ManualTravelsControls<
  S,
  F extends boolean,
  P extends PatchesOption = {},
> extends TravelsControls<S, F, P> {
  /**
   * Archive the current state
   */
  archive: () => void;
  /**
   * Check if it's possible to archive the current state
   */
  canArchive: () => boolean;
}
