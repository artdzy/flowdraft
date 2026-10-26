import { t } from '../i18n';
import type { FlowSketch } from '../flow/sketch';
import { useUi } from '../store/ui';
import { onNativeEvent, postNative, type SketchStatus } from './platform';

/**
 * Drawing a flow from a description, done by the app with Apple's on-device model (ios/Flowdraft/FlowSketcher.swift).
 * The web app only lays out what the model lists (src/flow/sketch.ts). Not available on the web.
 */

/** null outside the app or on systems without the model (before iOS / macOS 26): the feature is not offered there. */
export function initialSketchStatus(): SketchStatus | null {
  const status = window.flowdraftNative?.sketch;
  return !status || status === 'unsupported' || status === 'notEligible' ? null : status;
}

export function openDescribe() {
  useUi.setState({ describeOpen: true, newOpen: false });
}

/** Why drawing isn't possible right now, for the dialog. */
export function statusMessage(status: SketchStatus): string {
  switch (status) {
    case 'notEnabled':
      return t(
        'Bunun için Apple Intelligence açık olmalı: Ayarlar > Apple Intelligence ve Siri.',
        'This needs Apple Intelligence: turn it on in Settings > Apple Intelligence & Siri.',
      );
    case 'notReady':
      return t(
        'Apple Intelligence hâlâ hazırlanıyor (model iniyor). Birkaç dakika sonra tekrar dene.',
        'Apple Intelligence is still getting ready (its model is downloading). Try again in a few minutes.',
      );
    case 'notEligible':
    case 'unsupported':
      return t('Bu cihaz Apple Intelligence desteklemiyor.', 'This device doesn’t support Apple Intelligence.');
    default:
      return t('Apple Intelligence şu an kullanılamıyor.', 'Apple Intelligence isn’t available right now.');
  }
}

function errorMessage(code: string): string {
  switch (code) {
    case 'tooLong':
      return t('Açıklama çok uzun. Biraz kısaltıp tekrar dene.', 'The description is too long. Shorten it and try again.');
    case 'refused':
      return t(
        'Apple Intelligence bu açıklamayla akış çizmedi. Farklı kelimelerle dene.',
        'Apple Intelligence wouldn’t draw a flow from this description. Try different words.',
      );
    case 'language':
      return t('Apple Intelligence bu dili desteklemiyor.', 'Apple Intelligence doesn’t support this language.');
    case 'busy':
      return t('Apple Intelligence şu an meşgul. Birazdan tekrar dene.', 'Apple Intelligence is busy. Try again in a moment.');
    case 'notEnabled':
    case 'notReady':
    case 'notEligible':
    case 'unavailable':
      return statusMessage(code as SketchStatus);
    default:
      return t('Akış çizilemedi. Tekrar dene.', 'Couldn’t draw the flow. Try again.');
  }
}

/** Asks the app for the current status (the model may have finished downloading) and loads it in the background. */
export function prepareSketch(onStatus: (status: SketchStatus) => void) {
  const off = onNativeEvent((event) => {
    if (event.type !== 'sketchStatus') return;
    off();
    onStatus(event.status);
  });
  postNative({ type: 'sketchPrepare' });
  return off;
}

let nextId = 1;

export class SketchCancelled extends Error {}

/**
 * Draws a sketch from the description. `onProgress` gets the number of steps so far and the latest step's title.
 * Rejects with a message to show, or with SketchCancelled when the signal aborts.
 */
export function sketchFromDescription(
  prompt: string,
  onProgress: (steps: number, latest: string) => void,
  signal: AbortSignal,
): Promise<FlowSketch> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const off = onNativeEvent((event) => {
      if (!('id' in event) || event.id !== id) return;
      if (event.type === 'sketchProgress') onProgress(event.steps, event.latest);
      else if (event.type === 'sketchResult') finish(() => resolve(event.sketch));
      else if (event.type === 'sketchError') {
        finish(() => reject(event.code === 'cancelled' ? new SketchCancelled() : new Error(errorMessage(event.code))));
      }
    });
    const abort = () => {
      postNative({ type: 'sketchCancel' });
      finish(() => reject(new SketchCancelled()));
    };
    const finish = (settle: () => void) => {
      off();
      signal.removeEventListener('abort', abort);
      settle();
    };
    signal.addEventListener('abort', abort);
    postNative({ type: 'sketch', id, prompt });
  });
}
