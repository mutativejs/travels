import { describe, expect, test } from 'vitest';
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

  test('rejects journal apply on every state-owning factory', () => {
    const options = {
      apply: ({ state }: { state: { count: number } }) => state,
    } as never;

    expectInvalidOption(() => createTravels({ count: 0 }, options));
    expectInvalidOption(() => createPatchableTravels({ count: 0 }, options));
    expectInvalidOption(() => restoreTravels(snapshot, options));
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

  test('rejects state-owned mutable mode on every journal factory', () => {
    const options = {
      apply: ({ state }: { state: { count: number } }) => state,
      mutable: false,
    } as never;

    expectInvalidOption(() => createTravelJournal({ count: 0 }, options));
    expectInvalidOption(() => restoreTravelJournal(snapshot, options));
  });
});
