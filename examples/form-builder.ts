/**
 * Complex form builder example.
 *
 * Uses manual archive mode so multiple low-level edits can become one
 * undoable product action.
 */

import { createTravels } from '../src/index';

type FieldType = 'text' | 'textarea' | 'select' | 'checkbox';

type Field = {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options: string[];
};

type FormBuilderState = {
  title: string;
  fields: Field[];
  selectedFieldId: string | null;
};

const initialState: FormBuilderState = {
  title: 'Customer intake',
  fields: [],
  selectedFieldId: null,
};

export const formBuilder = createTravels(initialState, {
  autoArchive: false,
  maxHistory: 250,
});

export function addField(type: FieldType, label: string) {
  formBuilder.setState((draft) => {
    const id = crypto.randomUUID();
    draft.fields.push({
      id,
      type,
      label,
      required: false,
      options: type === 'select' ? ['Option 1'] : [],
    });
    draft.selectedFieldId = id;
  });
  formBuilder.archive();
}

export function renameField(fieldId: string, label: string) {
  formBuilder.setState((draft) => {
    const field = draft.fields.find((item) => item.id === fieldId);
    if (field) {
      field.label = label;
    }
  });
}

export function commitFieldInspectorChange() {
  if (formBuilder.canArchive()) {
    formBuilder.archive();
  }
}

export function reorderField(fromIndex: number, toIndex: number) {
  formBuilder.setState((draft) => {
    const [field] = draft.fields.splice(fromIndex, 1);
    if (!field) return;
    draft.fields.splice(toIndex, 0, field);
  });
  formBuilder.archive();
}

export function removeSelectedField() {
  formBuilder.setState((draft) => {
    draft.fields = draft.fields.filter(
      (field) => field.id !== draft.selectedFieldId
    );
    draft.selectedFieldId = null;
  });
  formBuilder.archive();
}
