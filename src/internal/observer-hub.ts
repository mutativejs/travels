import type {
  PatchesOption,
  TravelsEvent,
  TravelsObserverErrorEvent,
  TravelsObserverErrorSource,
  TravelsWarning,
  TravelsWarningCode,
} from '../type.js';
import { consumePromiseLikeRejection } from '../utils.js';

export type ObserverListener<S, P extends PatchesOption = {}> = (
  event: TravelsEvent<S, P>
) => void;

type ObserverHubOptions<S, P extends PatchesOption> = {
  devtools?: (event: TravelsEvent<S, P>) => void;
  onObserverError?: (event: TravelsObserverErrorEvent) => void;
  onWarning?: (warning: TravelsWarning) => void;
};

const warnedLegacyListeners = new WeakSet<Function>();

export class ObserverHub<S, P extends PatchesOption = {}> {
  private readonly listeners = new Set<ObserverListener<S, P>>();
  private readonly devtools?: (event: TravelsEvent<S, P>) => void;
  private readonly onObserverError?: (event: TravelsObserverErrorEvent) => void;
  private readonly onWarning?: (warning: TravelsWarning) => void;
  private publishing = false;

  constructor(options: ObserverHubOptions<S, P>) {
    this.devtools = options.devtools;
    this.onObserverError = options.onObserverError;
    this.onWarning = options.onWarning;
  }

  public get isPublishing(): boolean {
    return this.publishing;
  }

  public publish(effect: () => void): void {
    const isRootPublication = !this.publishing;
    if (isRootPublication) {
      this.publishing = true;
    }

    try {
      effect();
    } finally {
      if (isRootPublication) {
        this.publishing = false;
      }
    }
  }

  public warn(code: TravelsWarningCode, message: string): void {
    if (this.onWarning) {
      const notify = () =>
        this.invoke('onWarning', () => this.onWarning?.({ code, message }));
      if (this.publishing) {
        notify();
      } else {
        this.publish(notify);
      }
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn(message);
    }
  }

  public reportError(
    source: TravelsObserverErrorSource,
    error: unknown
  ): void {
    if (!this.onObserverError) {
      return;
    }

    const notify = () => {
      try {
        const result = this.onObserverError?.({ source, error });
        consumePromiseLikeRejection(result, () => undefined);
      } catch {
        // Error reporting must never replace the observer failure.
      }
    };

    if (this.publishing) {
      notify();
    } else {
      this.publish(notify);
    }
  }

  public invoke(
    source: TravelsObserverErrorSource,
    observer: () => unknown
  ): void {
    let result: unknown;
    try {
      result = observer();
    } catch (error) {
      this.reportError(source, error);
      return;
    }

    consumePromiseLikeRejection(result, (error) =>
      this.reportError(source, error)
    );
  }

  public subscribe(listener: ObserverListener<S, P>): () => void {
    if (listener.length > 1 && !warnedLegacyListeners.has(listener)) {
      warnedLegacyListeners.add(listener);
      this.warn(
        'LEGACY_SUBSCRIBER',
        'Travels: subscribe listeners receive a single TravelsEvent object. Replace positional (state, patches, position, historyLength) parameters with event destructuring.'
      );
    }

    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public snapshot(): {
    listeners: ObserverListener<S, P>[];
    devtools?: (event: TravelsEvent<S, P>) => void;
  } {
    return {
      listeners: Array.from(this.listeners),
      devtools: this.devtools,
    };
  }
}
