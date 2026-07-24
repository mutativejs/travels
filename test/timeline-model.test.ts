import { apply, create, type Patches } from 'mutative';
import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { createTravelJournal, createTravels, TravelsError } from '../src/index';

type ModelOperation =
  | { kind: 'set'; value: number }
  | { kind: 'back'; amount: number }
  | { kind: 'forward'; amount: number }
  | { kind: 'go'; position: number };

type TimelineModel = {
  states: number[];
  position: number;
};

const maxHistory = 5;

const operationArbitrary = fc.oneof<ModelOperation>(
  fc.record({
    kind: fc.constant('set'),
    value: fc.integer({ min: -10, max: 10 }),
  }),
  fc.record({
    kind: fc.constant('back'),
    amount: fc.integer({ min: 0, max: 10 }),
  }),
  fc.record({
    kind: fc.constant('forward'),
    amount: fc.integer({ min: 0, max: 10 }),
  }),
  fc.record({
    kind: fc.constant('go'),
    position: fc.integer({ min: -5, max: 15 }),
  })
);

const clampPosition = (model: TimelineModel, position: number): number =>
  Math.max(0, Math.min(position, model.states.length - 1));

const appendModelState = (model: TimelineModel, value: number): boolean => {
  if (model.states[model.position] === value) {
    return false;
  }

  model.states.length = model.position + 1;
  model.states.push(value);
  model.position += 1;

  if (model.states.length - 1 > maxHistory) {
    model.states.shift();
    model.position -= 1;
  }
  return true;
};

const applyToModel = (model: TimelineModel, operation: ModelOperation): void => {
  switch (operation.kind) {
    case 'set':
      appendModelState(model, operation.value);
      return;
    case 'back':
      model.position = clampPosition(model, model.position - operation.amount);
      return;
    case 'forward':
      model.position = clampPosition(model, model.position + operation.amount);
      return;
    case 'go':
      model.position = clampPosition(model, operation.position);
      return;
  }
};

const assertTimeline = (
  timeline: {
    getState(): { value: number };
    getPosition(): number;
    getHistory(): readonly { value: number }[];
    canBack(): boolean;
    canForward(): boolean;
  },
  model: TimelineModel
): void => {
  expect(timeline.getState().value).toBe(model.states[model.position]);
  expect(timeline.getPosition()).toBe(model.position);
  expect(timeline.getHistory().map((state) => state.value)).toEqual(
    model.states
  );
  expect(timeline.canBack()).toBe(model.position > 0);
  expect(timeline.canForward()).toBe(
    model.position < model.states.length - 1
  );
};

const executeOperation = (
  timeline: {
    setState(updater: (draft: { value: number }) => void): void;
    back(amount?: number): void;
    forward(amount?: number): void;
    go(position: number): void;
  },
  operation: ModelOperation
): void => {
  switch (operation.kind) {
    case 'set':
      timeline.setState((draft) => {
        draft.value = operation.value;
      });
      return;
    case 'back':
      timeline.back(operation.amount);
      return;
    case 'forward':
      timeline.forward(operation.amount);
      return;
    case 'go':
      timeline.go(operation.position);
      return;
  }
};

