import type { FlowSketch } from '../flow/sketch';

type NativeMessage =
  | { type: 'export'; filename: string; dataUrl: string }
  | { type: 'copy'; text: string }
  /** Mac app: a press on an empty part of the top bar moves the window; a double-click zooms it. */
  | { type: 'dragWindow' }
  | { type: 'zoomWindow' }
  /** Drawing from a description (src/lib/describe.ts): load the model, draw, stop. */
  | { type: 'sketchPrepare' }
  | { type: 'sketch'; id: number; prompt: string }
  | { type: 'sketchCancel' };

/** Why the on-device model can or can't draw (ios/Flowdraft/FlowSketcher.swift). */
export type SketchStatus = 'available' | 'notEnabled' | 'notEligible' | 'notReady' | 'unavailable' | 'unsupported';

/** What the app sends back, through window.flowdraftNativeEvent. */
export type NativeEvent =
  | { type: 'sketchStatus'; status: SketchStatus }
  | { type: 'sketchProgress'; id: number; steps: number; latest: string }
  | { type: 'sketchResult'; id: number; sketch: FlowSketch }
  | { type: 'sketchError'; id: number; code: string }
  /** A menu bar command (ios/Flowdraft/EditorCommands.swift), handled in src/lib/commands.ts and the canvas. */
  | { type: 'command'; name: string }
  /** File > Open: a file the user picked in the system file picker. */
  | { type: 'importFile'; name: string; text: string };

declare global {
  interface Window {
    webkit?: { messageHandlers?: { flowdraft?: { postMessage: (message: NativeMessage) => void } } };
    /** Set by the app before the page loads: the features it adds. */
    flowdraftNative?: { sketch?: SketchStatus };
    flowdraftNativeEvent?: (event: NativeEvent) => void;
  }
}

/** True inside the iPad app (ios/), which runs a bundled copy of this web app and exposes a message handler. */
export const nativeApp = !!window.webkit?.messageHandlers?.flowdraft;

/** The Mac version of that app (Mac Catalyst): its window has no title bar, so the top bar stands in for one. */
export const macApp = nativeApp && document.documentElement.dataset.platform === 'mac';

/** Public address of flowdraft; inside the app, window.location is the local bundle and not shareable. */
export const siteOrigin = nativeApp ? 'https://flowdraft.tech' : window.location.origin;

export function postNative(message: NativeMessage) {
  window.webkit?.messageHandlers?.flowdraft?.postMessage(message);
}

const listeners = new Set<(event: NativeEvent) => void>();
window.flowdraftNativeEvent = (event) => listeners.forEach((listener) => listener(event));

/** Subscribes to events from the app; returns the unsubscribe function. */
export function onNativeEvent(listener: (event: NativeEvent) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
