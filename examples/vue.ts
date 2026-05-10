/**
 * Vue composable integration example.
 */

import { computed, readonly, shallowRef } from 'vue';
import { createTravels, type TravelsOptions } from '../src/index';

export function useTravelsHistory<S>(
  initialState: S,
  options: TravelsOptions<false, true> = {}
) {
  const travels = createTravels(initialState, options);
  const state = shallowRef(travels.getState());
  const position = shallowRef(travels.getPosition());

  travels.subscribe((nextState, _patches, nextPosition) => {
    state.value = nextState;
    position.value = nextPosition;
  });

  return {
    state: readonly(state),
    position: readonly(position),
    canUndo: computed(() => travels.canBack()),
    canRedo: computed(() => travels.canForward()),
    setState: travels.setState,
    undo: travels.back,
    redo: travels.forward,
    reset: travels.reset,
    controls: travels.getControls(),
  };
}
