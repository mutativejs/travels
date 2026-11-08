/** A JSON Patch operation as Travels records it, with either path format. */
export type DemoPatch = {
  op: string;
  path: string | readonly (string | number)[];
  value?: unknown;
};

/** Zero-padded history step, as shown in timelines: 3 → "03". */
export function padStep(step: number) {
  return String(step).padStart(2, '0');
}

/** Format an array or string patch path as an RFC 6901 JSON Pointer. */
export function toPointer(path: DemoPatch['path']) {
  if (typeof path === 'string') return path;
  if (path.length === 0) return '/';
  return path
    .map((segment) => `/${String(segment).replace(/~/g, '~0').replace(/\//g, '~1')}`)
    .join('');
}

/** Compact JSON for inline display, shortened past `max` characters. */
export function shortJson(value: unknown, max = 28) {
  const text = JSON.stringify(value) ?? 'undefined';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** One-line summary of a patch operation: `replace /shapes/0/x 34`. */
export function describePatch(patch: DemoPatch) {
  const value = 'value' in patch && patch.op !== 'remove' ? ` ${shortJson(patch.value)}` : '';
  return `${patch.op} ${toPointer(patch.path)}${value}`;
}

const nonTextInputs = new Set(['button', 'checkbox', 'color', 'radio', 'range', 'reset', 'submit']);

/**
 * Whether a keyboard event target edits text, in which case global undo/redo
 * shortcuts must leave the event to the browser.
 */
export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement) return !nonTextInputs.has(target.type);
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}
