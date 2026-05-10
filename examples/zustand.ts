/**
 * Zustand integration example.
 *
 * Keep Zustand as the UI store and Travels as the undo/redo history engine.
 */

import { createStore } from 'zustand/vanilla';
import { createTravels, type RebasableTravelsControls } from '../src/index';

type DocumentState = {
  title: string;
  blocks: Array<{ id: string; text: string }>;
};

type DocumentStore = DocumentState & {
  history: RebasableTravelsControls<DocumentState, false>;
  setTitle: (title: string) => void;
  addBlock: (text: string) => void;
  undo: () => void;
  redo: () => void;
};

const initialState: DocumentState = {
  title: 'Untitled',
  blocks: [],
};

const travels = createTravels<DocumentState>(initialState, {
  maxHistory: 200,
});

const syncFromHistory = () => {
  documentStore.setState({
    ...travels.getState(),
    history: travels.getControls(),
  });
};

export const documentStore = createStore<DocumentStore>((set) => ({
  ...travels.getState(),
  history: travels.getControls(),
  setTitle(title) {
    travels.setState((draft) => {
      draft.title = title;
    });
    set({ ...travels.getState(), history: travels.getControls() });
  },
  addBlock(text) {
    travels.setState((draft) => {
      draft.blocks.push({
        id: crypto.randomUUID(),
        text,
      });
    });
    set({ ...travels.getState(), history: travels.getControls() });
  },
  undo() {
    travels.back();
  },
  redo() {
    travels.forward();
  },
}));

travels.subscribe(syncFromHistory);
