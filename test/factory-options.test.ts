import { describe, expect, test, vi } from 'vitest';
import {
  createPatchableTravels,
  createTravelJournal,
  createTravels,
  findStateCompatibilityIssues,
  restoreTravelJournal,
  restoreTravels,
  Travels,
  TravelsTypeError,
} from '../src/index.js';

const removedRestoreOptions = [
  ['history', {}],
  ['initialPatches', { patches: [], inversePatches: [] }],
  ['initialPosition', 0],
  ['strictInitialPatches', true],
] as const;

const invalidBooleanOptions = [
  ['a number', 0],
  ['null', null],
  ['a string', 'false'],
  ['an object', {}],
] as const;

const invalidOptionContainers = [
  ['null', null],
  ['a number', 0],
  ['a string', 'options'],
  ['an array', []],
  ['a function', () => undefined],
] as const;

const expectInvalidOption = (operation: () => unknown): void => {
  expect(operation).toThrowError(
    expect.objectContaining<Partial<TravelsTypeError>>({
      code: 'INVALID_OPTION',
    })
  );
};

describe('public option boundaries', () => {
  const timeline = createTravels({ count: 0 });
  const snapshot = timeline.serialize();

  test.each(invalidOptionContainers)(
    'rejects %s as a state-factory options container',
    (_description, options) => {
      expectInvalidOption(() => createTravels({ count: 0 }, options as never));
      expectInvalidOption(() =>
        createPatchableTravels({ count: 0 }, options as never)
      );
      expectInvalidOption(() => restoreTravels(snapshot, options as never));
    }
  );

  test.each(invalidOptionContainers)(
    'rejects %s as a journal-factory options container',
    (_description, options) => {
      expectInvalidOption(() =>
        createTravelJournal({ count: 0 }, options as never)
      );
      expectInvalidOption(() =>
        restoreTravelJournal(snapshot, options as never)
      );
    }
  );

  test.each(invalidOptionContainers)(
    'rejects %s as a deserialize options container',
    (_description, options) => {
      expectInvalidOption(() =>
        Travels.deserialize(snapshot, options as never)
      );
    }
  );

  test.each(invalidOptionContainers)(
    'rejects %s as a serialize options container',
    (_description, options) => {
      expectInvalidOption(() => timeline.serialize(options as never));
    }
  );

  test.each(invalidOptionContainers)(
    'rejects %s as a compatibility options container',
    (_description, options) => {
      expectInvalidOption(() =>
        findStateCompatibilityIssues({ count: 0 }, options as never)
      );
    }
  );

  test.each(removedRestoreOptions)(
    'rejects removed state-factory option %s',
    (option, value) => {
      const options = { [option]: value } as never;

      expectInvalidOption(() => createTravels({ count: 0 }, options));
      expectInvalidOption(() => createPatchableTravels({ count: 0 }, options));
      expectInvalidOption(() => restoreTravels(snapshot, options));
    }
  );

  test('rejects auto-freeze in mutable mode on every state-owning factory', () => {
    // The types reject only a literal freeze flag, so a flag known at runtime
    // must still be rejected by the factories.
    const enableAutoFreeze = true as boolean;
    const options = { mutable: true, enableAutoFreeze };

    expectInvalidOption(() => createTravels({ count: 0 }, options));
    expectInvalidOption(() => createPatchableTravels({ count: 0 }, options));
    expectInvalidOption(() => restoreTravels(snapshot, options));
    expectInvalidOption(() =>
      restoreTravels(snapshot, { ...options, target: { count: 5 } })
    );
    expect(createTravels({ count: 0 }, { mutable: true }).mutable).toBe(true);
    expect(
      createTravels({ count: 0 }, { mutable: false, enableAutoFreeze: true })
        .mutable
    ).toBe(false);
  });

  test('rejects controlledApply on every state-owning factory', () => {
    const options = {
      controlledApply: ({ state }: { state: { count: number } }) => state,
    } as never;

    expectInvalidOption(() => createTravels({ count: 0 }, options));
    expectInvalidOption(() => createPatchableTravels({ count: 0 }, options));
    expectInvalidOption(() => restoreTravels(snapshot, options));
  });

  test('does not inherit controlledApply into state factory ownership', () => {
    const controlledApply = vi.fn(
      ({ state }: { state: { count: number } }) => state
    );
    const options = Object.create({ controlledApply }) as never;
    const timelines = [
      createTravels({ count: 0 }, options),
      createPatchableTravels({ count: 0 }, options),
      restoreTravels(snapshot, options),
    ];

    for (const timeline of timelines) {
      timeline.setState({ count: 1 });
      expect(timeline.getState()).toEqual({ count: 1 });
    }
    expect(controlledApply).not.toHaveBeenCalled();
  });

  test('rejects journal apply on every state-owning factory', () => {
    const options = {
      apply: ({ state }: { state: { count: number } }) => state,
    } as never;

    expectInvalidOption(() => createTravels({ count: 0 }, options));
    expectInvalidOption(() => createPatchableTravels({ count: 0 }, options));
    expectInvalidOption(() => restoreTravels(snapshot, options));
  });

  test.each(invalidBooleanOptions)(
    'rejects %s as autoArchive on every public factory',
    (_description, value) => {
      const stateOptions = { autoArchive: value } as never;
      const journalOptions = {
        autoArchive: value,
        apply: ({ state }: { state: { count: number } }) => state,
      } as never;

      expectInvalidOption(() => createTravels({ count: 0 }, stateOptions));
      expectInvalidOption(() =>
        createPatchableTravels({ count: 0 }, stateOptions)
      );
      expectInvalidOption(() => restoreTravels(snapshot, stateOptions));
      expectInvalidOption(() =>
        createTravelJournal({ count: 0 }, journalOptions)
      );
      expectInvalidOption(() =>
        restoreTravelJournal(snapshot, journalOptions)
      );
    }
  );

  test.each(invalidBooleanOptions)(
    'rejects %s as mutable on every state-owning factory',
    (_description, value) => {
      const options = { mutable: value } as never;

      expectInvalidOption(() => createTravels({ count: 0 }, options));
      expectInvalidOption(() => createPatchableTravels({ count: 0 }, options));
      expectInvalidOption(() => restoreTravels(snapshot, options));
    }
  );

  test.each([
    'onError',
    'onBranchDiscard',
    'onObserverError',
    'onWarning',
    'devtools',
  ])('rejects a non-function %s on every public factory', (option) => {
    for (const value of [null, 'handler', {}, true]) {
      const stateOptions = { [option]: value } as never;
      const journalOptions = {
        [option]: value,
        apply: ({ state }: { state: { count: number } }) => state,
      } as never;

      expectInvalidOption(() => createTravels({ count: 0 }, stateOptions));
      expectInvalidOption(() =>
        createPatchableTravels({ count: 0 }, stateOptions)
      );
      expectInvalidOption(() => restoreTravels(snapshot, stateOptions));
      expectInvalidOption(() =>
        createTravelJournal({ count: 0 }, journalOptions)
      );
      expectInvalidOption(() => restoreTravelJournal(snapshot, journalOptions));
    }
    expect(() =>
      createTravels({ count: 0 }, { [option]: undefined })
    ).not.toThrow();
  });

  test('rejects a non-function subscribe listener', () => {
    const journal = createTravelJournal(
      { count: 0 },
      { apply: ({ state }) => state }
    );

    for (const listener of [undefined, null, {}]) {
      expectInvalidOption(() => timeline.subscribe(listener as never));
      expectInvalidOption(() => journal.subscribe(listener as never));
    }
  });

  test.each(removedRestoreOptions)(
    'rejects removed journal-factory option %s',
    (option, value) => {
      const options = {
        apply: ({ state }: { state: { count: number } }) => state,
        [option]: value,
      } as never;

      expectInvalidOption(() => createTravelJournal({ count: 0 }, options));
      expectInvalidOption(() => restoreTravelJournal(snapshot, options));
    }
  );

  test('rejects controlledApply on every journal factory', () => {
    const options = {
      apply: ({ state }: { state: { count: number } }) => state,
      controlledApply: ({ state }: { state: { count: number } }) => state,
    } as never;

    expectInvalidOption(() => createTravelJournal({ count: 0 }, options));
    expectInvalidOption(() => restoreTravelJournal(snapshot, options));
  });

  test('requires journal apply to be an own option', () => {
    const apply = ({ state }: { state: { count: number } }) => state;
    const options = Object.create({ apply }) as never;

    expectInvalidOption(() => createTravelJournal({ count: 0 }, options));
    expectInvalidOption(() => restoreTravelJournal(snapshot, options));
  });

  test('rejects state-owned mutable mode on every journal factory', () => {
    const options = {
      apply: ({ state }: { state: { count: number } }) => state,
      mutable: false,
    } as never;

    expectInvalidOption(() => createTravelJournal({ count: 0 }, options));
    expectInvalidOption(() => restoreTravelJournal(snapshot, options));
  });
});
