import {
  type Options as MutativeOptions,
  type Patches,
  type Draft,
  type Immutable,
  apply,
  create,
} from 'mutative';

export type TravelPatches = {
  patches: Patches[];
  inversePatches: Patches[];
};

export type TravelsOptions<F extends boolean, A extends boolean> = {
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
  initialPatches?: TravelPatches;
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
} & Omit<MutativeOptions<true, F>, 'enablePatches'>;

type InitialValue<I extends unknown> = I extends (...args: unknown[]) => infer R
  ? R
  : I;
type DraftFunction<S> = (draft: Draft<S>) => void;
export type Updater<S> = S | (() => S) | DraftFunction<S>;
type Value<S, F extends boolean> = F extends true
  ? Immutable<InitialValue<S>>
  : InitialValue<S>;

export interface TravelsControls<S, F extends boolean> {
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
  patches: TravelPatches;
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

export interface ManualTravelsControls<S, F extends boolean>
  extends TravelsControls<S, F> {
  /**
   * Archive the current state
   */
  archive: () => void;
  /**
   * Check if it's possible to archive the current state
   */
  canArchive: () => boolean;
}

/**
 * Listener callback for state changes
 */
type Listener<S> = (state: S, patches: TravelPatches, position: number) => void;

const cloneTravelPatches = (base?: TravelPatches): TravelPatches => ({
  patches: base ? base.patches.map((patch) => [...patch]) : [],
  inversePatches: base ? base.inversePatches.map((patch) => [...patch]) : [],
});

/**
 * Core Travels class for managing undo/redo history
 */
export class Travels<S, F extends boolean = false, A extends boolean = true> {
  private state: S;
  private position: number;
  private allPatches: TravelPatches;
  private tempPatches: TravelPatches;
  private maxHistory: number;
  private initialState: S;
  private initialPosition: number;
  private initialPatches?: TravelPatches;
  private autoArchive: A;
  private mutable: boolean;
  private options: Omit<MutativeOptions<true, F>, 'enablePatches'>;
  private listeners: Set<Listener<S>> = new Set();
  private pendingState: S | null = null;

  constructor(initialState: S, options: TravelsOptions<F, A> = {} as any) {
    const {
      maxHistory = 10,
      initialPatches,
      initialPosition = 0,
      autoArchive = true as A,
      mutable = false,
      ...mutativeOptions
    } = options;

    // Validate options in development mode
    if (process.env.NODE_ENV !== 'production') {
      if (maxHistory <= 0) {
        console.error(
          `Travels: maxHistory must be a positive number, but got ${maxHistory}`
        );
      }

      if (initialPosition < 0) {
        console.error(
          `Travels: initialPosition must be non-negative, but got ${initialPosition}`
        );
      }

      if (initialPatches) {
        if (
          !Array.isArray(initialPatches.patches) ||
          !Array.isArray(initialPatches.inversePatches)
        ) {
          console.error(
            `Travels: initialPatches must have 'patches' and 'inversePatches' arrays`
          );
        } else if (
          initialPatches.patches.length !== initialPatches.inversePatches.length
        ) {
          console.error(
            `Travels: initialPatches.patches and initialPatches.inversePatches must have the same length`
          );
        }
      }
    }

    this.state = initialState;
    // For mutable mode, deep clone initialState to prevent mutations
    this.initialState = mutable
      ? JSON.parse(JSON.stringify(initialState))
      : initialState;
    this.position = initialPosition;
    this.initialPosition = initialPosition;
    this.maxHistory = maxHistory;
    this.initialPatches = initialPatches;
    this.autoArchive = autoArchive;
    this.mutable = mutable;
    this.options = mutativeOptions;
    this.allPatches = cloneTravelPatches(initialPatches);
    this.tempPatches = cloneTravelPatches();
  }

