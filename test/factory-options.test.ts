import { describe, expect, test, vi } from 'vitest';
import {
  createPatchableTravels,
  createTravelJournal,
  createTravels,
  restoreTravelJournal,
  restoreTravels,
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

const expectInvalidOption = (operation: () => unknown): void => {
  expect(operation).toThrowError(
    expect.objectContaining<Partial<TravelsTypeError>>({
      code: 'INVALID_OPTION',
    })
  );
};

describe('public factory option boundaries', () => {
  const snapshot = createTravels({ count: 0 }).serialize();

  test.each(removedRestoreOptions)(
    'rejects removed state-factory option %s',
    (option, value) => {
      const options = { [option]: value } as never;

      expectInvalidOption(() => createTravels({ count: 0 }, options));
      expectInvalidOption(() => createPatchableTravels({ count: 0 }, options));
      expectInvalidOption(() => restoreTravels(snapshot, options));
    }
  );

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

  test('rejects state-owned mutable mode on every journal factory', () => {
    const options = {
      apply: ({ state }: { state: { count: number } }) => state,
      mutable: false,
    } as never;

    expectInvalidOption(() => createTravelJournal({ count: 0 }, options));
    expectInvalidOption(() => restoreTravelJournal(snapshot, options));
  });
});
