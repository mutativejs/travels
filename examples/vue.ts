/**
 * Vue composable integration example.
 */

import { readonly, shallowRef } from 'vue';
import {
  createTravels,
  type TravelMetadata,
  type TravelsOptions,
  type Updater,
} from '../src/index';

export function useTravelsHistory<S>(
  initialState: S,
  options: TravelsOptions<false, true> = {}
) {
  const travels = createTravels(initialState, options);
  const state = shallowRef(travels.getState());
  const position = shallowRef(travels.getPosition());
  const canUndo = shallowRef(travels.canBack());
  const canRedo = shallowRef(travels.canForward());

  travels.subscribe((nextState, _patches, nextPosition) => {
    state.value = nextState;
    position.value = nextPosition;
    canUndo.value = travels.canBack();
    canRedo.value = travels.canForward();
  });

  return {
    state: readonly(state),
    position: readonly(position),
    canUndo: readonly(canUndo),
    canRedo: readonly(canRedo),
    setState: (updater: Updater<S>, metadata?: TravelMetadata) =>
      travels.setState(updater, metadata),
    undo: (amount?: number) => travels.back(amount),
    redo: (amount?: number) => travels.forward(amount),
    reset: () => travels.reset(),
    controls: travels.getControls(),
  };
}
