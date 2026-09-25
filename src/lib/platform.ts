type NativeMessage =
  | { type: 'export'; filename: string; dataUrl: string }
  | { type: 'copy'; text: string };

declare global {
  interface Window {
    webkit?: { messageHandlers?: { flowdraft?: { postMessage: (message: NativeMessage) => void } } };
  }
}

/** True inside the iPad app (ios/), which runs a bundled copy of this web app and exposes a message handler. */
export const nativeApp = !!window.webkit?.messageHandlers?.flowdraft;

/** Public address of flowdraft; inside the app, window.location is the local bundle and not shareable. */
export const siteOrigin = nativeApp ? 'https://flowdraft.tech' : window.location.origin;

export function postNative(message: NativeMessage) {
  window.webkit?.messageHandlers?.flowdraft?.postMessage(message);
}
