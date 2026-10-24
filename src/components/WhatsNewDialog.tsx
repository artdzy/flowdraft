import { Copy, Rows3, Spline, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { version } from '../../package.json';
import { t } from '../i18n';
import { useUi } from '../store/ui';
import { Modal } from './Modal';

const SEEN_KEY = 'flowdraft:whatsnew';

type Change = { icon: LucideIcon; title: string; text: string };

/** What this version brings. Update together with the version in package.json; everyone sees it once. */
const CHANGES: Change[] = [
  {
    icon: Copy,
    title: t('Kopyala, yapıştır, sağ tık', 'Copy, paste, right-click'),
    text: t(
      '⌘C / ⌘V / ⌘X artık çalışıyor; başka bir akışa bile yapıştırabilirsin. Düz metin yapıştırınca yazı kutusu olur. Kutuya, çizgiye ya da boş tuvale sağ tıklayınca menü açılır.',
      '⌘C / ⌘V / ⌘X now work, even into another flow. Pasted plain text becomes a text box. Right-click a box, a line or the empty canvas for a menu.',
    ),
  },
  {
    icon: Spline,
    title: t('Çizgiler daha hızlı', 'Faster connections'),
    text: t(
      'Bir noktadan boşluğa sürükleyip bırak: bağlı yeni bir parça oluşur ve hemen yazmaya başlarsın. Çizgiye çift tıklayıp etiket yaz; seçili çizginin ucunu başka bir kutuya taşı.',
      'Drag from a dot into empty space: a connected part appears and you start typing right away. Double-click a line to label it; drag the end of a selected line to another box.',
    ),
  },
  {
    icon: Rows3,
    title: t('Düzen', 'Layout'),
    text: t(
      'Kulvarı taşıyınca içindekiler birlikte gelir. Sürüklerken kırmızı kılavuz çizgileri komşulara hizalar. ⇧1 sığdır, ⇧0 %100, ⇧2 seçime yakınlaş, ⌘+ / ⌘− yakınlaş ve uzaklaş.',
      'Moving a lane takes its contents along. Red guide lines snap to neighbours while you drag. ⇧1 fits everything, ⇧0 is 100%, ⇧2 zooms to the selection, ⌘+ / ⌘− zoom in and out.',
    ),
  },
];

/** Not in a ?p= link from an AI tool or a ?ornek= guide example, and not when the choice couldn't be remembered. */
function unseen(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.has('p') || params.has('ornek')) return false;
  try {
    return localStorage.getItem(SEEN_KEY) !== version;
  } catch {
    return false;
  }
}

/** Version and change list, shown once per person (per browser) after the welcome video, in TR or EN. */
export function WhatsNewDialog() {
  const [pending, setPending] = useState(unseen);
  const promoOpen = useUi((s) => s.promoOpen);

  const close = () => {
    setPending(false);
    try {
      localStorage.setItem(SEEN_KEY, version);
    } catch {
      // Storage was checked before opening; nothing more to do.
    }
  };

  const connect = () => {
    close();
    useUi.setState({ aiOpen: true });
  };

  return (
    <Modal
      open={pending && !promoOpen}
      onClose={close}
      title={t(`Yenilikler · v${version}`, `What’s new · v${version}`)}
      titleId="fd-whatsnew-title"
      className="fd-whatsnew-modal"
    >
      <ul className="fd-whatsnew">
        {CHANGES.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <span className="fd-whatsnew-icon" aria-hidden>
              <Icon size={17} strokeWidth={1.9} />
            </span>
            <span className="fd-whatsnew-body">
              <strong>{title}</strong>
              <span>{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="fd-whatsnew-foot">
        <button type="button" className="fd-btn" onClick={connect}>
          {t('AI araçlarına bağla', 'Connect AI tools')}
        </button>
        <button type="button" className="fd-btn is-primary" onClick={close}>
          {t('Tamam', 'Got it')}
        </button>
      </div>
    </Modal>
  );
}
