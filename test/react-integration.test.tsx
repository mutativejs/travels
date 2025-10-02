import { expect, describe, test, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncExternalStore, useCallback } from 'react';
import { createTravels, Updater, type Travels } from '../src/index';

/**
 * Test suite for react-integration.tsx example
 * This tests the React integration demonstrated in examples/react-integration.tsx
 */

// Custom hook from the example
function useTravel<S>(travelsInstance: Travels<S, any, any>) {
  const state = useSyncExternalStore(
    travelsInstance.subscribe.bind(travelsInstance),
    travelsInstance.getState.bind(travelsInstance),
    travelsInstance.getState.bind(travelsInstance)
  );

  const controls = travelsInstance.getControls();

  const setState = useCallback(
    (updater: any) => {
      travelsInstance.setState(updater);
    },
    [travelsInstance]
  );

  return [
    state as S,
    setState as (updater: Updater<S>) => void,
    controls,
  ] as const;
}

describe('React Integration Example - useTravel Hook', () => {
  interface CounterState {
    count: number;
    history: string[];
  }

  let travels: Travels<CounterState>;

  beforeEach(() => {
    travels = createTravels<CounterState>({
      count: 0,
      history: [],
    });
  });

  test('should initialize with default state', () => {
    const { result } = renderHook(() => useTravel(travels));
    const [state] = result.current;

    expect(state).toEqual({
      count: 0,
      history: [],
    });
  });

  test('should update state and trigger re-render', () => {
    const { result } = renderHook(() => useTravel(travels));

    act(() => {
      const [, setState] = result.current;
      setState((draft: CounterState) => {
        draft.count = 1;
        draft.history.push('Incremented to 1');
      });
    });

    const [state] = result.current;
    expect(state.count).toBe(1);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toBe('Incremented to 1');
  });

  test('should support undo/redo operations', () => {
    const { result } = renderHook(() => useTravel(travels));

    act(() => {
      const [, setState] = result.current;
      setState((draft: CounterState) => {
        draft.count = 1;
        draft.history.push('Incremented to 1');
      });
    });

    act(() => {
      const [, setState] = result.current;
      setState((draft: CounterState) => {
        draft.count = 2;
        draft.history.push('Incremented to 2');
      });
    });

    expect(result.current[0].count).toBe(2);

    act(() => {
      const [, , controls] = result.current;
      controls.back();
    });

    expect(result.current[0].count).toBe(1);
    expect(result.current[2].canBack()).toBe(true);
    expect(result.current[2].canForward()).toBe(true);

    act(() => {
      const [, , controls] = result.current;
      controls.forward();
    });

    expect(result.current[0].count).toBe(2);
  });

  test('should reset to initial state', () => {
    const { result } = renderHook(() => useTravel(travels));

    act(() => {
      const [, setState] = result.current;
      setState((draft: CounterState) => {
        draft.count = 5;
        draft.history.push('Changed to 5');
      });
    });

    expect(result.current[0].count).toBe(5);

    act(() => {
      const [, , controls] = result.current;
      controls.reset();
    });

    expect(result.current[0]).toEqual({
      count: 0,
      history: [],
    });
  });

  test('should navigate through history', () => {
    const { result } = renderHook(() => useTravel(travels));

    act(() => {
      const [, setState] = result.current;
      setState((draft: CounterState) => {
        draft.count = 1;
      });
    });

    act(() => {
      const [, setState] = result.current;
      setState((draft: CounterState) => {
        draft.count = 2;
      });
    });

    act(() => {
      const [, setState] = result.current;
      setState((draft: CounterState) => {
        draft.count = 3;
      });
    });

    act(() => {
      const [, , controls] = result.current;
      controls.go(1);
    });

    expect(result.current[0].count).toBe(1);
    expect(result.current[2].position).toBe(1);
  });

  test('should provide history timeline', () => {
    const { result } = renderHook(() => useTravel(travels));

    act(() => {
      const [, setState] = result.current;
      setState((draft: CounterState) => {
        draft.count = 1;
      });
    });

    act(() => {
      const [, setState] = result.current;
      setState((draft: CounterState) => {
        draft.count = 2;
      });
    });

    const [, , controls] = result.current;
    const history = controls.getHistory();

    expect(history).toHaveLength(3);
    expect(history[0].count).toBe(0);
    expect(history[1].count).toBe(1);
    expect(history[2].count).toBe(2);
  });
});

