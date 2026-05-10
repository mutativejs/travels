import { describe, expect, test, vi } from 'vitest';
import {
  createTravels,
  Travels,
  TravelsPersistenceError,
  TRAVELS_HISTORY_SCHEMA_VERSION,
} from '../src/index';

type BrowserState = {
  title: string;
  blocks: Array<{ id: string; text: string }>;
};

describe('Browser-oriented persistence behavior', () => {
  test('restores serialized history through jsdom localStorage', () => {
    const storageKey = 'travels-browser-history';
    const travels = createTravels<BrowserState>(
      {
        title: 'Draft',
        blocks: [],
      },
      { maxHistory: 20 }
    );

    travels.setState((draft) => {
      draft.blocks.push({ id: '1', text: 'Hello' });
    });
    travels.setState((draft) => {
      draft.title = 'Published';
    });

    localStorage.setItem(storageKey, JSON.stringify(travels.serialize()));

    const history = Travels.deserialize<BrowserState>(
      localStorage.getItem(storageKey)
    );
    const restored = createTravels(history.state, {
      history,
      maxHistory: 20,
      strictInitialPatches: true,
    });

    expect(restored.getState()).toEqual(travels.getState());
    restored.back();
    expect(restored.getState().title).toBe('Draft');
  });

  test('recovers from corrupted localStorage with a fallback snapshot', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('travels-corrupted', '{not-json');

    const history = Travels.deserialize<BrowserState>(
      localStorage.getItem('travels-corrupted'),
      {
        fallback: {
          version: TRAVELS_HISTORY_SCHEMA_VERSION,
          state: { title: 'Fallback', blocks: [] },
          patches: { patches: [], inversePatches: [] },
          position: 0,
        },
        onError(error) {
          if (error instanceof TravelsPersistenceError) {
            console.warn(error.code);
          }
        },
      }
    );

    expect(history.state.title).toBe('Fallback');
    expect(warnSpy).toHaveBeenCalledWith('PARSE_ERROR');
    warnSpy.mockRestore();
  });

  test('warns when DOM nodes are placed in state', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createTravels({
      element: document.createElement('div'),
    });

    expect(
      warnSpy.mock.calls.some(([message]) =>
        String(message).includes('DOM nodes and refs')
      )
    ).toBe(true);

    warnSpy.mockRestore();
  });
});
