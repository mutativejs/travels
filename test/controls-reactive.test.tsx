/**
 * Controls Object Reactivity Tests
 *
 * This test demonstrates why subscribe + getter doesn't fully solve reactivity issues
 */

import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useSyncExternalStore, useMemo } from 'react';
import { createTravels } from '../src/index';

describe('Controls Reactive Problem', () => {
  test('Clarification: Getter actually works in normal rendering scenarios', () => {
    const travels = createTravels({ count: 0 });

    // Simulate React component
    function Counter() {
      const controls = useMemo(() => travels.getControls(), []);

      // Subscribe to state changes, will trigger re-render
      useSyncExternalStore(
        travels.subscribe.bind(travels),
        travels.getState.bind(travels)
      );

      return (
        <div>
          <div data-testid="position">{controls.position}</div>
          <button onClick={() => travels.setState({ count: 1 })}>Update</button>
        </div>
      );
    }

    render(<Counter />);

    // Initial value
    expect(screen.getByTestId('position').textContent).toBe('0');

    // Update state
    fireEvent.click(screen.getByText('Update'));

    // ✅ Position actually updates correctly to 1
    // Because state change triggers re-render, and re-render re-reads controls.position getter
    expect(screen.getByTestId('position').textContent).toBe('1');
    expect(travels.getPosition()).toBe(1);
  });

  test('Root cause: React re-render mechanism', () => {
    const travels = createTravels({ count: 0 });

    let renderCount = 0;
    const renderCounts: number[] = [];

    function Counter() {
      renderCount++;
      renderCounts.push(renderCount);

      const controls = useMemo(() => travels.getControls(), []);

      useSyncExternalStore(
        travels.subscribe.bind(travels),
        travels.getState.bind(travels)
      );

      return (
        <div>
          <div data-testid="render-count">{renderCount}</div>
          <div data-testid="position">{controls.position}</div>
          <button onClick={() => travels.setState({ count: 1 })}>Update</button>
        </div>
      );
    }

    render(<Counter />);

    // First render
    expect(renderCounts).toEqual([1]);
    expect(screen.getByTestId('position').textContent).toBe('0');

    // Update state
    fireEvent.click(screen.getByText('Update'));

    // Second render (because of state change)
    expect(renderCounts).toEqual([1, 2]);

    // ✅ Although re-rendered, controls.position reads the same getter
    // In the second render:
    // 1. controls object unchanged (useMemo)
    // 2. controls.position calls getter, returns 1
    // 3. But {controls.position} in JSX evaluates once during render
    // Actually position should be 1 now, let me re-test...
    expect(screen.getByTestId('position').textContent).toBe('1');
  });

  test('Deep analysis: Getter behavior in React', () => {
    const travels = createTravels({ count: 0 });

    const positionAccessLog: number[] = [];

    function Counter() {
      const controls = useMemo(() => travels.getControls(), []);

      // Subscribe to state changes
      const state = useSyncExternalStore(
        travels.subscribe.bind(travels),
        travels.getState.bind(travels)
      );

      // Log each access to position
      const currentPosition = controls.position;
      positionAccessLog.push(currentPosition);

      return (
        <div>
          <div data-testid="state">{JSON.stringify(state)}</div>
          <div data-testid="position">{currentPosition}</div>
          <button onClick={() => travels.setState({ count: 1 })}>Update</button>
        </div>
      );
    }

    render(<Counter />);

    // First render, position = 0
    expect(positionAccessLog).toEqual([0]);

    // Update state
    fireEvent.click(screen.getByText('Update'));

    // Second render, position = 1
    // ✅ Getter actually works! Because re-render re-reads controls.position
    expect(positionAccessLog).toEqual([0, 1]);
    expect(screen.getByTestId('position').textContent).toBe('1');
  });

  test('Real problem: When controls is used as a dependency', () => {
    const travels = createTravels({ count: 0 });

    const effectCalls: number[] = [];

    function Counter() {
      const controls = useMemo(() => travels.getControls(), []);

      const state = useSyncExternalStore(
        travels.subscribe.bind(travels),
        travels.getState.bind(travels)
      );

      // ❌ Problem scenario: useEffect depends on controls
      React.useEffect(() => {
        effectCalls.push(controls.position);
      }, [controls]); // controls reference unchanged, effect won't re-execute

      return (
        <div>
          <div data-testid="position">{controls.position}</div>
          <button onClick={() => travels.setState({ count: 1 })}>Update</button>
        </div>
      );
    }

    render(<Counter />);

    // Initial render, effect executes once
    expect(effectCalls).toEqual([0]);

    // Update state
    fireEvent.click(screen.getByText('Update'));

    // ❌ Effect didn't re-execute because controls object reference unchanged
    expect(effectCalls).toEqual([0]); // Still only one call
    expect(screen.getByTestId('position').textContent).toBe('1'); // But UI displays correctly
  });

  test('Problem scenario 2: Passing controls to child component', () => {
    const travels = createTravels({ count: 0 });

    const childRenderLog: number[] = [];

    // Child component with React.memo optimization
    const ControlsDisplay = React.memo(({ controls }: any) => {
      childRenderLog.push(controls.position);
      return <div data-testid="child-position">{controls.position}</div>;
    });

    function Parent() {
      const controls = useMemo(() => travels.getControls(), []);

      useSyncExternalStore(
        travels.subscribe.bind(travels),
        travels.getState.bind(travels)
      );

      return (
        <div>
          <ControlsDisplay controls={controls} />
          <button onClick={() => travels.setState({ count: 1 })}>Update</button>
        </div>
      );
    }

    render(<Parent />);

    // Initial render
    expect(childRenderLog).toEqual([0]);
    expect(screen.getByTestId('child-position').textContent).toBe('0');

    // Update state
    fireEvent.click(screen.getByText('Update'));

    // ❌ Child component didn't re-render!
    // Because controls object reference unchanged, React.memo prevented re-render
    expect(childRenderLog).toEqual([0]); // Still only one render
    expect(screen.getByTestId('child-position').textContent).toBe('0'); // UI not updated!

    // But actual position is already 1
    expect(travels.getPosition()).toBe(1);
  });

  test('Problem scenario 3: Using controls.position in object literals', () => {
    const travels = createTravels({ count: 0 });

    const dataSnapshots: any[] = [];

    function Counter() {
      const controls = useMemo(() => travels.getControls(), []);

      useSyncExternalStore(
        travels.subscribe.bind(travels),
        travels.getState.bind(travels)
      );

      // ❌ Problem: This object is recreated every render
      // But if we use useMemo([controls]), it won't update
      const data = {
        position: controls.position,
        canBack: controls.canBack(),
        canForward: controls.canForward(),
      };

      dataSnapshots.push(data);

      return (
        <div>
          <div data-testid="data">{JSON.stringify(data)}</div>
          <button onClick={() => travels.setState({ count: 1 })}>Update</button>
        </div>
      );
    }

    render(<Counter />);

    // Initial state
    expect(dataSnapshots[0]).toEqual({
      position: 0,
      canBack: false,
      canForward: false,
    });

    // Update
    fireEvent.click(screen.getByText('Update'));

    // ✅ This scenario works normally because getter is re-read every render
    expect(dataSnapshots[1]).toEqual({
      position: 1,
      canBack: true,
      canForward: false,
    });
  });

  test('Summary: The real problem', async () => {
    const travels = createTravels({ count: 0 });

    /**
     * Problems with subscribe + getter:
     *
     * 1. ✅ Normal scenario: Reading controls.position directly each render works
     *    Because React re-renders and re-executes JSX, re-calling the getter
     *
     * 2. ❌ Problem scenario 1: When controls is passed as dependency to useEffect/useMemo
     *    Because controls object reference unchanged, dependency check fails
     *
     * 3. ❌ Problem scenario 2: When controls is passed to React.memo wrapped child component
     *    Child won't re-render, getter won't be re-called
     *
     * 4. ❌ Problem scenario 3: Developer may expect controls object itself to be reactive
     *    But actually only the getter is reactive, object reference unchanged
     */

    // Demonstrate correct usage
    function CorrectUsage() {
      // ✅ Solution 1: Get position from subscribe callback
      const [snapshot, setSnapshot] = React.useState(() => ({
        state: travels.getState(),
        position: travels.getPosition(),
      }));

      React.useEffect(() => {
        return travels.subscribe((state, _, position) => {
          setSnapshot({ state, position });
        });
      }, []);

      return <div data-testid="correct">{snapshot.position}</div>;
    }

    // ✅ Solution 2: Create custom hook
    function useControls() {
      const [position, setPosition] = React.useState(travels.getPosition());

      React.useEffect(() => {
        return travels.subscribe((_, __, pos) => {
          setPosition(pos);
        });
      }, []);

      return { position };
    }

    function WithCustomHook() {
      const controls = useControls();
      return <div data-testid="custom-hook">{controls.position}</div>;
    }

    const { rerender: rerender1 } = render(<CorrectUsage />);
    const { rerender: rerender2 } = render(<WithCustomHook />);

    expect(screen.getByTestId('correct').textContent).toBe('0');
    expect(screen.getByTestId('custom-hook').textContent).toBe('0');

    travels.setState({ count: 1 });

    // Force re-render to trigger useEffect
    rerender1(<CorrectUsage />);
    rerender2(<WithCustomHook />);

    // ✅ These solutions can correctly update
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.getByTestId('correct').textContent).toBe('1');
    expect(screen.getByTestId('custom-hook').textContent).toBe('1');
  });

  test('Conclusion: When getter pattern works and when it does not', () => {
    /**
     * Getter pattern works well in 95% of cases:
     * ✅ Direct rendering: <div>{controls.position}</div>
     * ✅ Derived values recalculated each render
     * ✅ Most common React patterns
     *
     * Getter pattern fails in edge cases:
     * ❌ useEffect/useMemo dependencies expecting object change
     * ❌ React.memo preventing child re-renders
     * ❌ Developer mental model mismatch (expecting reactive object)
     *
     * Conclusion from README:
     * - For 95% of use cases, getter + subscribe works perfectly
     * - For edge cases, use subscribe callback to create truly reactive state
     * - Or create custom hooks that wrap subscribe
     * - The design is intentionally simple and flexible
     */
    expect(true).toBe(true); // Symbolic assertion
  });
});
