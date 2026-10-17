import { TravelsTypeError } from '../errors.js';

const removedRestoreOptions = [
  'history',
  'initialPatches',
  'initialPosition',
  'strictInitialPatches',
] as const;

export const hasOwnOption = (options: object, option: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(options, option);

export function assertPublicOptionsObject(
  options: unknown
): asserts options is Record<PropertyKey, unknown> {
  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TravelsTypeError(
      'INVALID_OPTION',
      'Travels: options must be a non-null, non-array object.'
    );
  }
}

export const assertPublicFactoryOptions = (
  options: unknown,
  config: {
    capability: 'state' | 'journal';
    restoreFactory: 'restoreTravels' | 'restoreTravelJournal';
    allowRestoreTarget?: boolean;
  }
): void => {
  assertPublicOptionsObject(options);

  if (!config.allowRestoreTarget && hasOwnOption(options, 'target')) {
    throw new TravelsTypeError(
      'INVALID_OPTION',
      config.capability === 'state'
        ? 'Travels: target is only available when restoring a snapshot. Use restoreTravels(snapshot, { mutable: true, target }).'
        : 'Travels: target is only available to state-owning mutable restores. External journals keep the state reference committed by their owner.'
    );
  }

  if (hasOwnOption(options, 'controlledApply')) {
    throw new TravelsTypeError(
      'INVALID_OPTION',
      config.capability === 'state'
        ? 'Travels: controlledApply is reserved for externally owned journals. Use createTravelJournal(initialState, { apply }) or restoreTravelJournal(snapshot, { apply }).'
        : 'Travels: controlledApply was replaced by the apply option on createTravelJournal() and restoreTravelJournal().'
    );
  }

  if (config.capability === 'state' && hasOwnOption(options, 'apply')) {
    throw new TravelsTypeError(
      'INVALID_OPTION',
      'Travels: apply is only available to externally owned journals. Use createTravelJournal(initialState, { apply }) or restoreTravelJournal(snapshot, { apply }).'
    );
  }

  if (config.capability === 'journal' && hasOwnOption(options, 'mutable')) {
    throw new TravelsTypeError(
      'INVALID_OPTION',
      'Travels: mutable is only available to state-owning timelines. External journals retain the state reference committed by their owner.'
    );
  }

  for (const option of removedRestoreOptions) {
    if (hasOwnOption(options, option)) {
      throw new TravelsTypeError(
        'INVALID_OPTION',
        `Travels: ${option} was removed. Restore persisted history atomically with ${config.restoreFactory}(snapshot, options).`
      );
    }
  }
};