describe('timeline state-machine model', () => {
  test('immutable edits and navigation match a snapshot reference model', () => {
    fc.assert(
      fc.property(
        fc.array(operationArbitrary, { minLength: 1, maxLength: 100 }),
        (operations) => {
          const travels = createTravels(
            { value: 0 },
            { maxHistory, warnOnUnsupportedState: false }
          );
          const model: TimelineModel = { states: [0], position: 0 };

          for (const operation of operations) {
            applyToModel(model, operation);
            executeOperation(travels, operation);
            assertTimeline(travels, model);
          }
        }
      ),
      { numRuns: 100, seed: 20260724 }
    );
  });

  test('mutable navigation matches the model while preserving root identity', () => {
    fc.assert(
      fc.property(
        fc.array(operationArbitrary, { minLength: 1, maxLength: 80 }),
        (operations) => {
          const initialState = { value: 0 };
          const travels = createTravels(initialState, {
            mutable: true,
            maxHistory,
            warnOnUnsupportedState: false,
          });
          const model: TimelineModel = { states: [0], position: 0 };

          for (const operation of operations) {
            applyToModel(model, operation);
            executeOperation(travels, operation);
            expect(travels.getState()).toBe(initialState);
            assertTimeline(travels, model);
          }
        }
      ),
      { numRuns: 75, seed: 20260725 }
    );
  });

  test('controlled commits and delegated navigation match the same model', () => {
    fc.assert(
      fc.property(
        fc.array(operationArbitrary, { minLength: 1, maxLength: 80 }),
        (operations) => {
          let authoritativeState = { value: 0 };
          const journal = createTravelJournal(authoritativeState, {
            maxHistory,
            warnOnUnsupportedState: false,
            apply: ({ patches }) => {
              authoritativeState = apply(authoritativeState, patches);
              return authoritativeState;
            },
          });
          const model: TimelineModel = { states: [0], position: 0 };

          for (const operation of operations) {
            applyToModel(model, operation);
            if (operation.kind === 'set') {
              const [nextState, patches, inversePatches] = create(
                authoritativeState,
                (draft) => {
                  draft.value = operation.value;
                },
                { enablePatches: true }
              ) as [{ value: number }, Patches, Patches];
              authoritativeState = nextState;
              journal.recordPatches(authoritativeState, {
                patches,
                inversePatches,
              });
            } else if (operation.kind === 'back') {
              journal.back(operation.amount);
            } else if (operation.kind === 'forward') {
              journal.forward(operation.amount);
            } else {
              journal.go(operation.position);
            }

            expect(journal.getState()).toBe(authoritativeState);
            assertTimeline(journal, model);
          }
        }
      ),
      { numRuns: 75, seed: 20260726 }
    );
  });

  test('manual archive composes pending edits into one modeled entry', () => {
    type ManualOperation = ModelOperation | { kind: 'archive' };
    type ManualModel = TimelineModel & { pending: boolean };
    const manualOperation = fc.oneof<ManualOperation>(
      operationArbitrary,
      fc.record({ kind: fc.constant('archive') })
    );

    fc.assert(
      fc.property(
        fc.array(manualOperation, { minLength: 1, maxLength: 80 }),
        (operations) => {
          const travels = createTravels(
            { value: 0 },
            {
              autoArchive: false,
              maxHistory,
              warnOnUnsupportedState: false,
            }
          );
          const model: ManualModel = {
            states: [0],
            position: 0,
            pending: false,
          };

          for (const operation of operations) {
            if (operation.kind === 'set') {
              const current = model.states[model.position];
              if (current !== operation.value) {
                if (model.pending) {
                  model.states[model.position] = operation.value;
                } else {
                  model.states.length = model.position + 1;
                  model.states.push(operation.value);
                  model.position += 1;
                  model.pending = true;
                  if (model.states.length - 1 > maxHistory) {
                    model.states.shift();
                    model.position -= 1;
                  }
                }
              }
              travels.setState((draft) => {
                draft.value = operation.value;
              });
            } else if (operation.kind === 'archive') {
              model.pending = false;
              travels.archive({ label: `position-${model.position}` });
            } else {
              if (model.pending) model.pending = false;
              applyToModel(model, operation);
              if (operation.kind === 'back') {
                travels.back(operation.amount);
              } else if (operation.kind === 'forward') {
                travels.forward(operation.amount);
              } else {
                travels.go(operation.position);
              }
            }

            expect(travels.canArchive()).toBe(model.pending);
            assertTimeline(travels, model);
          }
        }
      ),
      { numRuns: 75, seed: 20260727 }
    );
  });

  test('transactions, pause tracking, rebase, and reset match lifecycle model', () => {
    type LifecycleOperation =
      | { kind: 'set'; value: number }
      | { kind: 'transaction'; values: number[]; fail: boolean }
      | { kind: 'pauseSet'; value: number }
      | { kind: 'rebase' }
      | { kind: 'reset' };
    const lifecycleOperation = fc.oneof<LifecycleOperation>(
      fc.record({
        kind: fc.constant('set'),
        value: fc.integer({ min: -5, max: 5 }),
      }),
      fc.record({
        kind: fc.constant('transaction'),
        values: fc.array(fc.integer({ min: -5, max: 5 }), {
          minLength: 0,
          maxLength: 5,
        }),
        fail: fc.boolean(),
      }),
      fc.record({
        kind: fc.constant('pauseSet'),
        value: fc.integer({ min: -5, max: 5 }),
      }),
      fc.record({ kind: fc.constant('rebase') }),
      fc.record({ kind: fc.constant('reset') })
    );

    fc.assert(
      fc.property(
        fc.array(lifecycleOperation, { minLength: 1, maxLength: 60 }),
        (operations) => {
          const travels = createTravels(
            { value: 0 },
            { maxHistory, warnOnUnsupportedState: false }
          );
          const model: TimelineModel & { baseline: number } = {
            states: [0],
            position: 0,
            baseline: 0,
          };
          travels.subscribe((event) => {
            expect(event.state).toBe(travels.getState());
            expect(event.position).toBe(travels.getPosition());
            expect(event.historyLength).toBe(
              Math.max(0, travels.getHistory().length - 1)
            );
          });

          for (const operation of operations) {
            if (operation.kind === 'set') {
              appendModelState(model, operation.value);
              travels.setState(
                (draft) => {
                  draft.value = operation.value;
                },
                { label: `set-${operation.value}` }
              );
            } else if (operation.kind === 'transaction') {
              let changed = false;
              let value = model.states[model.position];
              for (const nextValue of operation.values) {
                if (nextValue !== value) changed = true;
                value = nextValue;
              }

              if (!operation.fail && changed) {
                model.states.length = model.position + 1;
                model.states.push(value);
                model.position += 1;
                if (model.states.length - 1 > maxHistory) {
                  model.states.shift();
                  model.position -= 1;
                }
              }

              const runTransaction = () =>
                travels.transaction(
                  { label: 'modeled-transaction' },
                  () => {
                    for (const nextValue of operation.values) {
                      travels.setState((draft) => {
                        draft.value = nextValue;
                      });
                    }
                    if (operation.fail) {
                      throw new Error('modeled rollback');
                    }
                  }
                );
              if (operation.fail) {
                // A failed transaction surfaces a TravelsError and keeps the
                // recipe's own error as its cause.
                let thrown: unknown;
                try {
                  runTransaction();
                } catch (error) {
                  thrown = error;
                }
                expect(thrown).toBeInstanceOf(TravelsError);
                expect((thrown as TravelsError).code).toBe(
                  'TRANSACTION_FAILED'
                );
                expect((thrown as TravelsError).cause).toBeInstanceOf(Error);
                expect(((thrown as TravelsError).cause as Error).message).toBe(
                  'modeled rollback'
                );
              } else {
                expect(runTransaction).not.toThrow();
              }
            } else if (operation.kind === 'pauseSet') {
              const changed = model.states[model.position] !== operation.value;
              travels.pauseTracking();
              travels.setState((draft) => {
                draft.value = operation.value;
              });
              travels.resumeTracking();
              if (changed) {
                model.baseline = operation.value;
                model.states = [operation.value];
                model.position = 0;
              }
            } else if (operation.kind === 'rebase') {
              model.baseline = model.states[model.position];
              model.states = [model.baseline];
              model.position = 0;
              travels.rebase();
            } else {
              model.states = [model.baseline];
              model.position = 0;
              travels.reset();
            }

            assertTimeline(travels, model);
            expect(travels.getMetadata()).toHaveLength(
              Math.max(0, model.states.length - 1)
            );
          }
        }
      ),
      { numRuns: 50, seed: 20260728 }
    );
  });
});
