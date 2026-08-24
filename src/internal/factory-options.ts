import { TravelsTypeError } from '../errors.js';

export const assertNoHistoryOption = (
  options: unknown,
  restoreFactory: 'restoreTravels' | 'restoreTravelJournal'
): void => {
  if (
    options !== null &&
    typeof options === 'object' &&
    Object.prototype.hasOwnProperty.call(options, 'history')
  ) {
    throw new TravelsTypeError(
      'INVALID_OPTION',
      `Travels: restore persisted history atomically with ${restoreFactory}(snapshot, options).`
    );
  }
};
