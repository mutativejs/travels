import { expect, describe, test } from 'vitest';
import { createTravels } from '../src/index';

describe('rebase()', () => {
  interface State {
    count: number;
    text: string;
  }

  const initial: State = { count: 0, text: 'initial' };

  // ─── Core behaviour ───────────────────────────────────────────────────────

  test('resets position to 0 and clears history', () => {
    const travels = createTravels<State>(initial);

    travels.setState((d) => { d.count = 1; });
    travels.setState((d) => { d.count = 2; });
    travels.setState((d) => { d.count = 3; });

    expect(travels.getHistory()).toHaveLength(4);

    travels.rebase();

    expect(travels.getPosition()).toBe(0);
    expect(travels.getHistory()).toHaveLength(1);
    expect(travels.getHistory()[0]).toEqual({ count: 3, text: 'initial' });
    expect(travels.canBack()).toBe(false);
    expect(travels.canForward()).toBe(false);
  });

  test('preserves current state value after rebase', () => {
    const travels = createTravels<State>(initial);

    travels.setState((d) => { d.count = 5; d.text = 'changed'; });
    travels.rebase();

    expect(travels.getState()).toEqual({ count: 5, text: 'changed' });
  });

  test('reset() after rebase returns to new baseline state, not original initial', () => {
    const travels = createTravels<State>(initial);
    const controls = travels.getControls();

    travels.setState((d) => { d.count = 1; });
    travels.setState((d) => { d.count = 2; });

    controls.rebase();

    travels.setState((d) => { d.count = 3; });
    controls.reset();

    expect(travels.getState().count).toBe(2);
    expect(controls.position).toBe(0);
  });

  test('new history accumulates normally after rebase', () => {
    const travels = createTravels<State>(initial);

    travels.setState((d) => { d.count = 1; });
    travels.rebase();

    travels.setState((d) => { d.count = 2; });
    travels.setState((d) => { d.count = 3; });

    expect(travels.getHistory()).toHaveLength(3);
    expect(travels.canBack()).toBe(true);

    travels.back();
    expect(travels.getState().count).toBe(2);
  });

  // ─── Mid-history rebase ───────────────────────────────────────────────────

  test('rebase at mid-history discards future and past entries', () => {
    const travels = createTravels<State>(initial);

    travels.setState((d) => { d.count = 1; });
    travels.setState((d) => { d.count = 2; });
    travels.setState((d) => { d.count = 3; });

    // Navigate back to count = 1
    travels.go(1);
    expect(travels.getState().count).toBe(1);

    travels.rebase();

    expect(travels.getState().count).toBe(1);
    expect(travels.getPosition()).toBe(0);
    expect(travels.getHistory()).toHaveLength(1);
    expect(travels.canBack()).toBe(false);
    expect(travels.canForward()).toBe(false);
  });

  // ─── Manual archive mode ──────────────────────────────────────────────────

  test('clear unarchived temp patches and set new baseline as current state even if some changes were not archived', () => {
    const travels = createTravels<State>(initial, { autoArchive: false });
    const controls = travels.getControls();

    travels.setState((d) => { d.count = 1; });
    travels.setState((d) => { d.count = 2; });

    expect(controls.canArchive()).toBe(true);

    controls.rebase();

    expect(controls.canArchive()).toBe(false);
    expect(controls.canForward()).toBe(false);
    expect(controls.canBack()).toBe(false);
    expect(travels.getState().count).toBe(2);
    expect(controls.position).toBe(0);
    expect(controls.getHistory()).toHaveLength(1);
  });

  test('reset() after rebase in manual mode returns to new baseline state', () => {
    const travels = createTravels<State>(initial, { autoArchive: false });
    const controls = travels.getControls();

    travels.setState((d) => { d.count = 3; });
    controls.rebase();
    travels.setState((d) => { d.count = 9; });
    controls.reset();

    expect(travels.getState().count).toBe(3);
  });

  // ─── Mutable mode ─────────────────────────────────────────────────────────

  test('preserves object reference in mutable mode', () => {
    const data: State = { count: 0, text: 'initial' };
    const travels = createTravels(data, { mutable: true });

    travels.setState((d) => { d.count = 1; });
    expect(travels.getState()).toBe(data);

    travels.rebase();

    expect(travels.getState()).toBe(data);
    expect(data.count).toBe(1);
    expect(travels.getPosition()).toBe(0);
  });

  test('reset() after rebase in mutable mode reverts to new baseline values in-place', () => {
    const data: State = { count: 0, text: 'initial' };
    const travels = createTravels(data, { mutable: true });

    travels.setState((d) => { d.count = 1; });
    travels.rebase();

    travels.setState((d) => { d.count = 2; });
    expect(data.count).toBe(2);

    travels.reset();
    expect(data.count).toBe(1);
    expect(travels.getState()).toBe(data);
  });

  // ─── maxHistory interaction ───────────────────────────────────────────────

  test('rebase with maxHistory: 2 resets capacity for new history', () => {
    const travels = createTravels<State>(initial, { maxHistory: 2 });

    travels.setState((d) => { d.count = 1; });
    travels.setState((d) => { d.count = 2; });
    travels.setState((d) => { d.count = 3; });

    // Only last 2 steps kept
    expect(travels.getHistory()).toHaveLength(3);

    travels.rebase();

    // After rebase the capacity is fresh
    travels.setState((d) => { d.count = 4; });
    travels.setState((d) => { d.count = 5; });
    travels.setState((d) => { d.count = 6; });

    expect(travels.getHistory()).toHaveLength(3); // maxHistory=2 → 3 entries
    expect(travels.getState().count).toBe(6);
  });

  // ─── initialPatches interaction ───────────────────────────────────────────

  test('rebase discards initialPatches so reset no longer restores them', () => {
    const seed = createTravels<State>(initial);
    seed.setState((d) => { d.count = 1; });
    seed.setState((d) => { d.count = 2; });

    const travels = createTravels<State>(
      { count: 10, text: 'initial' },
      {
       initialPatches: seed.getPatches(),
      }
    );

    expect(travels.getState().count).toBe(10);
    // check that initialPatches are stored in history
    expect(travels.getHistory()).toHaveLength(3);

    travels.rebase();

    expect(travels.getPosition()).toBe(0);
    expect(travels.getHistory()).toHaveLength(1);

    // reset() now returns to the new baseline state, not the original position=0 from initialPatches
    travels.setState((d) => { d.count = 99; });
    travels.reset();
    expect(travels.getState().count).toBe(10);
  });

  // ─── Idempotency ──────────────────────────────────────────────────────────

  test('calling rebase() twice is safe', () => {
    const travels = createTravels<State>(initial);

    travels.setState((d) => { d.count = 1; });
    travels.rebase();
    travels.rebase();

    expect(travels.getState().count).toBe(1);
    expect(travels.getPosition()).toBe(0);
    expect(travels.getHistory()).toHaveLength(1);
  });

  test('rebase() on untouched instance is a no-op', () => {
    const travels = createTravels<State>(initial);
    travels.rebase();

    expect(travels.getState()).toEqual(initial);
    expect(travels.getPosition()).toBe(0);
    expect(travels.getHistory()).toHaveLength(1);
  });
});