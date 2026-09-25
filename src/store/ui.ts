import { create } from 'zustand';

export type Toast = { id: number; text: string; tone: 'default' | 'error' };

type UiState = {
  projectsOpen: boolean;
  newOpen: boolean;
  aiOpen: boolean;
  paletteSheet: boolean;
  inspectorSheet: boolean;
  toasts: Toast[];
};

export const useUi = create<UiState>()(() => ({
  projectsOpen: false,
  newOpen: false,
  aiOpen: false,
  paletteSheet: false,
  inspectorSheet: false,
  toasts: [],
}));

let toastId = 0;

export function toast(text: string, tone: Toast['tone'] = 'default') {
  const id = ++toastId;
  useUi.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
  setTimeout(() => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === 'error' ? 5000 : 2600);
}
