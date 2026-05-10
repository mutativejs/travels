import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { createTravels, Travels } from '../src/index';

type ModelState = {
  counter: number;
  user: {
    name: string;
    flags: {
      done: boolean;
    };
  };
  items: Array<{
    id: number;
    text: string;
    done: boolean;
  }>;
};

type Operation =
  | { kind: 'increment'; amount: number }
  | { kind: 'rename'; name: string }
  | { kind: 'toggle' }
  | { kind: 'push'; id: number; text: string }
  | { kind: 'splice'; index: number; deleteCount: number }
  | { kind: 'replaceItem'; index: number; text: string }
  | { kind: 'noOp' };

const initialState = (): ModelState => ({
  counter: 0,
  user: {
    name: 'Guest',
    flags: {
      done: false,
    },
  },
  items: [],
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const operationArbitrary = fc.oneof<Operation>(
  fc.record({
    kind: fc.constant('increment'),
    amount: fc.integer({ min: -5, max: 5 }),
  }),
  fc.record({
    kind: fc.constant('rename'),
    name: fc.string({ minLength: 0, maxLength: 12 }),
  }),
  fc.record({ kind: fc.constant('toggle') }),
  fc.record({
    kind: fc.constant('push'),
    id: fc.integer({ min: 0, max: 1000 }),
    text: fc.string({ minLength: 0, maxLength: 16 }),
  }),
  fc.record({
    kind: fc.constant('splice'),
    index: fc.integer({ min: 0, max: 20 }),
    deleteCount: fc.integer({ min: 0, max: 2 }),
  }),
  fc.record({
    kind: fc.constant('replaceItem'),
    index: fc.integer({ min: 0, max: 20 }),
    text: fc.string({ minLength: 0, maxLength: 16 }),
  }),
  fc.record({ kind: fc.constant('noOp') })
);

const applyOperation = (state: ModelState, operation: Operation): void => {
  switch (operation.kind) {
    case 'increment':
      state.counter += operation.amount;
      return;
    case 'rename':
      state.user.name = operation.name;
      return;
    case 'toggle':
      state.user.flags.done = !state.user.flags.done;
      return;
    case 'push':
      state.items.push({
        id: operation.id,
        text: operation.text,
        done: false,
      });
      return;
    case 'splice':
      state.items.splice(
        operation.index % Math.max(1, state.items.length + 1),
        operation.deleteCount
      );
      return;
    case 'replaceItem':
      if (state.items.length > 0) {
        state.items[operation.index % state.items.length].text =
          operation.text;
      }
      return;
    case 'noOp':
      return;
  }
};

const applyOperations = (
  travels: ReturnType<typeof createTravels<ModelState>>,
  operations: Operation[]
) => {
  for (const operation of operations) {
    travels.setState((draft) => {
      applyOperation(draft, operation);
    });
  }
};

describe('Property-based history invariants', () => {
  test('back(n) followed by forward(n) returns to the same state', () => {
    fc.assert(
      fc.property(
        fc.array(operationArbitrary, { minLength: 1, maxLength: 40 }),
        (operations) => {
          const travels = createTravels(initialState(), {
            maxHistory: operations.length + 1,
            warnOnUnsupportedState: false,
          });

          applyOperations(travels, operations);
          const finalState = clone(travels.getState());
          const availableSteps = travels.getPatches().patches.length;
          const steps = Math.floor(availableSteps / 2);

          travels.back(steps);
          travels.forward(steps);

          expect(travels.getState()).toEqual(finalState);
        }
      ),
      { numRuns: 75, seed: 20260511 }
    );
  });

  test('serialize -> deserialize preserves state, patches, and position', () => {
    fc.assert(
      fc.property(
        fc.array(operationArbitrary, { minLength: 1, maxLength: 35 }),
        (operations) => {
          const travels = createTravels(initialState(), {
            maxHistory: operations.length + 1,
            warnOnUnsupportedState: false,
          });

          applyOperations(travels, operations);

          const history = Travels.deserialize<ModelState>(
            JSON.stringify(travels.serialize())
          );
          const restored = createTravels(history.state, {
            history,
            maxHistory: operations.length + 1,
            warnOnUnsupportedState: false,
            strictInitialPatches: true,
          });

          expect(restored.getState()).toEqual(travels.getState());
          expect(restored.getPosition()).toBe(travels.getPosition());
          expect(restored.getPatches()).toEqual(travels.getPatches());
        }
      ),
      { numRuns: 75, seed: 20260512 }
    );
  });

  test('mutable and immutable modes agree for comparable JSON state', () => {
    fc.assert(
      fc.property(
        fc.array(operationArbitrary, { minLength: 1, maxLength: 35 }),
        (operations) => {
          const immutable = createTravels(initialState(), {
            maxHistory: operations.length + 1,
            warnOnUnsupportedState: false,
          });
          const mutable = createTravels(initialState(), {
            maxHistory: operations.length + 1,
            mutable: true,
            warnOnUnsupportedState: false,
          });

          applyOperations(immutable, operations);
          applyOperations(mutable, operations);

          expect(mutable.getState()).toEqual(immutable.getState());
          expect(mutable.getPosition()).toBe(immutable.getPosition());

          const steps = Math.floor(immutable.getPatches().patches.length / 2);
          immutable.back(steps);
          mutable.back(steps);
          expect(mutable.getState()).toEqual(immutable.getState());

          immutable.forward(steps);
          mutable.forward(steps);
          expect(mutable.getState()).toEqual(immutable.getState());
        }
      ),
      { numRuns: 60, seed: 20260513 }
    );
  });

  test('maxHistory keeps patch length and position inside bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8 }),
        fc.array(operationArbitrary, { minLength: 1, maxLength: 50 }),
        (maxHistory, operations) => {
          const travels = createTravels(initialState(), {
            maxHistory,
            warnOnUnsupportedState: false,
          });

          applyOperations(travels, operations);

          expect(travels.getPatches().patches.length).toBeLessThanOrEqual(
            maxHistory
          );
          expect(travels.getPosition()).toBeGreaterThanOrEqual(0);
          expect(travels.getPosition()).toBeLessThanOrEqual(maxHistory);
        }
      ),
      { numRuns: 75, seed: 20260514 }
    );
  });

  test('no-op updates do not create history entries', () => {
    fc.assert(
      fc.property(fc.array(fc.constant<Operation>({ kind: 'noOp' })), (ops) => {
        const travels = createTravels(initialState(), {
          maxHistory: ops.length + 1,
          warnOnUnsupportedState: false,
        });

        applyOperations(travels, ops);

        expect(travels.getPatches()).toEqual({
          patches: [],
          inversePatches: [],
        });
        expect(travels.getPosition()).toBe(0);
      }),
      { numRuns: 25, seed: 20260515 }
    );
  });

  test('new edits after undo clear redo history', () => {
    fc.assert(
      fc.property(
        fc.array(operationArbitrary, { minLength: 3, maxLength: 25 }),
        operationArbitrary,
        (operations, nextOperation) => {
          const travels = createTravels(initialState(), {
            maxHistory: operations.length + 2,
            warnOnUnsupportedState: false,
          });

          applyOperations(travels, operations);
          const availableSteps = travels.getPatches().patches.length;
          if (availableSteps < 2) {
            return;
          }

          travels.back(1);
          const beforeNewEdit = clone(travels.getState());
          travels.setState((draft) => {
            applyOperation(draft, nextOperation);
          });

          if (
            JSON.stringify(travels.getState()) !==
            JSON.stringify(beforeNewEdit)
          ) {
            expect(travels.canForward()).toBe(false);
          }
        }
      ),
      { numRuns: 60, seed: 20260516 }
    );
  });
});
