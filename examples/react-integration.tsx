/**
 * React Integration Example
 *
 * This example shows how to integrate Travels with React using
 * useSyncExternalStore for automatic re-renders.
 */

import React, { useSyncExternalStore, useCallback } from 'react';
import { createTravels, type Travels } from '../src/index';

// Define your app state
interface CounterState {
  count: number;
  history: string[];
}

// Create a singleton travels instance
const travels = createTravels<CounterState>({
  count: 0,
  history: [],
});

// Custom hook to use Travels in React components
function useTravel<S>(travelsInstance: Travels<S, any, any>) {
  // Subscribe to state changes
  const state = useSyncExternalStore(
    travelsInstance.subscribe.bind(travelsInstance),
    travelsInstance.getState.bind(travelsInstance),
    travelsInstance.getState.bind(travelsInstance)
  );

  // Get controls
  const controls = travelsInstance.getControls();

  // Memoized setState
  const setState = useCallback(
    (updater: any) => {
      travelsInstance.setState(updater);
    },
    [travelsInstance]
  );

  return [state, setState, controls] as const;
}

// Example component
export function Counter() {
  const [state, setState, controls] = useTravel(travels);

  const increment = () => {
    setState((draft: CounterState) => {
      draft.count += 1;
      draft.history.push(`Incremented to ${draft.count + 1}`);
    });
  };

  const decrement = () => {
    setState((draft: CounterState) => {
      draft.count -= 1;
      draft.history.push(`Decremented to ${draft.count - 1}`);
    });
  };

  const reset = () => {
    controls.reset();
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Travels + React Counter</h1>

      <div style={{ fontSize: '48px', margin: '20px 0' }}>
        Count: {state.count}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={decrement}>-1</button>
        <button onClick={increment}>+1</button>
        <button onClick={reset}>Reset</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => controls.back()} disabled={!controls.canBack()}>
          ← Undo
        </button>
        <button
          onClick={() => controls.forward()}
          disabled={!controls.canForward()}
        >
          Redo →
        </button>
        <span style={{ lineHeight: '30px' }}>
          Position: {controls.position} / {controls.patches.patches.length}
        </span>
      </div>

      <div>
        <h3>History</h3>
        <ul>
          {state.history.map((entry, index) => (
            <li key={index}>{entry}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3>State History Timeline</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {controls.getHistory().map((historyState, index) => (
            <button
              key={index}
              onClick={() => controls.go(index)}
              style={{
                padding: '5px 10px',
                backgroundColor:
                  index === controls.position ? '#4CAF50' : '#ddd',
                color: index === controls.position ? 'white' : 'black',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {historyState.count}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Example with manual archive mode for complex operations
interface FormState {
  firstName: string;
  lastName: string;
  email: string;
}

const formTravels = createTravels<FormState>(
  {
    firstName: '',
    lastName: '',
    email: '',
  },
  { autoArchive: false }
);

export function Form() {
  const [state, setState, controls] = useTravel(formTravels);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Archive the form state after submission
    if (formTravels.canArchive()) {
      formTravels.archive();
    }
    alert('Form submitted and archived!');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Form with Manual Archive</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label>
            First Name:
            <input
              type="text"
              value={state.firstName}
              onChange={(e) =>
                setState((draft: FormState) => {
                  draft.firstName = e.target.value;
                })
              }
            />
          </label>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>
            Last Name:
            <input
              type="text"
              value={state.lastName}
              onChange={(e) =>
                setState((draft: FormState) => {
                  draft.lastName = e.target.value;
                })
              }
            />
          </label>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>
            Email:
            <input
              type="email"
              value={state.email}
              onChange={(e) =>
                setState((draft: FormState) => {
                  draft.email = e.target.value;
                })
              }
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit">Submit & Archive</button>
          <button
            type="button"
            onClick={() => controls.back()}
            disabled={!controls.canBack()}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => controls.forward()}
            disabled={!controls.canForward()}
          >
            Redo
          </button>
        </div>

        <p>
          {formTravels.canArchive()
            ? '⚠️ Unarchived changes'
            : '✓ All changes archived'}
        </p>
      </form>

      <div>
        <h3>Current Values</h3>
        <pre>{JSON.stringify(state, null, 2)}</pre>
      </div>
    </div>
  );
}

// App component
export function App() {
  return (
    <>
      <Counter />
      <hr style={{ margin: '40px 0' }} />
      <Form />
    </>
  );
}
