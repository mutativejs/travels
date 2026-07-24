import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { createTravels } from '../src/index';

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

const applyToModel = (model: TimelineModel, operation: ModelOperation): void => {
  switch (operation.kind) {
    case 'set': {
      if (model.states[model.position] === operation.value) {
        return;
      }

      model.states.length = model.position + 1;
      model.states.push(operation.value);
      model.position += 1;

      if (model.states.length - 1 > maxHistory) {
        model.states.shift();
        model.position -= 1;
      }
      return;
    }
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

describe('timeline state-machine model', () => {
  test('mixed edits and navigation match a snapshot reference model', () => {
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

            switch (operation.kind) {
              case 'set':
                travels.setState((draft) => {
                  draft.value = operation.value;
                });
                break;
              case 'back':
                travels.back(operation.amount);
                break;
              case 'forward':
                travels.forward(operation.amount);
                break;
              case 'go':
                travels.go(operation.position);
                break;
            }

            expect(travels.getState().value).toBe(
              model.states[model.position]
            );
            expect(travels.getPosition()).toBe(model.position);
            expect(travels.getHistory().map((state) => state.value)).toEqual(
              model.states
            );
            expect(travels.canBack()).toBe(model.position > 0);
            expect(travels.canForward()).toBe(
              model.position < model.states.length - 1
            );
          }
        }
      ),
      { numRuns: 100, seed: 20260724 }
    );
  });
});
