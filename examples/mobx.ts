/**
 * MobX integration example.
 */

import { makeAutoObservable } from 'mobx';
import { createTravels } from '../src/index';

type Layer = {
  id: string;
  name: string;
  visible: boolean;
};

class LayerDocument {
  layers: Layer[] = [];
  selectedLayerId: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }
}

export const document = new LayerDocument();

const travels = createTravels(document, {
  mutable: true,
  maxHistory: 200,
  // MobX adds runtime metadata on observables; keep durable snapshots plain in
  // production apps if you persist this state.
  warnOnUnsupportedState: false,
});

export const layerHistory = travels.getControls();

export function addLayer(name: string) {
  travels.setState((draft) => {
    const id = crypto.randomUUID();
    draft.layers.push({ id, name, visible: true });
    draft.selectedLayerId = id;
  });
}

export function renameSelectedLayer(name: string) {
  travels.setState((draft) => {
    const layer = draft.layers.find(
      (item) => item.id === draft.selectedLayerId
    );
    if (layer) {
      layer.name = name;
    }
  });
}
