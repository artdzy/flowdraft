import { useReactFlow, type XYPosition } from '@xyflow/react';
import { useCallback } from 'react';
import { NODE_SIZE } from '../flow/defaults';
import type { PaletteItem } from '../flow/palette';
import { useEditor } from '../store/editor';

const snap = (v: number) => Math.round(v / 10) * 10;
let nudge = 0;

/** Adds a palette item centred on a screen point (drop) or on the visible canvas centre (tap/click). */
export function useAddNode() {
  const rf = useReactFlow();
  return useCallback(
    (item: PaletteItem, screen?: XYPosition) => {
      let point = screen;
      if (!point) {
        const rect = document.querySelector('.fd-canvas')?.getBoundingClientRect();
        if (!rect) return;
        nudge = (nudge + 1) % 6;
        point = { x: rect.left + rect.width / 2 + nudge * 16, y: rect.top + rect.height / 2 + nudge * 16 };
      }
      const flow = rf.screenToFlowPosition(point);
      const size = NODE_SIZE[item.kind] ?? {};
      const position = { x: snap(flow.x - (size.width ?? 160) / 2), y: snap(flow.y - (size.height ?? 60) / 2) };
      useEditor.getState().addNode(item.kind, item.data, position);
    },
    [rf],
  );
}
