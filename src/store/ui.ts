import { create } from 'zustand';

export type Toast = { id: number; text: string; tone: 'default' | 'error' };

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
};

type UiState = {
  projectsOpen: boolean;
  newOpen: boolean;
  aiOpen: boolean;
  /** Welcome video dialog (PromoDialog); the what's-new dialog waits until it is closed. */
  promoOpen: boolean;
  paletteSheet: boolean;
  inspectorSheet: boolean;
  /** Node text field being edited in place on the canvas. */
  editing: { id: string; field: string } | null;
  /** Question shown in the app's own confirm dialog (never the browser's). */
  confirm: ConfirmRequest | null;
  toasts: Toast[];
};

export const useUi = create<UiState>()(() => ({
  projectsOpen: false,
  newOpen: false,
  aiOpen: false,
  promoOpen: false,
  paletteSheet: false,
  inspectorSheet: false,
  editing: null,
  confirm: null,
  toasts: [],
}));

/** Asks in the app's confirm dialog; resolves true only when the user presses the confirm button. */
export function askConfirm(request: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  settleConfirm(false);
  return new Promise((resolve) => useUi.setState({ confirm: { ...request, resolve } }));
}

export function settleConfirm(ok: boolean) {
  const pending = useUi.getState().confirm;
  if (!pending) return;
  useUi.setState({ confirm: null });
  pending.resolve(ok);
}

let toastId = 0;

export function toast(text: string, tone: Toast['tone'] = 'default') {
  const id = ++toastId;
  useUi.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
  setTimeout(() => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === 'error' ? 5000 : 2600);
}