describe('React Integration Example - Manual Archive Form', () => {
  interface FormState {
    firstName: string;
    lastName: string;
    email: string;
  }

  let formTravels: Travels<FormState, false, false>;

  beforeEach(() => {
    formTravels = createTravels<FormState>(
      {
        firstName: '',
        lastName: '',
        email: '',
      },
      { autoArchive: false }
    );
  });

  test('should update form fields without auto-archiving', () => {
    const { result } = renderHook(() => useTravel(formTravels));

    act(() => {
      const [, setState] = result.current;
      setState((draft: FormState) => {
        draft.firstName = 'John';
      });
    });

    act(() => {
      const [, setState] = result.current;
      setState((draft: FormState) => {
        draft.lastName = 'Doe';
      });
    });

    const [state] = result.current;
    expect(state.firstName).toBe('John');
    expect(state.lastName).toBe('Doe');
    expect(formTravels.canArchive()).toBe(true);
  });

  test('should archive form changes manually', () => {
    const { result } = renderHook(() => useTravel(formTravels));

    act(() => {
      const [, setState] = result.current;
      setState((draft: FormState) => {
        draft.firstName = 'John';
      });
    });

    act(() => {
      const [, setState] = result.current;
      setState((draft: FormState) => {
        draft.lastName = 'Doe';
      });
    });

    act(() => {
      const [, setState] = result.current;
      setState((draft: FormState) => {
        draft.email = 'john@example.com';
      });
    });

    expect(formTravels.canArchive()).toBe(true);

    act(() => {
      formTravels.archive();
    });

    expect(formTravels.canArchive()).toBe(false);
  });

  test('should undo all form changes in one step after archive', () => {
    const { result } = renderHook(() => useTravel(formTravels));

    act(() => {
      const [, setState] = result.current;
      setState((draft: FormState) => {
        draft.firstName = 'John';
      });
      setState((draft: FormState) => {
        draft.lastName = 'Doe';
      });
      setState((draft: FormState) => {
        draft.email = 'john@example.com';
      });
    });

    act(() => {
      formTravels.archive();
    });

    act(() => {
      const [, , controls] = result.current;
      controls.back();
    });

    const [state] = result.current;
    expect(state).toEqual({
      firstName: '',
      lastName: '',
      email: '',
    });
  });

  test('should support multiple archive cycles in form', () => {
    const { result } = renderHook(() => useTravel(formTravels));

    // First cycle: Fill name
    act(() => {
      const [, setState] = result.current;
      setState((draft: FormState) => {
        draft.firstName = 'John';
        draft.lastName = 'Doe';
      });
    });
    act(() => {
      formTravels.archive();
    });

    // Second cycle: Add email
    act(() => {
      const [, setState] = result.current;
      setState((draft: FormState) => {
        draft.email = 'john@example.com';
      });
    });
    act(() => {
      formTravels.archive();
    });

    // Undo email
    act(() => {
      const [, , controls] = result.current;
      controls.back();
    });

    expect(result.current[0].email).toBe('');
    expect(result.current[0].firstName).toBe('John');

    // Undo name
    act(() => {
      const [, , controls] = result.current;
      controls.back();
    });

    expect(result.current[0]).toEqual({
      firstName: '',
      lastName: '',
      email: '',
    });
  });

  test('should handle undo/redo with manual archive controls', () => {
    const { result } = renderHook(() => useTravel(formTravels));

    act(() => {
      const [, setState] = result.current;
      setState((draft: FormState) => {
        draft.firstName = 'Alice';
      });
    });
    act(() => {
      formTravels.archive();
    });

    act(() => {
      const [, setState] = result.current;
      setState((draft: FormState) => {
        draft.lastName = 'Smith';
      });
    });
    act(() => {
      formTravels.archive();
    });

    const [, , controls] = result.current;

    expect(controls.canBack()).toBe(true);
    expect(controls.canForward()).toBe(false);

    act(() => {
      controls.back();
    });

    expect(result.current[0].lastName).toBe('');
    expect(result.current[2].canForward()).toBe(true);

    act(() => {
      controls.forward();
    });

    expect(result.current[0].lastName).toBe('Smith');
  });
});
