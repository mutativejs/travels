/**
 * Canvas editor example.
 *
 * Pointer-move updates stay live, and pointer-up archives them as one undo step.
 */

import { createTravels } from '../src/index';

type Shape = {
  id: string;
  kind: 'rect' | 'ellipse' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
};

type CanvasState = {
  shapes: Shape[];
  selectedIds: string[];
  zoom: number;
};

export const canvasHistory = createTravels<CanvasState>(
  {
    shapes: [],
    selectedIds: [],
    zoom: 1,
  },
  {
    autoArchive: false,
    maxHistory: 500,
  }
);

export function addRectangle(x: number, y: number) {
  canvasHistory.setState((draft) => {
    const id = crypto.randomUUID();
    draft.shapes.push({
      id,
      kind: 'rect',
      x,
      y,
      width: 160,
      height: 96,
      rotation: 0,
      fill: '#3b82f6',
    });
    draft.selectedIds = [id];
  });
  canvasHistory.archive();
}

export function dragSelected(deltaX: number, deltaY: number) {
  canvasHistory.setState((draft) => {
    const selected = new Set(draft.selectedIds);
    for (const shape of draft.shapes) {
      if (selected.has(shape.id)) {
        shape.x += deltaX;
        shape.y += deltaY;
      }
    }
  });
}

export function commitDrag() {
  if (canvasHistory.canArchive()) {
    canvasHistory.archive();
  }
}

export function groupSelected() {
  canvasHistory.setState((draft) => {
    draft.selectedIds.sort();
  });
  canvasHistory.archive();
}
