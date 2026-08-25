import { TravelsTypeError } from '../errors.js';

const removedRestoreOptions = [
  'history',
  'initialPatches',
  'initialPosition',
  'strictInitialPatches',
] as const;

const hasOwn = (options: object, option: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(options, option);

export const assertPublicFactoryOptions = (
  options: unknown,
  config: {
    capability: 'state' | 'journal';
    restoreFactory: 'restoreTravels' | 'restoreTravelJournal';
  }
): void => {
  if (options === null || typeof options !== 'object') {
    return;
  }

  if (hasOwn(options, 'controlledApply')) {
    throw new TravelsTypeError(
      'INVALID_OPTION',
      config.capability === 'state'
        ? 'Travels: controlledApply is reserved for externally owned journals. Use createTravelJournal(initialState, { apply }) or restoreTravelJournal(snapshot, { apply }).'
        : 'Travels: controlledApply was replaced by the apply option on createTravelJournal() and restoreTravelJournal().'
    );
  }

  if (config.capability === 'state' && hasOwn(options, 'apply')) {
    throw new TravelsTypeError(
      'INVALID_OPTION',
      'Travels: apply is only available to externally owned journals. Use createTravelJournal(initialState, { apply }) or restoreTravelJournal(snapshot, { apply }).'
    );
  }

  if (config.capability === 'journal' && hasOwn(options, 'mutable')) {
    throw new TravelsTypeError(
      'INVALID_OPTION',
      'Travels: mutable is only available to state-owning timelines. External journals retain the state reference committed by their owner.'
    );
  }

  for (const option of removedRestoreOptions) {
    if (hasOwn(options, option)) {
      throw new TravelsTypeError(
        'INVALID_OPTION',
        `Travels: ${option} was removed. Restore persisted history atomically with ${config.restoreFactory}(snapshot, options).`
      );
    }
  }
};