  /**
   * Subscribe to state changes
   * @returns Unsubscribe function
   */
  public subscribe(listener: Listener<S>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notify(): void {
    this.listeners.forEach((listener) =>
      listener(this.state, this.getPatches(), this.position)
    );
  }

  /**
   * Get the current state
   */
  public getState(): S {
    return this.state;
  }

  /**
   * Update the state
   */
  public setState(updater: Updater<S>): void {
    let patches: Patches<true>;
    let inversePatches: Patches<true>;

    if (this.mutable) {
      // For observable state: generate patches then apply mutably
      const isFn = typeof updater === 'function';

      [, patches, inversePatches] = create(
        this.state,
        isFn
          ? (updater as (draft: Draft<S>) => void)
          : (((draft) => {
              // For non-function updater, assign all properties to draft
              Object.assign(draft, updater);
            }) as (draft: Draft<any>) => void),
        {
          ...this.options,
          enablePatches: true,
        }
      ) as [S, Patches<true>, Patches<true>];

      // Apply patches to mutate the existing state object
      apply(this.state as object, patches, { mutable: true });

      // Keep the same reference
      this.pendingState = this.state;
    } else {
      // For immutable state: create new object
      const [nextState, p, ip] = (
        typeof updater === 'function'
          ? create(this.state, updater as (draft: Draft<S>) => void, {
              ...this.options,
              enablePatches: true,
            })
          : create(this.state, () => updater as S, {
              ...this.options,
              enablePatches: true,
            })
      ) as [S, Patches<true>, Patches<true>];

      patches = p;
      inversePatches = ip;
      this.state = nextState;
      this.pendingState = nextState;
    }

    // Reset pendingState asynchronously
    Promise.resolve().then(() => {
      this.pendingState = null;
    });

    if (this.autoArchive) {
      this.position =
        this.maxHistory < this.allPatches.patches.length + 1
          ? this.maxHistory
          : this.position + 1;

      const notLast = this.position - 1 < this.allPatches.patches.length;

      // Remove all patches after the current position
      if (notLast) {
        this.allPatches.patches.splice(
          this.position - 1,
          this.allPatches.patches.length - (this.position - 1)
        );
        this.allPatches.inversePatches.splice(
          this.position - 1,
          this.allPatches.inversePatches.length - (this.position - 1)
        );
      }

      this.allPatches.patches.push(patches);
      this.allPatches.inversePatches.push(inversePatches);

      if (this.maxHistory < this.allPatches.patches.length) {
        this.allPatches.patches = this.allPatches.patches.slice(
          -this.maxHistory
        );
        this.allPatches.inversePatches = this.allPatches.inversePatches.slice(
          -this.maxHistory
        );
      }
    } else {
      const notLast =
        this.position <
        this.allPatches.patches.length +
          Number(!!this.tempPatches.patches.length);

      // Remove all patches after the current position
      if (notLast) {
        this.allPatches.patches.splice(
          this.position,
          this.allPatches.patches.length - this.position
        );
        this.allPatches.inversePatches.splice(
          this.position,
          this.allPatches.inversePatches.length - this.position
        );
      }

      if (!this.tempPatches.patches.length || notLast) {
        this.position =
          this.maxHistory < this.allPatches.patches.length + 1
            ? this.maxHistory
            : this.position + 1;
      }

      if (notLast) {
        this.tempPatches.patches.length = 0;
        this.tempPatches.inversePatches.length = 0;
      }

      this.tempPatches.patches.push(patches);
      this.tempPatches.inversePatches.push(inversePatches);
    }

    this.notify();
  }

  /**
   * Archive the current state (only for manual archive mode)
   */
  public archive(): void {
    if (this.autoArchive) {
      console.warn('Auto archive is enabled, no need to archive manually');
      return;
    }

    if (!this.tempPatches.patches.length) return;

    // Use pendingState if available, otherwise use current state
    const stateToUse = (this.pendingState ?? this.state) as object;

    const [, patches, inversePatches] = create(
      stateToUse,
      (draft) => apply(draft, this.tempPatches.inversePatches.flat().reverse()),
      {
        enablePatches: true,
      }
    );

    this.allPatches.patches.push(inversePatches);
    this.allPatches.inversePatches.push(patches);

    // Respect maxHistory limit
    if (this.maxHistory < this.allPatches.patches.length) {
      this.allPatches.patches = this.allPatches.patches.slice(-this.maxHistory);
      this.allPatches.inversePatches = this.allPatches.inversePatches.slice(
        -this.maxHistory
      );
    }

    // Clear temporary patches after archiving
    this.tempPatches.patches.length = 0;
    this.tempPatches.inversePatches.length = 0;

    this.notify();
  }

  /**
   * Get all patches including temporary patches
   */
  private getAllPatches(): TravelPatches {
    const shouldArchive =
      !this.autoArchive && !!this.tempPatches.patches.length;

    if (shouldArchive) {
      return {
        patches: this.allPatches.patches.concat([
          this.tempPatches.patches.flat(),
        ]),
        inversePatches: this.allPatches.inversePatches.concat([
          this.tempPatches.inversePatches.flat().reverse(),
        ]),
      };
    }

    return this.allPatches;
  }

  /**
   * Get the complete history of states
   */
  public getHistory(): S[] {
    const history: S[] = [this.state];
    let currentState = this.state;
    const _allPatches = this.getAllPatches();

    const patches =
      !this.autoArchive && _allPatches.patches.length > this.maxHistory
        ? _allPatches.patches.slice(
            _allPatches.patches.length - this.maxHistory
          )
        : _allPatches.patches;
    const inversePatches =
      !this.autoArchive && _allPatches.inversePatches.length > this.maxHistory
        ? _allPatches.inversePatches.slice(
            _allPatches.inversePatches.length - this.maxHistory
          )
        : _allPatches.inversePatches;

    // Build future history
    for (let i = this.position; i < patches.length; i++) {
      currentState = apply(currentState as object, patches[i]) as S;
      history.push(currentState);
    }

    // Build past history
    currentState = this.state;
    for (let i = this.position - 1; i > -1; i--) {
      currentState = apply(currentState as object, inversePatches[i]) as S;
      history.unshift(currentState);
    }

    return history;
  }

  /**
   * Go to a specific position in the history
   */
  public go(nextPosition: number): void {
    const shouldArchive =
      !this.autoArchive && !!this.tempPatches.patches.length;

    if (shouldArchive) {
      this.archive();
    }

    const _allPatches = this.getAllPatches();
    const back = nextPosition < this.position;

    if (nextPosition > _allPatches.patches.length) {
      console.warn(`Can't go forward to position ${nextPosition}`);
      nextPosition = _allPatches.patches.length;
    }

    if (nextPosition < 0) {
      console.warn(`Can't go back to position ${nextPosition}`);
      nextPosition = 0;
    }

    if (nextPosition === this.position) return;

    if (shouldArchive) {
      const lastInversePatch = _allPatches.inversePatches.slice(-1)[0];
      _allPatches.inversePatches[_allPatches.inversePatches.length - 1] = [
        ...lastInversePatch,
      ].reverse();
    }

    const patchesToApply = back
      ? _allPatches.inversePatches
          .slice(-this.maxHistory)
          .slice(nextPosition, this.position)
          .flat()
          .reverse()
      : _allPatches.patches
          .slice(-this.maxHistory)
          .slice(this.position, nextPosition)
          .flat();

    if (this.mutable) {
      // For observable state: mutate in place
      apply(this.state as object, patchesToApply, { mutable: true });
    } else {
      // For immutable state: create new object
      this.state = apply(this.state as object, patchesToApply) as S;
    }

    this.position = nextPosition;
    this.notify();
  }

  /**
   * Go back in the history
   */
  public back(amount: number = 1): void {
    this.go(this.position - amount);
  }

  /**
   * Go forward in the history
   */
  public forward(amount: number = 1): void {
    this.go(this.position + amount);
  }

  /**
   * Reset to the initial state
   */
  public reset(): void {
    this.position = this.initialPosition;
    this.allPatches = cloneTravelPatches(this.initialPatches);
    this.tempPatches = cloneTravelPatches();

    if (this.mutable) {
      // For observable state: mutate back to initial state
      // Directly mutate each property to match initial state
      const state = this.state as S;
      const initial = this.initialState as S;

      // Remove properties that exist in current but not in initial
      for (const key of Object.keys(state as object)) {
        if (!(key in (initial as object))) {
          delete state[key as keyof S];
        }
      }

      // Set/update all properties from initial state
      for (const key of Object.keys(initial as object)) {
        state[key as keyof S] = initial[key as keyof S];
      }
    } else {
      // For immutable state: reassign reference
      this.state = this.initialState;
    }

    this.notify();
  }

  /**
   * Check if it's possible to go back
   */
  public canBack(): boolean {
    return this.position > 0;
  }

  /**
   * Check if it's possible to go forward
   */
  public canForward(): boolean {
    const shouldArchive =
      !this.autoArchive && !!this.tempPatches.patches.length;
    const _allPatches = this.getAllPatches();
    return shouldArchive
      ? this.position < _allPatches.patches.length - 1
      : this.position < this.allPatches.patches.length;
  }

  /**
   * Check if it's possible to archive the current state
   */
  public canArchive(): boolean {
    return !this.autoArchive && !!this.tempPatches.patches.length;
  }

  /**
   * Get the current position in the history
   */
  public getPosition(): number {
    return this.position;
  }

  /**
   * Get the patches history
   */
  public getPatches(): TravelPatches {
    const shouldArchive =
      !this.autoArchive && !!this.tempPatches.patches.length;
    return shouldArchive ? this.getAllPatches() : this.allPatches;
  }

  /**
   * Get the controls object
   */
  public getControls(): TravelsControls<S, F> | ManualTravelsControls<S, F> {
    const self = this;
    const controls: TravelsControls<S, F> | ManualTravelsControls<S, F> = {
      get position(): number {
        return self.getPosition();
      },
      getHistory: () => self.getHistory() as Value<S, F>[],
      get patches(): TravelPatches {
        return self.getPatches();
      },
      back: (amount?: number): void => self.back(amount),
      forward: (amount?: number): void => self.forward(amount),
      reset: (): void => self.reset(),
      go: (position: number): void => self.go(position),
      canBack: (): boolean => self.canBack(),
      canForward: (): boolean => self.canForward(),
    };

    if (!this.autoArchive) {
      (controls as ManualTravelsControls<S, F>).archive = (): void =>
        self.archive();
      (controls as ManualTravelsControls<S, F>).canArchive = (): boolean =>
        self.canArchive();
    }

    return controls;
  }
}

/**
 * Create a new Travels instance with auto archive mode
 */
export function createTravels<S, F extends boolean = false>(
  initialState: S,
  options?: Omit<TravelsOptions<F, true>, 'autoArchive'> & {
    autoArchive?: true;
  }
): Travels<S, F, true>;

/**
 * Create a new Travels instance with manual archive mode
 */
export function createTravels<S, F extends boolean = false>(
  initialState: S,
  options: Omit<TravelsOptions<F, false>, 'autoArchive'> & {
    autoArchive: false;
  }
): Travels<S, F, false>;

/**
 * Create a new Travels instance
 */
export function createTravels<S, F extends boolean, A extends boolean>(
  initialState: S,
  options: TravelsOptions<F, A> = {}
): Travels<S, F, A> {
  return new Travels(initialState, options);
}
